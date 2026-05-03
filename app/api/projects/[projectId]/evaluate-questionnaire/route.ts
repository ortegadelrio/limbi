import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import { QUESTIONNAIRE_EVAL_PROMPT_VERSION } from "@/lib/questionnaire-evaluation/constants";
import { finalizeEvaluationPayload } from "@/lib/questionnaire-evaluation/clarification-questions-sanitize";
import { parseQuestionnaireEvaluationJson } from "@/lib/questionnaire-evaluation/parse-evaluation";
import {
  questionnaireEvaluationPayloadSchema,
  shouldRequireClarificationScreen,
} from "@/lib/questionnaire-evaluation/schema";
import {
  getActiveQuestionnaireEvaluation,
  insertQuestionnaireEvaluation,
  supersedeQuestionnaireEvaluationsForProject,
} from "@/lib/questionnaire-evaluation/supabase-questionnaire";
import { computeSourceResponsesHash } from "@/lib/master-document/source-responses-hash";
import { buildQuestionnaireEvaluationPrompt } from "@/lib/prompts/questionnaire-evaluation";
import { generateQuestionnaireEvaluationJson } from "@/lib/openai/questionnaire-evaluation";

type Params = { params: Promise<{ projectId: string }> };

const WIZARD_COMPLETE_STEP = "review_before_generation" as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tryCachedEvaluation(
  payload: unknown,
): ReturnType<typeof questionnaireEvaluationPayloadSchema.safeParse> {
  return questionnaireEvaluationPayloadSchema.safeParse(payload);
}

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, user_id, name_or_descriptor, name_status, challenge_type, main_challenge, status",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return jsonNotFound();
  }

  const { data: pr, error: prError } = await supabase
    .from("project_responses")
    .select(
      "id, responses, completed_steps, questionnaire_pre_master_evaluation, questionnaire_pre_master_evaluation_source_hash",
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (prError) {
    return NextResponse.json({ error: prError.message }, { status: 500 });
  }
  if (!pr) {
    return NextResponse.json(
      { error: "No hay respuestas de cuestionario para este proyecto." },
      { status: 400 },
    );
  }

  const completed = Array.isArray(pr.completed_steps)
    ? pr.completed_steps.filter((x): x is string => typeof x === "string")
    : [];
  if (!completed.includes(WIZARD_COMPLETE_STEP)) {
    return NextResponse.json(
      { error: "El cuestionario principal aún no está completo." },
      { status: 400 },
    );
  }

  const responses: Record<string, unknown> =
    pr.responses && isPlainObject(pr.responses)
      ? (pr.responses as Record<string, unknown>)
      : {};

  const hash = computeSourceResponsesHash(responses);

  if (!force) {
    const activeNew = await getActiveQuestionnaireEvaluation(supabase, projectId, {
      sourceResponsesHash: hash,
    });
    if (activeNew) {
      const cached = tryCachedEvaluation(activeNew.payload);
      if (cached.success) {
        const evaluation = finalizeEvaluationPayload(cached.data, responses);
        return NextResponse.json({
          evaluation,
          requires_clarification: shouldRequireClarificationScreen(evaluation),
          cached: true,
          source: "questionnaire_evaluations",
        });
      }
    }

    if (
      pr.questionnaire_pre_master_evaluation &&
      typeof pr.questionnaire_pre_master_evaluation === "object" &&
      pr.questionnaire_pre_master_evaluation_source_hash === hash
    ) {
      const cached = tryCachedEvaluation(pr.questionnaire_pre_master_evaluation);
      if (cached.success) {
        const evaluation = finalizeEvaluationPayload(cached.data, responses);
        return NextResponse.json({
          evaluation,
          requires_clarification: shouldRequireClarificationScreen(evaluation),
          cached: true,
          source: "project_responses_legacy",
        });
      }
    }
  }

  const project_summary = {
    id: project.id,
    name_or_descriptor: project.name_or_descriptor,
    name_status: project.name_status,
    challenge_type: project.challenge_type,
    main_challenge: project.main_challenge,
    status: project.status,
  };

  const prompt = buildQuestionnaireEvaluationPrompt({
    project_summary,
    responses_json: JSON.stringify(responses, null, 2),
  });

  let raw_json_text: string;
  let model_used: string;
  try {
    const gen = await generateQuestionnaireEvaluationJson(prompt);
    raw_json_text = gen.raw_json_text;
    model_used = gen.model_used;
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Error al llamar a OpenAI.";
    const status =
      msg.includes("OPENAI_API_KEY") || msg.includes("no está configurada")
        ? 503
        : 502;
    return NextResponse.json({ error: msg }, { status });
  }

  const parsed = parseQuestionnaireEvaluationJson(raw_json_text);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.message },
      { status: 422 },
    );
  }

  const evaluationToPersist = finalizeEvaluationPayload(parsed.data, responses);

  const { error: supersedeErr } =
    await supersedeQuestionnaireEvaluationsForProject(supabase, projectId);
  if (supersedeErr) {
    return NextResponse.json({ error: supersedeErr.message }, { status: 500 });
  }

  const { data: insertedEval, error: insertEvalError } =
    await insertQuestionnaireEvaluation(supabase, {
      project_id: projectId,
      user_id: user.id,
      source_responses_hash: hash,
      payload: evaluationToPersist as Record<string, unknown>,
      model_used,
      prompt_version: QUESTIONNAIRE_EVAL_PROMPT_VERSION,
    });

  if (insertEvalError || !insertedEval) {
    return NextResponse.json(
      { error: insertEvalError?.message ?? "No se pudo guardar la evaluación." },
      { status: 500 },
    );
  }

  const { error: updateError } = await supabase
    .from("project_responses")
    .update({
      questionnaire_pre_master_evaluation: evaluationToPersist,
      questionnaire_pre_master_evaluation_source_hash: hash,
      questionnaire_clarifications: null,
    })
    .eq("id", pr.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    evaluation: evaluationToPersist,
    requires_clarification:
      shouldRequireClarificationScreen(evaluationToPersist),
    cached: false,
    evaluation_id: insertedEval.id,
  });
}
