import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import { computeSourceResponsesHash } from "@/lib/master-document/source-responses-hash";
import {
  questionnaireClarificationsPayloadSchema,
  questionnaireEvaluationPayloadSchema,
} from "@/lib/questionnaire-evaluation/schema";
import {
  getActiveQuestionnaireEvaluation,
  insertQuestionnaireClarification,
} from "@/lib/questionnaire-evaluation/supabase-questionnaire";
import { validateClarificationAnswersAgainstQuestions } from "@/lib/questionnaire-evaluation/validate-clarification-submit";

type Params = { params: Promise<{ projectId: string }> };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
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

  const parsedBody = questionnaireClarificationsPayloadSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { data: pr, error: prError } = await supabase
    .from("project_responses")
    .select("id, responses, questionnaire_pre_master_evaluation")
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

  const evalParsed = questionnaireEvaluationPayloadSchema.safeParse(
    evaluationPayload,
  );
  if (!evalParsed.success) {
    return NextResponse.json(
      {
        error:
          "No hay una evaluación de cuestionario válida. Vuelve a ejecutar la evaluación.",
      },
      { status: 400 },
    );
  }

  const v = validateClarificationAnswersAgainstQuestions(
    evalParsed.data.clarification_questions,
    parsedBody.data.answers,
  );
  if (!v.ok) {
    return NextResponse.json({ error: v.message }, { status: 400 });
  }

  const submittedAt = new Date().toISOString();

  const { data: insertedClar, error: insertClarError } =
    await insertQuestionnaireClarification(supabase, {
      project_id: projectId,
      user_id: user.id,
      evaluation_id: activeEval?.id ?? null,
      answers: parsedBody.data.answers,
      submitted_at: submittedAt,
    });

  if (insertClarError || !insertedClar) {
    return NextResponse.json(
      {
        error:
          insertClarError?.message ??
          "No se pudo guardar la aclaración en la tabla nueva.",
      },
      { status: 500 },
    );
  }

  const payload = {
    submitted_at: submittedAt,
    answers: parsedBody.data.answers,
    evaluation_overall_score_snapshot: evalParsed.data.overall_quality_score,
    evaluation_recommended_action_snapshot:
      evalParsed.data.recommended_next_action,
    questionnaire_clarification_id: insertedClar.id,
  };

  const { error: updateError } = await supabase
    .from("project_responses")
    .update({
      questionnaire_clarifications: payload,
    })
    .eq("id", pr.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    questionnaire_clarifications: payload,
  });
}
