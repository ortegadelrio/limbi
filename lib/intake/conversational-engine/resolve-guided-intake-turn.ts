import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import {
  detectDeterministicClarificationIntent,
  detectEvidenceUncertaintyWithoutMetaQuestion,
} from "@/lib/intake/guided-intake-clarification";
import {
  classifyPendingAudienceUserReply,
  detectDeterministicStrategicValidationIntent,
  detectReturnToAudienceTopicIntent,
  type PendingAudienceUserReply,
} from "@/lib/intake/guided-intake-strategic-validation";
import type { LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";
import type {
  ConversationalPendingState,
  ConversationalQuestionSurfaceType,
  ConversationalRenderPolicy,
  ConversationalUserIntent,
  ResolveGuidedIntakeTurnInput,
  TurnDecision,
  TurnDecisionNotesForRoute,
} from "@/lib/intake/conversational-engine/types";

function derivePendingState(
  trace: LimbicInterviewTraceV1,
  miniStep: GuidedMiniStepId,
): ConversationalPendingState {
  if (miniStep === "audience" && trace.audience_recommendation_pending?.version === 1) {
    return "pending_confirmation";
  }
  if (trace.phase === "follow_up") return "pending_follow_up";
  if (trace.phase === "clarifying_question") return "pending_clarification";
  if (trace.phase === "strategy_validation") return "pending_strategic_validation";
  return "none";
}

function mapPendingAudienceReplyToIntent(
  reply: PendingAudienceUserReply,
): ConversationalUserIntent {
  switch (reply.kind) {
    case "restart_strategic_audience":
      return "return_to_previous_topic";
    case "explicit_unclear":
      return "missing_information";
    case "confirm":
      return "confirmation";
    case "secondary_emphasis_invert_prompt":
    case "decline_invert_reprompt":
      return "strategic_validation_question";
    case "reject_priority":
      return "rejection";
    case "reprompt_confirmation":
      return "ambiguous_answer";
    default:
      return "unknown";
  }
}

function decisionForPendingAudience(
  input: ResolveGuidedIntakeTurnInput,
  reply: PendingAudienceUserReply,
): TurnDecision {
  const { miniStep, trace } = input;
  const notes: TurnDecisionNotesForRoute = {
    branch: "pending_audience_confirmation",
    pendingAudienceReplyKind: reply.kind,
    swapPrimarySecondary:
      reply.kind === "confirm" ? reply.swapPrimarySecondary : undefined,
  };

  const userIntent = mapPendingAudienceReplyToIntent(reply);

  let shouldAdvance = false;
  let writes = false;
  let nextMini: GuidedMiniStepId | null = null;
  let nextPhase: LimbicInterviewTraceV1["phase"] | null = null;
  let render: ConversationalRenderPolicy = "single_surface_no_competing_bank";
  let surface: ConversationalQuestionSurfaceType = "single_merged_assistant_turn";

  switch (reply.kind) {
    case "explicit_unclear":
    case "confirm":
      shouldAdvance = true;
      writes = true;
      nextPhase = "main";
      nextMini = "evidence";
      surface = "primary_bank";
      render = "default";
      break;
    case "restart_strategic_audience":
      shouldAdvance = false;
      writes = false;
      nextPhase = "strategy_validation";
      nextMini = "audience";
      surface = "single_merged_assistant_turn";
      break;
    default:
      shouldAdvance = false;
      writes = false;
      nextPhase = "strategy_validation";
      nextMini = miniStep;
      surface = "single_merged_assistant_turn";
      render = "single_surface_no_competing_bank";
      break;
  }

  return {
    user_intent: userIntent,
    pending_state: "pending_confirmation",
    action: "pending_audience_confirmation",
    current_mini_step: miniStep,
    next_mini_step: nextMini,
    current_phase: trace.phase,
    next_phase: nextPhase,
    should_advance: shouldAdvance,
    should_not_advance: !shouldAdvance,
    writes_to_responses: writes,
    writes_to_completed_steps: shouldAdvance,
    summary_allowed: false,
    render_policy: render,
    question_surface_type: surface,
    skip_llm_extraction: true,
    notes_for_route: notes,
  };
}

function baseLlmDecision(
  input: ResolveGuidedIntakeTurnInput,
  pendingState: ConversationalPendingState,
): TurnDecision {
  const { miniStep, trace } = input;
  return {
    user_intent: "answer",
    pending_state: pendingState,
    action: "llm_extraction",
    current_mini_step: miniStep,
    next_mini_step: null,
    current_phase: trace.phase,
    next_phase: null,
    should_advance: false,
    should_not_advance: false,
    writes_to_responses: true,
    writes_to_completed_steps: true,
    summary_allowed: false,
    render_policy: "default",
    question_surface_type: "primary_bank",
    skip_llm_extraction: false,
    notes_for_route: { branch: "llm_extraction" },
  };
}

/**
 * Limbi Conversational Engine v1 — Phase 1.
 * Pure: no I/O, no persistence. Encodes intent + pending priority for guided intake text turns.
 *
 * Priority (first match wins):
 * 1. pending_confirmation (trace-held audience recommendation contract)
 * 2. return_to_previous_topic from evidence → audience (before evidence body parsing)
 * 3. pending_missing_information on evidence (uncertainty without meta-question)
 * 4. deterministic strategic validation (not on evidence when 2 fired — return wins first)
 * 5. deterministic clarification
 * 6. answer → LLM extraction
 *
 * `pending_ambiguous_actor` / `pending_correction` / `off_topic` are reserved for later phases;
 * `pending_follow_up` / `pending_clarification` / `pending_strategic_validation` are surfaced in
 * `pending_state` for observability but this resolver still defers detailed handling to the route
 * unless a higher-priority branch fires.
 */
export function resolveGuidedIntakeTurn(
  input: ResolveGuidedIntakeTurnInput,
): TurnDecision {
  const { userText, miniStep, trace } = input;
  const pendingState = derivePendingState(trace, miniStep);

  if (miniStep === "audience" && trace.audience_recommendation_pending?.version === 1) {
    const reply = classifyPendingAudienceUserReply(
      userText,
      trace.audience_recommendation_pending,
    );
    return decisionForPendingAudience(input, reply);
  }

  if (miniStep === "evidence" && detectReturnToAudienceTopicIntent(userText)) {
    return {
      user_intent: "return_to_previous_topic",
      pending_state: "pending_return_to_topic",
      action: "evidence_return_to_audience",
      current_mini_step: miniStep,
      next_mini_step: "audience",
      current_phase: trace.phase,
      next_phase: "strategy_validation",
      should_advance: false,
      should_not_advance: true,
      writes_to_responses: false,
      writes_to_completed_steps: false,
      summary_allowed: false,
      render_policy: "single_surface_no_competing_bank",
      question_surface_type: "single_merged_assistant_turn",
      skip_llm_extraction: true,
      notes_for_route: { branch: "evidence_return_to_audience" },
    };
  }

  if (miniStep === "evidence" && detectEvidenceUncertaintyWithoutMetaQuestion(userText)) {
    return {
      user_intent: "missing_information",
      pending_state: "pending_missing_information",
      action: "evidence_uncertainty_advance",
      current_mini_step: miniStep,
      next_mini_step: null,
      current_phase: trace.phase,
      next_phase: "main",
      should_advance: true,
      should_not_advance: false,
      writes_to_responses: true,
      writes_to_completed_steps: true,
      summary_allowed: false,
      render_policy: "default",
      question_surface_type: "primary_bank",
      skip_llm_extraction: true,
      notes_for_route: { branch: "evidence_uncertainty_advance" },
    };
  }

  const deterministicStrategic =
    trace.phase !== "follow_up" &&
    detectDeterministicStrategicValidationIntent(userText, { miniStep });

  const deterministicClarification =
    !deterministicStrategic &&
    trace.phase !== "follow_up" &&
    detectDeterministicClarificationIntent(userText);

  if (deterministicStrategic) {
    return {
      user_intent: "strategic_validation_question",
      pending_state:
        pendingState === "none" ? "pending_strategic_validation" : pendingState,
      action: "deterministic_strategic_validation",
      current_mini_step: miniStep,
      next_mini_step: miniStep,
      current_phase: trace.phase,
      next_phase: "strategy_validation",
      should_advance: false,
      should_not_advance: true,
      writes_to_responses: false,
      writes_to_completed_steps: false,
      summary_allowed: false,
      render_policy: "single_surface_no_competing_bank",
      question_surface_type: "single_merged_assistant_turn",
      /** Route still enters the handler block; only the LLM sub-path is skipped. */
      skip_llm_extraction: false,
      notes_for_route: { branch: "deterministic_strategic_validation" },
    };
  }

  if (deterministicClarification) {
    return {
      user_intent: "clarification_question",
      pending_state:
        pendingState === "none" ? "pending_clarification" : pendingState,
      action: "deterministic_clarification",
      current_mini_step: miniStep,
      next_mini_step: miniStep,
      current_phase: trace.phase,
      next_phase: "clarifying_question",
      should_advance: false,
      should_not_advance: true,
      writes_to_responses: false,
      writes_to_completed_steps: false,
      summary_allowed: false,
      render_policy: "single_surface_no_competing_bank",
      question_surface_type: "single_merged_assistant_turn",
      skip_llm_extraction: false,
      notes_for_route: { branch: "deterministic_clarification" },
    };
  }

  return baseLlmDecision(input, pendingState);
}
