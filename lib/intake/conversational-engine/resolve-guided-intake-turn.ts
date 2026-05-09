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
import {
  detectEvidenceStepAudienceStakeholderInput,
  detectEvidenceStepPositioningClaim,
} from "@/lib/intake/guided-intake-evidence-input-classifier";
import {
  stripSegmentConfirmationPending,
  type LimbicInterviewTraceV1,
} from "@/lib/intake/orchestrator";
import {
  applyDecisionStatusPatches,
  detectExplicitProceedWithPendingSummary,
  miniStepToPilotSegmentKey,
  miniStepToStrategicTopicKey,
  pilotSummaryBlockedByDecisionStates,
  strategicTopicKeyToMiniStep,
  STRATEGIC_DECISION_CONFIRMATION_OPTIONS_ES,
  type DecisionStatusPatch,
} from "@/lib/intake/decision-state";
import { detectActiveStrategicDoubt } from "@/lib/intake/conversational-engine/active-strategic-doubt";
import { isBareAffirmationWithoutSubstance } from "@/lib/intake/conversational-engine/bare-confirmation";
import { classifyProvisionalDecisionFollowUp } from "@/lib/intake/conversational-engine/provisional-decision-reply";
import { detectStrategicHelpOrHowToRequest } from "@/lib/intake/conversational-engine/strategic-help-request";
import {
  classifyCrossTopicSurface,
  resolveCrossStrategicTopicReference,
} from "@/lib/intake/conversational-engine/strategic-topic-router";
import { classifySegmentConfirmationUserReply } from "@/lib/intake/segment-confirmation";
import { shouldResolveSegmentWhileCorrectionPending } from "@/lib/intake/segment-correction-mode";
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
  if (trace.phase === "segment_confirmation") return "pending_strategic_validation";
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

function patchesForPendingAudienceReply(
  reply: PendingAudienceUserReply,
): DecisionStatusPatch[] {
  switch (reply.kind) {
    case "confirm":
      return [
        {
          topic: "audience",
          status: "confirmed",
          confidence: 0.9,
          reason: "User confirmed proposed audience priority.",
          source: "guided_intake",
        },
      ];
    case "explicit_unclear":
      return [
        {
          topic: "audience",
          status: "pending",
          confidence: 0.35,
          reason: "User could not confirm audience priority yet.",
          source: "guided_intake",
        },
      ];
    case "restart_strategic_audience":
      return [
        {
          topic: "audience",
          status: "reopened",
          confidence: 0.55,
          reason: "User returned to refine audience.",
          source: "guided_intake",
        },
      ];
    case "reject_priority":
      return [
        {
          topic: "audience",
          status: "provisional",
          confidence: 0.5,
          reason: "User rejected proposed ordering; needs new priority.",
          source: "guided_intake",
        },
      ];
    case "secondary_emphasis_invert_prompt":
    case "decline_invert_reprompt":
    case "reprompt_confirmation":
      return [
        {
          topic: "audience",
          status: "provisional",
          confidence: 0.55,
          reason: "Awaiting explicit confirmation of audience priority.",
          source: "guided_intake",
        },
      ];
    default:
      return [];
  }
}

/** Input before computed `active_doubt_detected` / `can_show_summary`. */
type EngineTurnDraft = Omit<
  TurnDecision,
  "active_doubt_detected" | "can_show_summary" | "decision_status_updates"
> &
  Partial<
    Pick<TurnDecision, "active_doubt_detected" | "can_show_summary" | "decision_status_updates">
  >;

