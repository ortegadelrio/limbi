import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import { isGuidedIntakePilotEnabled } from "@/lib/intake/guided-intake-flag";
import {
  GUIDED_CHALLENGE_PICKS,
  questionForMiniStep,
  type GuidedMiniStepId,
} from "@/lib/intake/guided-interview-flow";

const CHALLENGE_TYPE_PICK_ENUM = [
  "product",
  "service",
  "brand",
  "event",
  "project_venture",
  "corporate_communication",
  "personal_brand",
] as const;
import {
  advanceMiniStepFrom,
  appendTurn,
  buildStrategicInterviewSystemPrompt,
  buildStrategicInterviewUserPrompt,
  buildSyntheticExtractionForChip,
  coerceLegacyTraceForStrategicInterview,
  computeTraceAfterStrategicLlmExtraction,
  initialTrace,
  LIMBIC_INTERVIEW_TRACE_KEY,
  readInterviewTrace,
  type LimbicInterviewTraceV1,
} from "@/lib/intake/orchestrator";
import type { PilotEscapeChipId } from "@/lib/intake/question-bank";
import {
  applyStrategicInterviewExtraction,
  buildEvidenceUncertaintyDeterministicExtraction,
  collectSatisfiedWizardIndices,
  evidenceBaseNoClearPatch,
  GUIDED_INTAKE_AUDIENCE_PENDING_LIM,
  responsesWithAudienceWizardFieldsCleared,
} from "@/lib/intake/strategic-interview-apply";
import { buildStrategicInterviewPilotSummary } from "@/lib/intake/strategic-interview-summary";
import {
  buildClarificationSyntheticExtraction,
  buildClarificationTurnContent,
  traceForLlmProcessing,
} from "@/lib/intake/guided-intake-clarification";
import { resolveGuidedIntakeTurn } from "@/lib/intake/conversational-engine";
import type { TurnDecision } from "@/lib/intake/conversational-engine/types";
import {
  applyDecisionStatusPatches,
  detectExplicitProceedWithPendingSummary,
  miniStepToStrategicTopicKey,
  pilotSummaryBlockedByDecisionStates,
} from "@/lib/intake/decision-state";
import {
  buildAudienceConfirmMergeAndExtraction,
  buildAudienceDeclineInvertRepromptTurnContent,
  buildAudienceExplicitUnclearWhilePendingExtraction,
  buildAudiencePendingAmbiguousTurnContent,
  buildAudienceRejectPriorityTurnContent,
  buildAudienceSecondaryInvertOfferTurnContent,
  buildStrategicValidationSyntheticExtraction,
  buildStrategicValidationTurnContent,
  stripAudienceRecommendationPending,
  swapPendingPrimarySecondary,
} from "@/lib/intake/guided-intake-strategic-validation";
import { resolveGuidedIntakeExtraction } from "@/lib/intake/guided-intake-extraction-recovery";
import { generateGuidedIntakeExtractionJson } from "@/lib/openai/guided-intake-extraction";
import { deepMergeResponses } from "@/lib/utils/deep-merge";
import { mergeCompletedStepsForWizardStepIndices } from "@/lib/wizard/visible-moments";

type Params = { params: Promise<{ projectId: string }> };

const bodySchema = z
  .object({
    text: z.string().max(12000).optional(),
    action: z.enum(["no_information"]).optional(),
    challenge_type_pick: z.enum(CHALLENGE_TYPE_PICK_ENUM).optional(),
    challenge_type_other: z.literal(true).optional(),
  })
  .refine(
    (d) =>
      d.challenge_type_pick !== undefined ||
      d.challenge_type_other === true ||
      (typeof d.text === "string" && d.text.trim().length > 0) ||
      d.action !== undefined,
    { message: "Envía texto, una acción o la elección de tipo de reto." },
  )
  .refine(
    (d) =>
      !(d.challenge_type_pick !== undefined && d.challenge_type_other === true),
    { message: "Elige un tipo de reto u “Otro”, no ambos." },
  );

function readStrategicBase(
  r: Record<string, unknown>,
): Record<string, unknown> {
  const sb = r.strategic_base;
  if (sb && typeof sb === "object" && !Array.isArray(sb)) {
    return { ...(sb as Record<string, unknown>) };
  }
  return {};
}

function readAudienceBase(r: Record<string, unknown>): Record<string, unknown> {
  const ab = r.audience_base;
  if (ab && typeof ab === "object" && !Array.isArray(ab)) {
    return { ...(ab as Record<string, unknown>) };
  }
  return {};
}

function readEvidenceBase(r: Record<string, unknown>): Record<string, unknown> {
  const eb = r.evidence_base;
  if (eb && typeof eb === "object" && !Array.isArray(eb)) {
    return { ...(eb as Record<string, unknown>) };
  }
  return {};
}

function normalizeCompletedSteps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

const GUIDED_STRATEGIC_FIELD_PENDING = "guided_intake:strategic_field_pending";

