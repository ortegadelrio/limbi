import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import { finalizeEvaluationPayload } from "@/lib/questionnaire-evaluation/clarification-questions-sanitize";
import { generateClarificationCoachReply } from "@/lib/openai/clarification-coach";
import { buildClarificationCoachPrompt } from "@/lib/prompts/clarification-coach";
import {
  clarificationQuestionSchema,
  questionnaireEvaluationPayloadSchema,
} from "@/lib/questionnaire-evaluation/schema";
import type { ClarificationQuestion } from "@/lib/questionnaire-evaluation/schema";
import { getActiveQuestionnaireEvaluation } from "@/lib/questionnaire-evaluation/supabase-questionnaire";
import { mergeClarificationSuggestionChips } from "@/lib/questionnaire-evaluation/clarification-ui-suggestions";
import { computeSourceResponsesHash } from "@/lib/master-document/source-responses-hash";
import { stripInternalResponseKeys } from "@/lib/master-document/responses-public";
import { z } from "zod";

type Params = { params: Promise<{ projectId: string }> };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const coachBodySchema = z.object({
  question_id: z.string().min(1),
  user_message: z.string().min(1).max(2000),
  clarification_round: z.enum(["initial", "follow_up"]).optional().default("initial"),
});

const criticalFollowUpsSchema = z.array(clarificationQuestionSchema).max(2);

function pickCoachQuestion(
  questionId: string,
  finalizedEval: ReturnType<typeof finalizeEvaluationPayload>,
  clarifications: Record<string, unknown> | null,
  round: "initial" | "follow_up",
  responses: Record<string, unknown>,
): ClarificationQuestion | null {
  if (round === "follow_up" && clarifications) {
    const raw = clarifications.critical_follow_up_questions;
    const parsed = criticalFollowUpsSchema.safeParse(raw);
    if (parsed.success) {
      const hit = parsed.data.find((q) => q.id === questionId);
      if (hit) return mergeClarificationSuggestionChips(hit, responses);
    }
  }

  const fromEval = finalizedEval.clarification_questions.find((q) => q.id === questionId);
  return fromEval ? mergeClarificationSuggestionChips(fromEval, responses) : null;
}

function publicQuestionPayload(q: ClarificationQuestion): Record<string, unknown> {
  return {
    id: q.id,
    limbi_detection: q.limbi_detection,
    referenced_user_answer: q.referenced_user_answer,
    why_it_matters: q.why_it_matters,
    question_text: q.question_text,
    options: q.options,
    allow_free_text: q.allow_free_text,
  };
}

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, name_or_descriptor, name_status, challenge_type, main_challenge, status",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return jsonNotFound();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsedBody = coachBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { data: pr, error: prError } = await supabase
    .from("project_responses")
    .select(
      "id, responses, questionnaire_pre_master_evaluation, questionnaire_clarifications",
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

  const responses: Record<string, unknown> =
    pr.responses && isPlainObject(pr.responses)
      ? (pr.responses as Record<string, unknown>)
      : {};

  const hash = computeSourceResponsesHash(responses);

  const activeEval = await getActiveQuestionnaireEvaluation(supabase, projectId, {
    sourceResponsesHash: hash,
  });

  const evaluationPayload =
    activeEval?.payload ?? pr.questionnaire_pre_master_evaluation;

  const evalParsed = questionnaireEvaluationPayloadSchema.safeParse(evaluationPayload);
  if (!evalParsed.success) {
    return NextResponse.json(
      {
        error:
          "No hay una evaluación de cuestionario válida. Vuelve a ejecutar la evaluación.",
      },
      { status: 400 },
    );
  }

  const finalizedEval = finalizeEvaluationPayload(evalParsed.data, responses);

  const clarObj =
    pr.questionnaire_clarifications &&
    isPlainObject(pr.questionnaire_clarifications)
      ? (pr.questionnaire_clarifications as Record<string, unknown>)
      : null;

  const q = pickCoachQuestion(
    parsedBody.data.question_id,
    finalizedEval,
    clarObj,
    parsedBody.data.clarification_round,
    responses,
  );

  if (!q) {
    return NextResponse.json(
      { error: "No encontramos esa pregunta de aclaración para este proyecto." },
      { status: 404 },
    );
  }

  const project_summary = {
    id: project.id,
    name_or_descriptor: project.name_or_descriptor,
    name_status: project.name_status,
    challenge_type: project.challenge_type,
    main_challenge: project.main_challenge,
    status: project.status,
  };

  const publicResponses = stripInternalResponseKeys(responses);

  const prompt = buildClarificationCoachPrompt({
    project_summary_json: JSON.stringify(project_summary, null, 2),
    responses_json: JSON.stringify(publicResponses, null, 2),
    clarification_question_json: JSON.stringify(publicQuestionPayload(q), null, 2),
    user_message: parsedBody.data.user_message,
  });

  try {
    const out = await generateClarificationCoachReply(prompt);
    return NextResponse.json({
      strategist_reply: out.strategist_reply,
      model_used: out.model_used,
      question_id: q.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo generar la ayuda.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