function finalizeEngineTurn(
  trace: LimbicInterviewTraceV1,
  userText: string,
  d: EngineTurnDraft,
): TurnDecision {
  const decision_status_updates = d.decision_status_updates ?? [];
  const at = new Date().toISOString();
  const projected = applyDecisionStatusPatches(
    trace.decision_states,
    decision_status_updates,
    at,
  );
  const strategicStep = Boolean(miniStepToStrategicTopicKey(d.current_mini_step));
  const activeDoubtsignal = detectActiveStrategicDoubt(userText);
  const active_doubt_detected =
    d.active_doubt_detected !== undefined
      ? d.active_doubt_detected
      : strategicStep &&
        activeDoubtsignal &&
        (d.user_intent === "strategic_validation_question" ||
          d.user_intent === "active_doubt");
  const explicitProceed = detectExplicitProceedWithPendingSummary(userText);
  const segKind = d.notes_for_route?.segmentConfirmationKind;
  const clearsSegmentConfirm =
    d.action === "segment_confirmation_resolve" &&
    (segKind === "confirm" || segKind === "pending_ack_confirm");
  const hasOpenSegmentConfirmation =
    Boolean(trace.segment_confirmation_pending) && !clearsSegmentConfirm;
  const can_show_summary = !pilotSummaryBlockedByDecisionStates(projected, {
    userExplicitProceed: explicitProceed,
    hasOpenSegmentConfirmation,
  });
  return {
    ...d,
    decision_status_updates,
    target_topic: d.target_topic ?? null,
    reopened_topic: d.reopened_topic ?? null,
    active_doubt_detected,
    can_show_summary,
    requires_confirmation: d.requires_confirmation ?? false,
    confirmation_options: d.confirmation_options ?? null,
  };
}

function decisionForPendingAudience(
  input: ResolveGuidedIntakeTurnInput,
  reply: PendingAudienceUserReply,
): TurnDecision {
  const { miniStep, trace, userText } = input;
  const notes: TurnDecisionNotesForRoute = {
    branch: "pending_audience_confirmation",
    pendingAudienceReplyKind: reply.kind,
    swapPrimarySecondary:
      reply.kind === "confirm" ? reply.swapPrimarySecondary : undefined,
  };

  const userIntent = mapPendingAudienceReplyToIntent(reply);
  const decision_status_updates = patchesForPendingAudienceReply(reply);

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

  return finalizeEngineTurn(trace, userText, {
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
    decision_status_updates,
    target_topic: reply.kind === "restart_strategic_audience" ? "audience" : null,
    reopened_topic: reply.kind === "restart_strategic_audience" ? "audience" : null,
    active_doubt_detected: false,
    requires_confirmation: false,
    confirmation_options: null,
  });
}

function baseLlmDecision(
  input: ResolveGuidedIntakeTurnInput,
  pendingState: ConversationalPendingState,
): TurnDecision {
  const { miniStep, trace, userText } = input;
  const topic = miniStepToStrategicTopicKey(miniStep);
  const patches: DecisionStatusPatch[] =
    topic && pendingState === "none"
      ? [
          {
            topic,
            status: "in_progress",
            confidence: 0.55,
            reason: "User answer routed to LLM extraction.",
            source: "guided_intake",
          },
        ]
      : [];
  return finalizeEngineTurn(trace, userText, {
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
    decision_status_updates: patches,
    active_doubt_detected: false,
    can_show_summary: false,
    requires_confirmation: false,
    confirmation_options: null,
    target_topic: null,
    reopened_topic: null,
  });
}

function allowsDeterministicMetaResolution(trace: LimbicInterviewTraceV1): boolean {
  return trace.phase !== "follow_up";
}

function segmentTopicPatch(
  miniStep: GuidedMiniStepId,
  status: DecisionStatusPatch["status"],
  reason: string,
): DecisionStatusPatch[] {
  const k = miniStepToPilotSegmentKey(miniStep);
  return k
    ? [
        {
          topic: k,
          status,
          confidence: 0.72,
          reason,
          source: "guided_intake",
        },
      ]
    : [];
}