function applyEngineDecisionPatchesToTrace(
  tr: LimbicInterviewTraceV1,
  engine: TurnDecision,
): LimbicInterviewTraceV1 {
  if (!engine.decision_status_updates.length) return tr;
  return {
    ...tr,
    decision_states: applyDecisionStatusPatches(
      tr.decision_states,
      engine.decision_status_updates,
      new Date().toISOString(),
    ),
  };
}

function appendStrategicConfirmationTriad(
  message: string,
  engine: TurnDecision,
): string {
  if (engine.requires_confirmation && engine.confirmation_options?.length) {
    return `${message.trim()}\n\n${engine.confirmation_options.join("\n")}`.trim();
  }
  return message.trim();
}

function mergeTraceIntoResponses(
  mergedWithoutTrace: Record<string, unknown>,
  nextTrace: LimbicInterviewTraceV1,
): Record<string, unknown> {
  return deepMergeResponses(mergedWithoutTrace, {
    [LIMBIC_INTERVIEW_TRACE_KEY]: nextTrace,
  });
}

function pickAcknowledgmentLabel(
  pick: z.infer<typeof bodySchema>["challenge_type_pick"],
  other: boolean,
): string {
  if (other) return "este reto";
  const row = GUIDED_CHALLENGE_PICKS.find((p) => p.pick === pick);
  return row?.label.toLowerCase() ?? "este reto";
}

