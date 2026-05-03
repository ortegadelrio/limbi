import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import { finalizeEvaluationPayload } from "@/lib/questionnaire-evaluation/clarification-questions-sanitize";
import { clipClarificationQuestionsToScoreCap } from "@/lib/questionnaire-evaluation/clarification-round-cap";
import { formatClarificationAnswersForEvaluationPrompt } from "@/lib/questionnaire-evaluation/format-clarification-answers-for-prompt";
import { buildPostClarificationDimensionNotes } from "@/lib/questionnaire-evaluation/post-clarification-dimension-notes";
import { runQuestionnaireEvaluationOnce } from "@/lib/questionnaire-evaluation/run-questionnaire-evaluation-once";
import { computeSourceResponsesHash } from "@/lib/master-document/source-responses-hash";
import {
  clarificationQuestionSchema,
  questionnaireClarificationsPayloadSchema,
  questionnaireEvaluationPayloadSchema,
} from "@/lib/questionnaire-evaluation/schema";
import type {
  ClarificationAnswer,
  ClarificationQuestion,
  QuestionnaireEvaluationPayload,
} from "@/lib/questionnaire-evaluation/schema";
import {
  getActiveQuestionnaireEvaluation,
  insertQuestionnaireClarification,
} from "@/lib/questionnaire-evaluation/supabase-questionnaire";
import { validateClarificationAnswersAgainstQuestions } from "@/lib/questionnaire-evaluation/validate-clarification-submit";
import { z } from "zod";

type Params = { params: Promise<{ projectId: string }> };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const criticalFollowUpsSchema = z.array(clarificationQuestionSchema).max(2);

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

  const parsedBody = questionnaireClarificationsPayloadSchema.safeParse(body);
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

  const finalizedEval = finalizeEvaluationPayload(evalParsed.data, responses);

  const project_summary = {
    id: project.id,
    name_or_descriptor: project.name_or_descriptor,
    name_status: project.name_status,
    challenge_type: project.challenge_type,
    main_challenge: project.main_challenge,
    status: project.status,
  };

  const submittedAt = new Date().toISOString();

  const followUps = parsedBody.data.follow_up_answers;
  const initialAnswers = parsedBody.data.answers;

  if (followUps && followUps.length > 0) {
    const stored = pr.questionnaire_clarifications;
    if (!isPlainObject(stored)) {
      return NextResponse.json(
        { error: "Primero completa la primera ronda de aclaraciones." },
        { status: 400 },
      );
    }

    const rawCritical = stored.critical_follow_up_questions;
    const critParsed = criticalFollowUpsSchema.safeParse(rawCritical);
    if (!critParsed.success || critParsed.data.length === 0) {
      return NextResponse.json(
        { error: "No hay puntos críticos pendientes para esta segunda ronda." },
        { status: 400 },
      );
    }

    const vFollow = validateClarificationAnswersAgainstQuestions(
      critParsed.data,
      followUps,
    );
    if (!vFollow.ok) {
      return NextResponse.json({ error: vFollow.message }, { status: 400 });
    }

    const prevAnswers = Array.isArray(stored.answers)
      ? (stored.answers as ClarificationAnswer[])
      : [];
    const mergedAnswers = [...prevAnswers, ...followUps];

    const { data: insertedClar, error: insertClarError } =
      await insertQuestionnaireClarification(supabase, {
        project_id: projectId,
        user_id: user.id,
        evaluation_id: activeEval?.id ?? null,
        answers: mergedAnswers,
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

    const payload: Record<string, unknown> = {
      ...stored,
      submitted_at: submittedAt,
      answers: mergedAnswers,
      questionnaire_clarification_id: insertedClar.id,
      follow_up_round_completed_at: submittedAt,
      critical_follow_up_questions: [],
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
      post_round: {
        score_before:
          typeof stored.score_before_clarifications === "number"
            ? stored.score_before_clarifications
            : finalizedEval.overall_quality_score,
        score_after:
          typeof stored.score_after_clarifications === "number"
            ? stored.score_after_clarifications
            : finalizedEval.overall_quality_score,
        dimension_improvement_notes: Array.isArray(
          stored.dimension_improvement_notes,
        )
          ? stored.dimension_improvement_notes
          : [],
        critical_follow_up_questions: [],
      },
    });
  }

  const answers = initialAnswers;
  if (!answers || answers.length === 0) {
    return NextResponse.json(
      { error: "Faltan respuestas de aclaración." },
      { status: 400 },
    );
  }

  const v = validateClarificationAnswersAgainstQuestions(
    finalizedEval.clarification_questions,
    answers,
  );
  if (!v.ok) {
    return NextResponse.json({ error: v.message }, { status: 400 });
  }

  const { data: insertedClar, error: insertClarError } =
    await insertQuestionnaireClarification(supabase, {
      project_id: projectId,
      user_id: user.id,
      evaluation_id: activeEval?.id ?? null,
      answers,
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

  const clarBlock = formatClarificationAnswersForEvaluationPrompt(
    finalizedEval.clarification_questions,
    answers,
  );

  let postRound: QuestionnaireEvaluationPayload | null = null;
  let postRoundModel: string | null = null;
  const reEval = await runQuestionnaireEvaluationOnce({
    project_summary,
    responses,
    post_clarification_block: clarBlock,
  });
  if (reEval.ok) {
    postRound = reEval.evaluation;
    postRoundModel = reEval.model_used;
  }

  const scoreBefore = finalizedEval.overall_quality_score;
  const scoreAfter = postRound?.overall_quality_score ?? scoreBefore;

  const dimensionNotes =
    postRound !== null
      ? buildPostClarificationDimensionNotes(finalizedEval, postRound)
      : [];

  let critical_follow_up_questions: ClarificationQuestion[] = [];
  if (postRound !== null && scoreAfter < 80) {
    critical_follow_up_questions = clipClarificationQuestionsToScoreCap(
      postRound.clarification_questions,
      postRound.overall_quality_score,
    ).slice(0, 2);
  }

  const payload: Record<string, unknown> = {
    submitted_at: submittedAt,
    answers,
    evaluation_overall_score_snapshot: scoreBefore,
    evaluation_recommended_action_snapshot: finalizedEval.recommended_next_action,
    questionnaire_clarification_id: insertedClar.id,
    score_before_clarifications: scoreBefore,
    score_after_clarifications: scoreAfter,
    post_round_evaluation: postRound ?? undefined,
    post_round_model_used: postRoundModel ?? undefined,
    dimension_improvement_notes: dimensionNotes,
    critical_follow_up_questions,
    client_generation_caution:
      parsedBody.data.client_generation_caution?.trim() || undefined,
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
    post_round: {
      score_before: scoreBefore,
      score_after: scoreAfter,
      dimension_improvement_notes: dimensionNotes,
      critical_follow_up_questions,
      re_evaluated: postRound !== null,
    },
  });
}