function resolveSegmentConfirmationTurnInner(
  input: ResolveGuidedIntakeTurnInput,
  pendingState: ConversationalPendingState,
): TurnDecision {
  const { userText, miniStep, trace } = input;
  const pending = trace.segment_confirmation_pending!;
  const segMini = pending.mini_step;
  const awaiting = Boolean(pending.awaiting_pending_ack);
  const reply = classifySegmentConfirmationUserReply({
    userText,
    awaitingPendingAck: awaiting,
  });

  const notesBase: TurnDecisionNotesForRoute = {
    branch: "segment_confirmation_resolve",
  };

  if (reply === "confirm") {
    return finalizeEngineTurn(trace, userText, {
      user_intent: "confirmation",
      pending_state: pendingState,
      action: "segment_confirmation_resolve",
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
      notes_for_route: { ...notesBase, segmentConfirmationKind: "confirm" },
      decision_status_updates: segmentTopicPatch(
        segMini,
        "confirmed",
        "User confirmed segment interpretation.",
      ),
      active_doubt_detected: false,
      can_show_summary: false,
      requires_confirmation: false,
      confirmation_options: null,
      target_topic: miniStepToStrategicTopicKey(segMini),
      reopened_topic: null,
    });
  }

  if (reply === "pending_ack_confirm" || (reply === "pending_missing_info" && !awaiting)) {
    const pendingReason =
      reply === "pending_ack_confirm"
        ? "User confirmed leaving segment information explicitly pending."
        : "User chose to leave this segment explicitly pending.";
    return finalizeEngineTurn(trace, userText, {
      user_intent: "confirmation",
      pending_state: pendingState,
      action: "segment_confirmation_resolve",
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
      notes_for_route: { ...notesBase, segmentConfirmationKind: "pending_ack_confirm" },
      decision_status_updates: segmentTopicPatch(
        segMini,
        "pending_confirmed",
        pendingReason,
      ),
      active_doubt_detected: false,
      can_show_summary: false,
      requires_confirmation: false,
      confirmation_options: null,
      target_topic: miniStepToStrategicTopicKey(segMini),
      reopened_topic: null,
    });
  }

  if (reply === "correct") {
    return finalizeEngineTurn(trace, userText, {
      user_intent: "correction",
      pending_state: "pending_correction",
      action: "segment_confirmation_resolve",
      current_mini_step: miniStep,
      next_mini_step: segMini,
      current_phase: trace.phase,
      next_phase: "segment_confirmation",
      should_advance: false,
      should_not_advance: true,
      writes_to_responses: false,
      writes_to_completed_steps: false,
      summary_allowed: false,
      render_policy: "single_surface_no_competing_bank",
      question_surface_type: "single_merged_assistant_turn",
      skip_llm_extraction: true,
      notes_for_route: { ...notesBase, segmentConfirmationKind: "correct" },
      decision_status_updates: segmentTopicPatch(
        segMini,
        "in_progress",
        "User chose to correct before confirmation.",
      ),
      active_doubt_detected: false,
      can_show_summary: false,
      requires_confirmation: false,
      confirmation_options: null,
      target_topic: miniStepToStrategicTopicKey(segMini),
      reopened_topic: null,
    });
  }

  if (reply === "help") {
    return finalizeEngineTurn(trace, userText, {
      user_intent: "strategic_validation_question",
      pending_state: pendingState,
      action: "segment_confirmation_resolve",
      current_mini_step: miniStep,
      next_mini_step: segMini,
      current_phase: trace.phase,
      next_phase: "segment_confirmation",
      should_advance: false,
      should_not_advance: true,
      writes_to_responses: false,
      writes_to_completed_steps: false,
      summary_allowed: false,
      render_policy: "single_surface_no_competing_bank",
      question_surface_type: "single_merged_assistant_turn",
      skip_llm_extraction: true,
      notes_for_route: { ...notesBase, segmentConfirmationKind: "help" },
      decision_status_updates: segmentTopicPatch(
        segMini,
        "low_confidence",
        "User asked for help improving the segment confirmation synthesis.",
      ),
      active_doubt_detected: false,
      can_show_summary: false,
      requires_confirmation: true,
      confirmation_options: null,
      target_topic: miniStepToStrategicTopicKey(segMini),
      reopened_topic: null,
    });
  }

  if (reply === "frustration") {
    return finalizeEngineTurn(trace, userText, {
      user_intent: "ambiguous_answer",
      pending_state: pendingState,
      action: "segment_confirmation_resolve",
      current_mini_step: miniStep,
      next_mini_step: segMini,
      current_phase: trace.phase,
      next_phase: "segment_confirmation",
      should_advance: false,
      should_not_advance: true,
      writes_to_responses: false,
      writes_to_completed_steps: false,
      summary_allowed: false,
      render_policy: "single_surface_no_competing_bank",
      question_surface_type: "single_merged_assistant_turn",
      skip_llm_extraction: true,
      notes_for_route: { ...notesBase, segmentConfirmationKind: "frustration" },
      decision_status_updates: [],
      active_doubt_detected: false,
      can_show_summary: false,
      requires_confirmation: true,
      confirmation_options: null,
      target_topic: miniStepToStrategicTopicKey(segMini),
      reopened_topic: null,
    });
  }

  return finalizeEngineTurn(trace, userText, {
    user_intent: "ambiguous_answer",
    pending_state: pendingState,
    action: "segment_confirmation_resolve",
    current_mini_step: miniStep,
    next_mini_step: segMini,
    current_phase: trace.phase,
    next_phase: "segment_confirmation",
    should_advance: false,
    should_not_advance: true,
    writes_to_responses: false,
    writes_to_completed_steps: false,
    summary_allowed: false,
    render_policy: "single_surface_no_competing_bank",
    question_surface_type: "single_merged_assistant_turn",
    skip_llm_extraction: true,
    notes_for_route: { ...notesBase, segmentConfirmationKind: "reprompt" },
    decision_status_updates: [],
    active_doubt_detected: false,
    can_show_summary: false,
    requires_confirmation: true,
    confirmation_options: null,
    target_topic: miniStepToStrategicTopicKey(segMini),
    reopened_topic: null,
  });
}