export async function POST(request: Request, { params }: Params) {
  if (!isGuidedIntakePilotEnabled()) {
    return NextResponse.json(
      { error: "Entrevista guiada desactivada." },
      { status: 404 },
    );
  }

  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, challenge_type")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return jsonNotFound();
  }

  const { data: existing, error: fetchError } = await supabase
    .from("project_responses")
    .select("id, responses, completed_steps")
    .eq("project_id", projectId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const baseResponses: Record<string, unknown> =
    existing?.responses &&
    typeof existing.responses === "object" &&
    existing.responses !== null &&
    !Array.isArray(existing.responses)
      ? { ...(existing.responses as Record<string, unknown>) }
      : {};

  const traceFromDb = coerceLegacyTraceForStrategicInterview(
    readInterviewTrace(baseResponses) ?? initialTrace(),
  );
  const trace = traceForLlmProcessing(traceFromDb);

  if (traceFromDb.phase === "done" && traceFromDb.mini_step === "complete") {
    return NextResponse.json(
      { error: "Esta entrevista piloto ya está cerrada." },
      { status: 400 },
    );
  }

  const miniStep: GuidedMiniStepId = traceFromDb.mini_step ?? "challenge_type";
  let projectChallengeType =
    typeof project.challenge_type === "string" ? project.challenge_type : null;
  const otherChallenge = Boolean(trace.other_challenge);

  let extraction!: import("@/lib/intake/extraction-schema").IntakeExtractionOutput;
  let nextTrace: LimbicInterviewTraceV1 = traceFromDb;
  let mergedWithoutTrace: Record<string, unknown> = baseResponses;
  let interviewerMessage: string | null = null;
  let nextQuestion: string | null = null;

  const userLine =
    parsedBody.data.action !== undefined
      ? `[Acción del usuario: ${parsedBody.data.action}]`
      : (parsedBody.data.text ?? "").trim();

  /** --- Challenge type pick (no LLM) --- */
  if (
    parsedBody.data.challenge_type_pick !== undefined ||
    parsedBody.data.challenge_type_other === true
  ) {
    if (miniStep !== "challenge_type") {
      return NextResponse.json(
        { error: "El tipo de reto ya quedó registrado." },
        { status: 400 },
      );
    }

    const other = parsedBody.data.challenge_type_other === true;
    const pick = parsedBody.data.challenge_type_pick;

    const updateProject: { challenge_type: string | null } = other
      ? { challenge_type: null }
      : { challenge_type: pick! };

    const { error: patchProjectError } = await supabase
      .from("projects")
      .update(updateProject)
      .eq("id", projectId);

    if (patchProjectError) {
      return NextResponse.json(
        { error: patchProjectError.message },
        { status: 500 },
      );
    }

    projectChallengeType = updateProject.challenge_type;

    const label = pickAcknowledgmentLabel(pick, other);
    interviewerMessage = `Perfecto: vamos a trabajar ${other ? "un reto que definiremos juntos" : `un ${label}`}.`;

    nextTrace = {
      ...traceFromDb,
      pilot_id: "strategic_interview_v1",
      mini_step: "tailored_what",
      phase: "main",
      follow_up_used: false,
      other_challenge: other || undefined,
    };
    nextTrace = appendTurn(nextTrace, "user", userLine.slice(0, 500));
    nextTrace = appendTurn(
      nextTrace,
      "assistant",
      interviewerMessage.slice(0, 500),
    );

    mergedWithoutTrace = baseResponses;
    extraction = {
      extracted_response_updates: {},
      confidence_by_field: {},
      needs_follow_up: false,
      follow_up_question: null,
      suggested_answer_chips: [],
      answer_status: "clear",
      target_response_paths: [],
      internal_notes: "challenge_type_pick",
      interviewer_message: interviewerMessage,
      public_copy_allowed: false,
      user_intent: "answer",
    };

    nextQuestion = questionForMiniStep(
      "tailored_what",
      projectChallengeType,
      other,
    );
  } else if (parsedBody.data.action !== undefined) {
    /** --- Escape chip: never blocks; advance one mini-step --- */
    const sbForLim = readStrategicBase(baseResponses);
    const prevLim = Array.isArray(sbForLim.guided_intake_limitations_optional)
      ? (sbForLim.guided_intake_limitations_optional as unknown[]).filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        )
      : [];
    extraction = buildSyntheticExtractionForChip(
      parsedBody.data.action as PilotEscapeChipId,
      prevLim,
    );

    let mergedChip = applyStrategicInterviewExtraction(
      baseResponses,
      extraction,
    ).mergedResponses;

    if (miniStep === "evidence") {
      mergedChip = deepMergeResponses(mergedChip, {
        evidence_base: evidenceBaseNoClearPatch(),
      });
    }

    if (miniStep === "audience") {
      const sbChip = readStrategicBase(mergedChip);
      const limArr = Array.isArray(sbChip.guided_intake_limitations_optional)
        ? (sbChip.guided_intake_limitations_optional as unknown[]).filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0,
          )
        : [];
      if (!limArr.includes(GUIDED_INTAKE_AUDIENCE_PENDING_LIM)) {
        mergedChip = deepMergeResponses(mergedChip, {
          strategic_base: {
            ...sbChip,
            guided_intake_limitations_optional: [
              ...limArr,
              GUIDED_INTAKE_AUDIENCE_PENDING_LIM,
            ],
          },
        });
      }
    }

    mergedWithoutTrace = mergedChip;
    nextTrace = appendTurn(traceFromDb, "user", userLine.slice(0, 500));
    nextTrace = appendTurn(
      nextTrace,
      "assistant",
      extraction.interviewer_message.slice(0, 500),
    );
    nextTrace = advanceMiniStepFrom(nextTrace);

    nextQuestion =
      nextTrace.mini_step === "complete"
        ? null
        : questionForMiniStep(
            nextTrace.mini_step ?? "challenge_type",
            projectChallengeType,
            otherChallenge,
          );
    interviewerMessage = extraction.interviewer_message;
  } else {
    /** --- LLM extraction for current mini-step --- */
    if (miniStep === "challenge_type") {
      return NextResponse.json(
        { error: "Primero elige el tipo de reto." },
        { status: 400 },
      );
    }

    const userTextRaw = (parsedBody.data.text ?? "").trim();
    const sbSnap = readStrategicBase(baseResponses);

    let wantsFollowUp = false;
    let shouldNotAdvance = false;

    const engineTurn = resolveGuidedIntakeTurn({
      userText: userTextRaw,
      miniStep,
      trace: traceFromDb,
    });

    const pendingAudience = traceFromDb.audience_recommendation_pending;
    if (engineTurn.notes_for_route.branch === "pending_audience_confirmation") {
      const replyKind = engineTurn.notes_for_route.pendingAudienceReplyKind!;

      if (replyKind === "restart_strategic_audience") {
        mergedWithoutTrace = baseResponses;
        const cleared = stripAudienceRecommendationPending(traceFromDb);
        const content = buildStrategicValidationTurnContent({
          miniStep: "audience",
          userText: userTextRaw,
          challengeType: projectChallengeType,
          otherChallenge,
          strategicBase: sbSnap,
          traceUserTurns: traceFromDb.turns,
        });
        const nq = content.next_question?.trim();
        const im = nq
          ? `${content.interviewer_message.trim()}\n\n${nq}`.trim()
          : content.interviewer_message.trim();
        extraction = buildStrategicValidationSyntheticExtraction({
          interviewer_message: im,
          next_question: null,
          suggested_chips: content.suggested_chips,
          audience_recommendation_pending: content.audience_recommendation_pending,
        });
        shouldNotAdvance = true;
        wantsFollowUp = false;
        interviewerMessage = im;
        nextQuestion = null;
        let baseForTrace: LimbicInterviewTraceV1 = {
          ...cleared,
          phase: "strategy_validation",
          mini_step: "audience",
        };
        if (content.audience_recommendation_pending) {
          baseForTrace = {
            ...baseForTrace,
            audience_recommendation_pending: content.audience_recommendation_pending,
          };
        }
        nextTrace = appendTurn(
          appendTurn(baseForTrace, "user", userLine.slice(0, 500)),
          "assistant",
          extraction.interviewer_message.slice(0, 500),
        );
      } else if (replyKind === "explicit_unclear") {
        const ex = buildAudienceExplicitUnclearWhilePendingExtraction({
          strategicBase: sbSnap,
        });
        let mr = applyStrategicInterviewExtraction(baseResponses, ex).mergedResponses;
        mr = responsesWithAudienceWizardFieldsCleared(mr);
        mergedWithoutTrace = mr;
        extraction = ex;
        shouldNotAdvance = false;
        wantsFollowUp = false;
        const cleared = stripAudienceRecommendationPending(traceFromDb);
        let t1 = appendTurn(
          { ...cleared, phase: "main", mini_step: miniStep },
          "user",
          userLine.slice(0, 500),
        );
        t1 = appendTurn(t1, "assistant", ex.interviewer_message.slice(0, 500));
        nextTrace = advanceMiniStepFrom(t1);
        interviewerMessage = ex.interviewer_message;
        nextQuestion =
          nextTrace.mini_step === "complete"
            ? null
            : questionForMiniStep(
                nextTrace.mini_step ?? "challenge_type",
                projectChallengeType,
                otherChallenge,
              );
      } else if (replyKind === "confirm") {
        const pendingForMerge = engineTurn.notes_for_route.swapPrimarySecondary
          ? swapPendingPrimarySecondary(pendingAudience!)
          : pendingAudience!;
        const { mergedResponses: mr, extraction: ex } =
          buildAudienceConfirmMergeAndExtraction(baseResponses, pendingForMerge);
        mergedWithoutTrace = mr;
        extraction = ex;
        shouldNotAdvance = false;
        wantsFollowUp = false;
        const cleared = stripAudienceRecommendationPending(traceFromDb);
        let t1 = appendTurn(
          { ...cleared, phase: "main", mini_step: miniStep },
          "user",
          userLine.slice(0, 500),
        );
        t1 = appendTurn(t1, "assistant", ex.interviewer_message.slice(0, 500));
        nextTrace = advanceMiniStepFrom(t1);
        interviewerMessage = ex.interviewer_message;
        nextQuestion =
          nextTrace.mini_step === "complete"
            ? null
            : questionForMiniStep(
                nextTrace.mini_step ?? "challenge_type",
                projectChallengeType,
                otherChallenge,
              );
      } else if (replyKind === "secondary_emphasis_invert_prompt") {
        mergedWithoutTrace = baseResponses;
        const amb = buildAudienceSecondaryInvertOfferTurnContent(pendingAudience!);
        extraction = buildStrategicValidationSyntheticExtraction(amb);
        shouldNotAdvance = true;
        wantsFollowUp = false;
        interviewerMessage = amb.interviewer_message;
        nextQuestion = amb.next_question;
        nextTrace = appendTurn(
          appendTurn(
            {
              ...traceFromDb,
              phase: "strategy_validation",
              mini_step: miniStep,
              audience_recommendation_pending: amb.audience_recommendation_pending ?? undefined,
            },
            "user",
            userLine.slice(0, 500),
          ),
          "assistant",
          extraction.interviewer_message.slice(0, 500),
        );
      } else if (replyKind === "decline_invert_reprompt") {
        mergedWithoutTrace = baseResponses;
        const amb = buildAudienceDeclineInvertRepromptTurnContent(pendingAudience!);
        extraction = buildStrategicValidationSyntheticExtraction(amb);
        shouldNotAdvance = true;
        wantsFollowUp = false;
        interviewerMessage = amb.interviewer_message;
        nextQuestion = amb.next_question;
        nextTrace = appendTurn(
          appendTurn(
            {
              ...traceFromDb,
              phase: "strategy_validation",
              mini_step: miniStep,
              audience_recommendation_pending: amb.audience_recommendation_pending ?? undefined,
            },
            "user",
            userLine.slice(0, 500),
          ),
          "assistant",
          extraction.interviewer_message.slice(0, 500),
        );
      } else if (replyKind === "reject_priority") {
        mergedWithoutTrace = baseResponses;
        const amb = buildAudienceRejectPriorityTurnContent(pendingAudience!);
        extraction = buildStrategicValidationSyntheticExtraction(amb);
        shouldNotAdvance = true;
        wantsFollowUp = false;
        interviewerMessage = amb.interviewer_message;
        nextQuestion = amb.next_question;
        const cleared = stripAudienceRecommendationPending(traceFromDb);
        nextTrace = appendTurn(
          appendTurn(
            { ...cleared, phase: "strategy_validation", mini_step: miniStep },
            "user",
            userLine.slice(0, 500),
          ),
          "assistant",
          extraction.interviewer_message.slice(0, 500),
        );
      } else {
        mergedWithoutTrace = baseResponses;
        const amb = buildAudiencePendingAmbiguousTurnContent({
          pending: pendingAudience!,
          challengeType: projectChallengeType,
          otherChallenge,
        });
        extraction = buildStrategicValidationSyntheticExtraction(amb);
        shouldNotAdvance = true;
        wantsFollowUp = false;
        interviewerMessage = amb.interviewer_message;
        nextQuestion = amb.next_question;
        nextTrace = appendTurn(
          appendTurn(
            {
              ...traceFromDb,
              phase: "strategy_validation",
              mini_step: miniStep,
              audience_recommendation_pending: pendingAudience,
            },
            "user",
            userLine.slice(0, 500),
          ),
          "assistant",
          extraction.interviewer_message.slice(0, 500),
        );
      }
    }

    if (engineTurn.notes_for_route.branch === "evidence_return_to_audience") {
      mergedWithoutTrace = baseResponses;
      const content = buildStrategicValidationTurnContent({
        miniStep: "audience",
        userText: userTextRaw,
        challengeType: projectChallengeType,
        otherChallenge,
        strategicBase: sbSnap,
        traceUserTurns: traceFromDb.turns,
      });
      const bridge = "Claro. Antes de seguir con evidencia, resolvamos la audiencia.\n\n";
      const nq = content.next_question?.trim();
      const body = nq
        ? `${content.interviewer_message.trim()}\n\n${nq}`.trim()
        : content.interviewer_message.trim();
      let fullMessage = `${bridge}${body}`.trim();
      fullMessage = appendStrategicConfirmationTriad(fullMessage, engineTurn);
      extraction = buildStrategicValidationSyntheticExtraction({
        interviewer_message: fullMessage,
        next_question: null,
        suggested_chips: content.suggested_chips,
        audience_recommendation_pending: content.audience_recommendation_pending,
      });
      shouldNotAdvance = true;
      wantsFollowUp = false;
      interviewerMessage = fullMessage;
      nextQuestion = null;
      let baseForTrace: LimbicInterviewTraceV1 = {
        ...stripAudienceRecommendationPending(traceFromDb),
        phase: "strategy_validation",
        mini_step: "audience",
      };
      if (content.audience_recommendation_pending) {
        baseForTrace = {
          ...baseForTrace,
          audience_recommendation_pending: content.audience_recommendation_pending,
        };
      }
      nextTrace = appendTurn(
        appendTurn(baseForTrace, "user", userLine.slice(0, 500)),
        "assistant",
        extraction.interviewer_message.slice(0, 500),
      );
    }

    if (engineTurn.notes_for_route.branch === "strategic_topic_reroute") {
      const targetMs = engineTurn.notes_for_route.rerouteTargetTopic!;
      mergedWithoutTrace = baseResponses;
      const content = buildStrategicValidationTurnContent({
        miniStep: targetMs,
        userText: userTextRaw,
        challengeType: projectChallengeType,
        otherChallenge,
        strategicBase: sbSnap,
        traceUserTurns: traceFromDb.turns,
      });
      const topicWord =
        targetMs === "audience"
          ? "la audiencia"
          : targetMs === "evidence"
            ? "la evidencia"
            : targetMs === "problem"
              ? "el problema o la tensión"
              : "el beneficio o la transformación";
      const bridge = `De acuerdo. Antes de seguir, retomemos ${topicWord}.\n\n`;
      const nq = content.next_question?.trim();
      const body = nq
        ? `${content.interviewer_message.trim()}\n\n${nq}`.trim()
        : content.interviewer_message.trim();
      let fullMessage = `${bridge}${body}`.trim();
      fullMessage = appendStrategicConfirmationTriad(fullMessage, engineTurn);
      extraction = buildStrategicValidationSyntheticExtraction({
        interviewer_message: fullMessage,
        next_question: null,
        suggested_chips: content.suggested_chips,
        audience_recommendation_pending: content.audience_recommendation_pending,
      });
      shouldNotAdvance = true;
      wantsFollowUp = false;
      interviewerMessage = fullMessage;
      nextQuestion = null;
      let baseForTrace: LimbicInterviewTraceV1 = {
        ...stripAudienceRecommendationPending(traceFromDb),
        phase: "strategy_validation",
        mini_step: targetMs,
      };
      if (content.audience_recommendation_pending) {
        baseForTrace = {
          ...baseForTrace,
          audience_recommendation_pending: content.audience_recommendation_pending,
        };
      }
      nextTrace = appendTurn(
        appendTurn(baseForTrace, "user", userLine.slice(0, 500)),
        "assistant",
        extraction.interviewer_message.slice(0, 500),
      );
    }

    if (engineTurn.notes_for_route.branch === "evidence_uncertainty_advance") {
      extraction = buildEvidenceUncertaintyDeterministicExtraction({
        strategicBase: sbSnap,
      });
      mergedWithoutTrace = applyStrategicInterviewExtraction(
        baseResponses,
        extraction,
      ).mergedResponses;
      shouldNotAdvance = false;
      wantsFollowUp = false;
      const turn = computeTraceAfterStrategicLlmExtraction({ trace, extraction });
      let t1 = appendTurn(turn.nextTrace, "user", userLine.slice(0, 500));
      t1 = appendTurn(t1, "assistant", extraction.interviewer_message.slice(0, 500));
      nextTrace = t1;
      interviewerMessage = extraction.interviewer_message;
      nextQuestion =
        nextTrace.mini_step === "complete"
          ? null
          : questionForMiniStep(
              nextTrace.mini_step ?? "challenge_type",
              projectChallengeType,
              otherChallenge,
            );
    }

    const resumeAfterClarification =
      traceFromDb.phase === "clarifying_question" ||
      traceFromDb.phase === "strategy_validation" ||
      Boolean(traceFromDb.audience_recommendation_pending);

    const offeringHint =
      typeof sbSnap.offering_type === "string" ? sbSnap.offering_type : null;

    const runStrategicHandlerBranch =
      !engineTurn.skip_llm_extraction ||
      engineTurn.notes_for_route.branch === "active_strategic_doubt" ||
      engineTurn.notes_for_route.branch === "provisional_decision_resolution";

    if (runStrategicHandlerBranch) {
      const llmMiniStep = engineTurn.notes_for_route.overrideMiniStep ?? miniStep;
      const traceForExtraction = traceForLlmProcessing({
        ...traceFromDb,
        mini_step: llmMiniStep,
      });

      const system = buildStrategicInterviewSystemPrompt({
        challengeType: projectChallengeType,
        offeringTypeHint: offeringHint,
        miniStep: llmMiniStep,
        otherChallenge,
      });
      const schemaHint = `Required JSON shape:
{
  "extracted_response_updates": { "strategic_base": { }, "audience_base": { }, "evidence_base": { } },
  "confidence_by_field": { },
  "needs_follow_up": boolean,
  "follow_up_question": string | null,
  "suggested_answer_chips": string[],
      "answer_status": "clear" | "weak" | "missing_choice" | "skipped" | "fallback_saved",
  "target_response_paths": string[],
  "internal_notes": string,
  "interviewer_message": string,
  "public_copy_allowed": boolean,
  "user_intent": "answer" | "clarification_question" | "strategic_validation_question" | "skip"
}`;

      const userPrompt = buildStrategicInterviewUserPrompt({
        trace: traceForExtraction,
        userText: userLine,
        strategicBaseSnapshot: sbSnap,
        audienceBaseSnapshot: readAudienceBase(baseResponses),
        evidenceBaseSnapshot: readEvidenceBase(baseResponses),
        resumeAfterClarification,
      });

      const prevLimForExtraction = Array.isArray(
        sbSnap.guided_intake_limitations_optional,
      )
        ? (sbSnap.guided_intake_limitations_optional as unknown[]).filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0,
          )
        : [];

      const applyClarificationTurn = () => {
        const content = buildClarificationTurnContent({
          miniStep,
          challengeType: projectChallengeType,
          otherChallenge,
        });
        extraction = buildClarificationSyntheticExtraction(content);
        mergedWithoutTrace = baseResponses;
        shouldNotAdvance = true;
        wantsFollowUp = false;
        const nq = content.next_question?.trim();
        interviewerMessage = nq
          ? `${content.interviewer_message.trim()}\n\n${nq}`.trim()
          : content.interviewer_message.trim();
        nextQuestion = null;
        nextTrace = appendTurn(
          appendTurn(
            {
              ...traceFromDb,
              phase: "clarifying_question",
              mini_step: miniStep,
            },
            "user",
            userLine.slice(0, 500),
          ),
          "assistant",
          extraction.interviewer_message.slice(0, 500),
        );
      };

      const applyStrategicValidationTurn = () => {
        const content = buildStrategicValidationTurnContent({
          miniStep,
          userText: userTextRaw,
          challengeType: projectChallengeType,
          otherChallenge,
          strategicBase: sbSnap,
          traceUserTurns: traceFromDb.turns,
        });
        extraction = buildStrategicValidationSyntheticExtraction(content);
        mergedWithoutTrace = baseResponses;
        shouldNotAdvance = true;
        wantsFollowUp = false;
        const nq = content.next_question?.trim();
        interviewerMessage = nq
          ? `${content.interviewer_message.trim()}\n\n${nq}`.trim()
          : content.interviewer_message.trim();
        interviewerMessage = appendStrategicConfirmationTriad(
          interviewerMessage,
          engineTurn,
        );
        extraction = {
          ...extraction,
          interviewer_message: interviewerMessage,
        };
        nextQuestion = null;
        let baseForTrace: LimbicInterviewTraceV1 = {
          ...traceFromDb,
          phase: "strategy_validation",
          mini_step: miniStep,
        };
        if (content.audience_recommendation_pending) {
          baseForTrace = {
            ...baseForTrace,
            audience_recommendation_pending:
              content.audience_recommendation_pending,
          };
        } else {
          baseForTrace = stripAudienceRecommendationPending(baseForTrace);
        }
        nextTrace = appendTurn(
          appendTurn(baseForTrace, "user", userLine.slice(0, 500)),
          "assistant",
          extraction.interviewer_message.slice(0, 500),
        );
      };

      if (engineTurn.notes_for_route.branch === "provisional_decision_resolution") {
        const choice = engineTurn.notes_for_route.provisionalChoice!;
        if (choice === "change_priority") {
          applyStrategicValidationTurn();
        } else if (choice === "leave_pending") {
          const topicKey = miniStepToStrategicTopicKey(miniStep);
          const lim =
            topicKey === "audience"
              ? GUIDED_INTAKE_AUDIENCE_PENDING_LIM
              : GUIDED_STRATEGIC_FIELD_PENDING;
          const nextLim = prevLimForExtraction.includes(lim)
            ? prevLimForExtraction
            : [...prevLimForExtraction, lim];
          extraction = {
            extracted_response_updates: {
              strategic_base: {
                ...sbSnap,
                guided_intake_limitations_optional: nextLim,
              },
            },
            confidence_by_field: {},
            needs_follow_up: false,
            follow_up_question: null,
            suggested_answer_chips: [],
            answer_status: "missing_choice",
            target_response_paths: [
              "strategic_base.guided_intake_limitations_optional",
            ],
            internal_notes: "provisional_decision_leave_pending",
            interviewer_message:
              "Entendido. Dejo esta decisión estratégica como pendiente para no asumir algo que todavía no está cerrado. Seguimos con el flujo y lo podremos revisar después.",
            public_copy_allowed: false,
            user_intent: "answer",
          };
          mergedWithoutTrace = applyStrategicInterviewExtraction(
            baseResponses,
            extraction,
          ).mergedResponses;
          shouldNotAdvance = false;
          wantsFollowUp = false;
          let t1 = appendTurn(
            { ...traceFromDb, phase: "main", mini_step: miniStep },
            "user",
            userLine.slice(0, 500),
          );
          t1 = appendTurn(
            t1,
            "assistant",
            extraction.interviewer_message.slice(0, 500),
          );
          nextTrace = advanceMiniStepFrom(t1);
          interviewerMessage = extraction.interviewer_message;
          nextQuestion =
            nextTrace.mini_step === "complete"
              ? null
              : questionForMiniStep(
                  nextTrace.mini_step ?? "challenge_type",
                  projectChallengeType,
                  otherChallenge,
                );
        } else {
          mergedWithoutTrace = baseResponses;
          extraction = {
            extracted_response_updates: {},
            confidence_by_field: {},
            needs_follow_up: false,
            follow_up_question: null,
            suggested_answer_chips: [],
            answer_status: "clear",
            target_response_paths: [],
            internal_notes: "provisional_decision_confirm",
            interviewer_message:
              "Perfecto. Tomo como confirmada esta dirección por ahora y seguimos.",
            public_copy_allowed: false,
            user_intent: "answer",
          };
          shouldNotAdvance = false;
          wantsFollowUp = false;
          let t1 = appendTurn(
            { ...traceFromDb, phase: "main", mini_step: miniStep },
            "user",
            userLine.slice(0, 500),
          );
          t1 = appendTurn(
            t1,
            "assistant",
            extraction.interviewer_message.slice(0, 500),
          );
          nextTrace = advanceMiniStepFrom(t1);
          interviewerMessage = extraction.interviewer_message;
          nextQuestion =
            nextTrace.mini_step === "complete"
              ? null
              : questionForMiniStep(
                  nextTrace.mini_step ?? "challenge_type",
                  projectChallengeType,
                  otherChallenge,
                );
        }
      } else if (
        engineTurn.notes_for_route.branch === "active_strategic_doubt" ||
        engineTurn.notes_for_route.branch === "deterministic_strategic_validation"
      ) {
        applyStrategicValidationTurn();
      } else if (engineTurn.notes_for_route.branch === "deterministic_clarification") {
        applyClarificationTurn();
      } else if (!engineTurn.skip_llm_extraction) {
        let resolved: Awaited<ReturnType<typeof resolveGuidedIntakeExtraction>>;
        try {
          resolved = await resolveGuidedIntakeExtraction({
            generate: generateGuidedIntakeExtractionJson,
            system,
            schemaHint,
            userPrompt,
            miniStep: llmMiniStep,
            challengeType: projectChallengeType,
            userText: userLine,
            prevLimitations: prevLimForExtraction,
          });
        } catch (e) {
          return NextResponse.json(
            {
              error:
                e instanceof Error
                  ? e.message
                  : "No se pudo contactar al modelo de entrevista.",
            },
            { status: 502 },
          );
        }
        extraction = resolved.extraction;

        if (extraction.needs_follow_up && traceForExtraction.follow_up_used) {
          extraction = {
            ...extraction,
            needs_follow_up: false,
            follow_up_question: null,
          };
        }

        const intent = extraction.user_intent ?? "answer";
        if (intent === "clarification_question") {
          applyClarificationTurn();
        } else if (intent === "strategic_validation_question") {
          applyStrategicValidationTurn();
        } else {
          const { mergedResponses: mergedFromEx } =
            applyStrategicInterviewExtraction(baseResponses, extraction);
          mergedWithoutTrace = mergedFromEx;

          const turn = computeTraceAfterStrategicLlmExtraction({
            trace: traceForExtraction,
            extraction,
          });
          nextTrace = turn.nextTrace;
          wantsFollowUp = turn.wantsFollowUp;

          nextTrace = appendTurn(nextTrace, "user", userLine.slice(0, 500));
          nextTrace = appendTurn(
            nextTrace,
            "assistant",
            (extraction.interviewer_message || extraction.internal_notes).slice(
              0,
              500,
            ),
          );

          if (
            engineTurn.notes_for_route.branch === "cross_topic_llm_extraction" &&
            engineTurn.notes_for_route.restoreMiniStepAfter &&
            !wantsFollowUp
          ) {
            nextTrace = {
              ...nextTrace,
              mini_step: engineTurn.notes_for_route.restoreMiniStepAfter,
              phase: "main",
              follow_up_used: false,
            };
          }

          interviewerMessage = extraction.interviewer_message || null;
          nextQuestion =
            nextTrace.mini_step === "complete"
              ? null
              : wantsFollowUp
                ? null
                : questionForMiniStep(
                    nextTrace.mini_step ?? "challenge_type",
                    projectChallengeType,
                    otherChallenge,
                  );
        }
      }
    }

    /** Merge completed_steps using extraction indices (LLM path only) */
    const prevCompleted = normalizeCompletedSteps(existing?.completed_steps);
    const nextCompleted = shouldNotAdvance
      ? prevCompleted
      : mergeCompletedStepsForWizardStepIndices(
          prevCompleted,
          [
            ...new Set([
              ...(projectChallengeType ? [1] : []),
              ...collectSatisfiedWizardIndices(mergedWithoutTrace),
            ]),
          ].sort((a, b) => a - b),
          { returnTo: null },
        );

    nextTrace = applyEngineDecisionPatchesToTrace(nextTrace, engineTurn);

    const mergedResponses = mergeTraceIntoResponses(
      mergedWithoutTrace,
      nextTrace,
    );

    const summaryBlockedByDecisions = pilotSummaryBlockedByDecisionStates(
      nextTrace.decision_states,
      {
        userExplicitProceed: detectExplicitProceedWithPendingSummary(userTextRaw),
      },
    );

    const summary =
      shouldNotAdvance || summaryBlockedByDecisions
        ? null
        : nextTrace.mini_step === "complete" && nextTrace.phase === "done"
          ? buildStrategicInterviewPilotSummary(
              mergedResponses,
              projectChallengeType,
              otherChallenge,
              extraction.confidence_by_field,
            )
          : null;

    if (!existing) {
      const { data: inserted, error: insertError } = await supabase
        .from("project_responses")
        .insert({
          project_id: projectId,
          user_id: user.id,
          responses: mergedResponses,
          completed_steps: nextCompleted,
        })
        .select("id, responses, completed_steps")
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 },
        );
      }

      return NextResponse.json({
        project_responses: inserted,
        extraction,
        trace: nextTrace,
        interviewer_message: interviewerMessage,
        next_question: nextQuestion,
        follow_up_question: wantsFollowUp
          ? extraction.follow_up_question
          : null,
        suggested_chips: extraction.suggested_answer_chips,
        summary,
        project_challenge_type: projectChallengeType,
        should_not_advance: shouldNotAdvance,
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from("project_responses")
      .update({
        responses: mergedResponses,
        completed_steps: nextCompleted,
      })
      .eq("id", existing.id)
      .select("id, responses, completed_steps")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      project_responses: updated,
      extraction,
      trace: nextTrace,
      interviewer_message: interviewerMessage,
      next_question: nextQuestion,
      follow_up_question: wantsFollowUp ? extraction.follow_up_question : null,
      suggested_chips: extraction.suggested_answer_chips,
      summary,
      project_challenge_type: projectChallengeType,
      should_not_advance: shouldNotAdvance,
    });
  }

  /** Pick & chip paths: merge trace + completed_steps */
  const mergedResponses = mergeTraceIntoResponses(
    mergedWithoutTrace,
    nextTrace,
  );

  const prevCompleted = normalizeCompletedSteps(existing?.completed_steps);
  const indicesFromData = collectSatisfiedWizardIndices(mergedResponses);
  const indicesChallenge = projectChallengeType ? [1] : [];
  const mergedIndices = [
    ...new Set([...indicesChallenge, ...indicesFromData]),
  ].sort((a, b) => a - b);
  const nextCompleted = mergeCompletedStepsForWizardStepIndices(
    prevCompleted,
    mergedIndices,
    { returnTo: null },
  );

  const summary =
    nextTrace.mini_step === "complete" && nextTrace.phase === "done"
      ? buildStrategicInterviewPilotSummary(
          mergedResponses,
          projectChallengeType,
          otherChallenge,
          extraction.confidence_by_field,
        )
      : null;

  if (!existing) {
    const { data: inserted, error: insertError } = await supabase
      .from("project_responses")
      .insert({
        project_id: projectId,
        user_id: user.id,
        responses: mergedResponses,
        completed_steps: nextCompleted,
      })
      .select("id, responses, completed_steps")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      project_responses: inserted,
      extraction,
      trace: nextTrace,
      interviewer_message: interviewerMessage,
      next_question: nextQuestion,
      follow_up_question: null,
      suggested_chips: extraction.suggested_answer_chips,
      summary,
      project_challenge_type: projectChallengeType,
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("project_responses")
    .update({
      responses: mergedResponses,
      completed_steps: nextCompleted,
    })
    .eq("id", existing.id)
    .select("id, responses, completed_steps")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    project_responses: updated,
    extraction,
    trace: nextTrace,
    interviewer_message: interviewerMessage,
    next_question: nextQuestion,
    follow_up_question: null,
    suggested_chips: extraction.suggested_answer_chips,
    summary,
    project_challenge_type: projectChallengeType,
  });
}