/**
 * Limbi Conversational Engine v1 — Phase 1 + Phase 2 (decision status, doubt, cross-topic).
 * Pure: no I/O, no persistence.
 */
export function resolveGuidedIntakeTurn(
  input: ResolveGuidedIntakeTurnInput,
): TurnDecision {
  const { userText, miniStep, trace } = input;
  const pendingState = derivePendingState(trace, miniStep);

  const segPen0 = trace.segment_confirmation_pending;
  if (segPen0?.version === 1 && segPen0.awaiting_segment_correction) {
    const sameStep0 = segPen0.mini_step === miniStep;
    const crossFlowCorrection =
      trace.phase === "segment_confirmation" && segPen0.mini_step !== miniStep;
    if (sameStep0 || crossFlowCorrection) {
      const awaitingAck = Boolean(segPen0.awaiting_pending_ack);
      if (!shouldResolveSegmentWhileCorrectionPending(input.userText, awaitingAck)) {
        return baseLlmDecision(input, pendingState);
      }
    }
  }

  if (trace.segment_confirmation_pending?.version === 1) {
    const p = trace.segment_confirmation_pending;
    const sameStep = p.mini_step === miniStep;
    /** Cross-topic: confirm a different mini_step while journey cursor stays on current step. */
    const crossFlowSegmentConfirm =
      trace.phase === "segment_confirmation" && p.mini_step !== miniStep;
    if (sameStep || crossFlowSegmentConfirm) {
      return resolveSegmentConfirmationTurnInner(input, pendingState);
    }
    return resolveGuidedIntakeTurn({
      ...input,
      trace: stripSegmentConfirmationPending(trace),
    });
  }

  if (miniStep === "audience" && trace.audience_recommendation_pending?.version === 1) {
    const reply = classifyPendingAudienceUserReply(
      userText,
      trace.audience_recommendation_pending,
    );
    return decisionForPendingAudience(input, reply);
  }

  const provisionalChoice =
    trace.phase === "strategy_validation"
      ? classifyProvisionalDecisionFollowUp(userText)
      : null;
  if (provisionalChoice) {
    const choice = provisionalChoice;
    const topic = miniStepToStrategicTopicKey(miniStep);
    const patches: DecisionStatusPatch[] =
      topic && choice === "confirm"
        ? [
            {
              topic,
              status: "confirmed",
              confidence: 0.88,
              reason: "User confirmed after provisional guidance.",
              source: "guided_intake",
            },
          ]
        : topic && choice === "leave_pending"
          ? [
              {
                topic,
                status: "pending",
                confidence: 0.4,
                reason: "User chose to leave this decision pending.",
                source: "guided_intake",
              },
            ]
          : topic
            ? [
                {
                  topic,
                  status: "provisional",
                  confidence: 0.55,
                  reason: "User asked to change priority or framing.",
                  source: "guided_intake",
                },
              ]
            : [];

    return finalizeEngineTurn(trace, userText, {
      user_intent: choice === "confirm" ? "confirmation" : "correction",
      pending_state: "pending_strategic_validation",
      action: "provisional_decision_resolution",
      current_mini_step: miniStep,
      next_mini_step: null,
      current_phase: trace.phase,
      next_phase: choice === "change_priority" ? "strategy_validation" : "main",
      should_advance: choice !== "change_priority",
      should_not_advance: choice === "change_priority",
      writes_to_responses: choice === "leave_pending",
      writes_to_completed_steps: choice !== "change_priority",
      summary_allowed: false,
      render_policy:
        choice === "change_priority"
          ? "single_surface_no_competing_bank"
          : "default",
      question_surface_type:
        choice === "change_priority" ? "single_merged_assistant_turn" : "primary_bank",
      skip_llm_extraction: true,
      notes_for_route: {
        branch: "provisional_decision_resolution",
        provisionalChoice: choice,
      },
      decision_status_updates: patches,
      target_topic: topic ?? null,
      reopened_topic: null,
      active_doubt_detected: false,
      can_show_summary: false,
      requires_confirmation: false,
      confirmation_options: null,
    });
  }

  if (miniStep === "evidence" && detectReturnToAudienceTopicIntent(userText)) {
    return finalizeEngineTurn(trace, userText, {
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
      decision_status_updates: [
        {
          topic: "audience",
          status: "reopened",
          confidence: 0.55,
          reason: "User returned to audience from evidence step.",
          source: "guided_intake",
        },
      ],
      target_topic: "audience",
      reopened_topic: "audience",
      requires_confirmation: true,
      confirmation_options: [...STRATEGIC_DECISION_CONFIRMATION_OPTIONS_ES],
      active_doubt_detected: false,
      can_show_summary: false,
    });
  }

  if (miniStep === "evidence" && detectEvidenceStepPositioningClaim(userText)) {
    return finalizeEngineTurn(trace, userText, {
      user_intent: "strategic_validation_question",
      pending_state:
        pendingState === "none" ? "pending_strategic_validation" : pendingState,
      action: "evidence_positioning_claim_redirect",
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
      skip_llm_extraction: true,
      notes_for_route: { branch: "evidence_positioning_claim_redirect" },
      decision_status_updates: [
        {
          topic: "evidence",
          status: "provisional",
          confidence: 0.48,
          reason: "Positioning-style claim during evidence step; not stored as proof yet.",
          source: "guided_intake",
        },
      ],
      target_topic: "evidence",
      reopened_topic: null,
      active_doubt_detected: true,
      requires_confirmation: true,
      confirmation_options: [...STRATEGIC_DECISION_CONFIRMATION_OPTIONS_ES],
      can_show_summary: false,
    });
  }

  if (miniStep === "evidence" && detectEvidenceStepAudienceStakeholderInput(userText)) {
    return finalizeEngineTurn(trace, userText, {
      user_intent: "correction",
      pending_state: pendingState === "none" ? "pending_correction" : pendingState,
      action: "evidence_audience_actor_redirect",
      current_mini_step: miniStep,
      next_mini_step: miniStep,
      current_phase: trace.phase,
      next_phase: "strategy_validation",
      should_advance: false,
      should_not_advance: true,
      writes_to_responses: true,
      writes_to_completed_steps: false,
      summary_allowed: false,
      render_policy: "single_surface_no_competing_bank",
      question_surface_type: "single_merged_assistant_turn",
      skip_llm_extraction: true,
      notes_for_route: { branch: "evidence_audience_actor_redirect" },
      decision_status_updates: [
        {
          topic: "audience",
          status: "provisional",
          confidence: 0.55,
          reason: "Stakeholder or actor wording captured under audience during evidence step.",
          source: "guided_intake",
        },
        {
          topic: "evidence",
          status: "in_progress",
          confidence: 0.5,
          reason: "Evidence step: substantive line routed to audience context.",
          source: "guided_intake",
        },
      ],
      target_topic: "audience",
      reopened_topic: null,
      active_doubt_detected: false,
      requires_confirmation: true,
      confirmation_options: [...STRATEGIC_DECISION_CONFIRMATION_OPTIONS_ES],
      can_show_summary: false,
    });
  }

  const currentTopic = miniStepToStrategicTopicKey(miniStep);
  const crossTarget = resolveCrossStrategicTopicReference({
    userText,
    currentMiniStep: miniStep,
  });
  const crossSurface = classifyCrossTopicSurface(userText);

  if (
    currentTopic &&
    crossTarget &&
    crossTarget !== currentTopic &&
    allowsDeterministicMetaResolution(trace)
  ) {
    const substantive =
      crossSurface === "substantive_correction" ||
      (crossSurface === null &&
        userText.trim().length >= 40 &&
        !detectReturnToAudienceTopicIntent(userText));

    if (substantive) {
      const restore = miniStep;
      const override = strategicTopicKeyToMiniStep(crossTarget);
      return finalizeEngineTurn(trace, userText, {
        user_intent: "correction",
        pending_state: pendingState === "none" ? "pending_correction" : pendingState,
        action: "cross_topic_llm_extraction",
        current_mini_step: miniStep,
        next_mini_step: null,
        current_phase: trace.phase,
        next_phase: null,
        should_advance: false,
        should_not_advance: false,
        writes_to_responses: true,
        writes_to_completed_steps: false,
        summary_allowed: false,
        render_policy: "default",
        question_surface_type: "primary_bank",
        skip_llm_extraction: false,
        notes_for_route: {
          branch: "cross_topic_llm_extraction",
          overrideMiniStep: override,
          restoreMiniStepAfter: restore,
          rerouteTargetTopic: crossTarget,
        },
        decision_status_updates: [
          {
            topic: crossTarget,
            status: "provisional",
            confidence: 0.58,
            reason: "Cross-topic substantive update; requires segment confirmation.",
            source: "guided_intake",
          },
        ],
        target_topic: crossTarget,
        reopened_topic: crossTarget,
        active_doubt_detected: detectActiveStrategicDoubt(userText),
        can_show_summary: false,
        requires_confirmation: false,
        confirmation_options: null,
      });
    }

    if (crossSurface === "meta_reopen" || detectReturnToAudienceTopicIntent(userText)) {
      const nextMini = strategicTopicKeyToMiniStep(crossTarget);
      return finalizeEngineTurn(trace, userText, {
        user_intent: "return_to_previous_topic",
        pending_state: "pending_return_to_topic",
        action: "strategic_topic_reroute",
        current_mini_step: miniStep,
        next_mini_step: nextMini,
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
        notes_for_route: {
          branch: "strategic_topic_reroute",
          rerouteTargetTopic: crossTarget,
        },
        decision_status_updates: [
          {
            topic: crossTarget,
            status: "reopened",
            confidence: 0.55,
            reason: "User asked to revisit a prior strategic topic.",
            source: "guided_intake",
          },
        ],
        target_topic: crossTarget,
        reopened_topic: crossTarget,
        requires_confirmation: true,
        confirmation_options: [...STRATEGIC_DECISION_CONFIRMATION_OPTIONS_ES],
        active_doubt_detected: false,
        can_show_summary: false,
      });
    }
  }

  if (
    miniStep === "audience" &&
    trace.phase === "main" &&
    !trace.audience_recommendation_pending &&
    isBareAffirmationWithoutSubstance(userText)
  ) {
    const doubtTopic = currentTopic ?? "audience";
    return finalizeEngineTurn(trace, userText, {
      user_intent: "ambiguous_answer",
      pending_state:
        pendingState === "none" ? "pending_strategic_validation" : pendingState,
      action: "bare_confirmation_hold",
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
      skip_llm_extraction: true,
      notes_for_route: { branch: "bare_confirmation_hold" },
      decision_status_updates: [
        {
          topic: "audience",
          status: "provisional",
          confidence: 0.45,
          reason: "Bare affirmation without referent; not a committed audience answer.",
          source: "guided_intake",
        },
      ],
      target_topic: doubtTopic,
      reopened_topic: null,
      active_doubt_detected: true,
      requires_confirmation: true,
      confirmation_options: [...STRATEGIC_DECISION_CONFIRMATION_OPTIONS_ES],
      can_show_summary: false,
    });
  }

  if (miniStep === "evidence" && detectEvidenceUncertaintyWithoutMetaQuestion(userText)) {
    return finalizeEngineTurn(trace, userText, {
      user_intent: "missing_information",
      pending_state: "pending_missing_information",
      action: "evidence_uncertainty_advance",
      current_mini_step: miniStep,
      next_mini_step: miniStep,
      current_phase: trace.phase,
      next_phase: "main",
      should_advance: false,
      should_not_advance: true,
      writes_to_responses: false,
      writes_to_completed_steps: false,
      summary_allowed: false,
      render_policy: "default",
      question_surface_type: "primary_bank",
      skip_llm_extraction: true,
      notes_for_route: { branch: "evidence_uncertainty_advance" },
      decision_status_updates: [
        {
          topic: "evidence",
          status: "provisional",
          confidence: 0.35,
          reason: "User lacks evidence clarity; awaiting segment confirmation.",
          source: "guided_intake",
        },
      ],
      active_doubt_detected: false,
      target_topic: null,
      reopened_topic: null,
      can_show_summary: false,
      requires_confirmation: false,
      confirmation_options: null,
    });
  }

  const strategicMini = Boolean(currentTopic);
  const strategicValidation =
    allowsDeterministicMetaResolution(trace) &&
    detectDeterministicStrategicValidationIntent(userText, { miniStep });
  const helpOrHow = detectStrategicHelpOrHowToRequest(userText);
  const activeDoubtSignal = detectActiveStrategicDoubt(userText);

  const seeksStrategicGuidance =
    allowsDeterministicMetaResolution(trace) &&
    strategicMini &&
    (strategicValidation || activeDoubtSignal || helpOrHow);

  if (seeksStrategicGuidance) {
    const doubtTopic = currentTopic!;
    const entryStatus =
      helpOrHow && !strategicValidation ? "low_confidence" : "provisional";
    const routeBranch = strategicValidation
      ? ("deterministic_strategic_validation" as const)
      : ("active_strategic_doubt" as const);
    const userIntent = strategicValidation
      ? ("strategic_validation_question" as const)
      : ("active_doubt" as const);

    return finalizeEngineTurn(trace, userText, {
      user_intent: userIntent,
      pending_state:
        pendingState === "none" ? "pending_strategic_validation" : pendingState,
      action: routeBranch,
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
      skip_llm_extraction: true,
      notes_for_route: { branch: routeBranch },
      decision_status_updates: [
        {
          topic: doubtTopic,
          status: entryStatus,
          confidence: entryStatus === "low_confidence" ? 0.42 : 0.55,
          reason:
            entryStatus === "low_confidence"
              ? "User asked for help or does not know how to answer; not a final capture."
              : "Strategic guidance or validation exchange; awaiting user confirmation.",
          source: "guided_intake",
        },
      ],
      target_topic: doubtTopic,
      reopened_topic: null,
      active_doubt_detected: true,
      requires_confirmation: true,
      confirmation_options: [...STRATEGIC_DECISION_CONFIRMATION_OPTIONS_ES],
      can_show_summary: false,
    });
  }

  const deterministicClarification =
    allowsDeterministicMetaResolution(trace) &&
    detectDeterministicClarificationIntent(userText);

  if (deterministicClarification) {
    return finalizeEngineTurn(trace, userText, {
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
      active_doubt_detected: false,
      target_topic: null,
      reopened_topic: null,
      can_show_summary: false,
      requires_confirmation: false,
      confirmation_options: null,
    });
  }

  return baseLlmDecision(input, pendingState);
}
