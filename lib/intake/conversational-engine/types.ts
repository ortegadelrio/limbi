import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import type {
  DecisionStatusPatch,
  StrategicDecisionTopicKey,
} from "@/lib/intake/decision-state";
import type { LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";
import type { ProvisionalDecisionUserChoice } from "@/lib/intake/conversational-engine/provisional-decision-reply";

/** Canonical user intents for routing (engine layer; broader than extraction-schema enum). */
export type ConversationalUserIntent =
  | "answer"
  | "clarification_question"
  | "strategic_validation_question"
  | "active_doubt"
  | "return_to_previous_topic"
  | "confirmation"
  | "rejection"
  | "skip"
  | "correction"
  | "ambiguous_answer"
  | "missing_information"
  | "off_topic"
  | "unknown";

/** Canonical pending states the engine reasons about. */
export type ConversationalPendingState =
  | "none"
  | "pending_follow_up"
  | "pending_clarification"
  | "pending_strategic_validation"
  | "pending_confirmation"
  | "pending_ambiguous_actor"
  | "pending_return_to_topic"
  | "pending_missing_information"
  | "pending_correction";

/** High-level action the HTTP layer should execute (Phase 1: route maps these to existing handlers). */
export type ConversationalEngineRouteBranch =
  | "pending_audience_confirmation"
  | "evidence_return_to_audience"
  | "evidence_audience_actor_redirect"
  | "evidence_positioning_claim_redirect"
  | "strategic_topic_reroute"
  | "cross_topic_llm_extraction"
  | "provisional_decision_resolution"
  | "active_strategic_doubt"
  | "bare_confirmation_hold"
  | "segment_confirmation_resolve"
  | "evidence_uncertainty_advance"
  | "deterministic_clarification"
  | "deterministic_strategic_validation"
  | "capture_phase_strategic_deferral"
  | "llm_extraction";

/** How the server should compose user-visible questions (policy for one surface). */
export type ConversationalRenderPolicy =
  | "default"
  | "single_surface_no_competing_bank"
  | "follow_up_only_when_present";

export type ConversationalQuestionSurfaceType =
  | "primary_bank"
  | "follow_up_only"
  | "single_merged_assistant_turn"
  | "none";

export type ResolveGuidedIntakeTurnInput = {
  userText: string;
  miniStep: GuidedMiniStepId;
  trace: LimbicInterviewTraceV1;
};

/** Sub-kind from pending-audience classifier (opaque to route beyond switch). */
export type PendingAudienceResolutionKind =
  | "restart_strategic_audience"
  | "explicit_unclear"
  | "confirm"
  | "secondary_emphasis_invert_prompt"
  | "decline_invert_reprompt"
  | "reject_priority"
  | "reprompt_confirmation";

/** Mirrors `PendingAudienceUserReply["kind"]` without coupling types.ts to strategic-validation. */
export type PendingAudienceReplyKind =
  | "restart_strategic_audience"
  | "explicit_unclear"
  | "confirm"
  | "secondary_emphasis_invert_prompt"
  | "decline_invert_reprompt"
  | "reject_priority"
  | "reprompt_confirmation";

export type TurnDecisionNotesForRoute = {
  branch: ConversationalEngineRouteBranch;
  /** Set when branch is `pending_audience_confirmation`. */
  pendingAudienceReplyKind?: PendingAudienceReplyKind;
  /** When confirm path may swap primary/secondary. */
  swapPrimarySecondary?: boolean;
  /** Cross-topic LLM: run extraction as this mini-step, then restore flow position. */
  overrideMiniStep?: GuidedMiniStepId;
  restoreMiniStepAfter?: GuidedMiniStepId;
  rerouteTargetTopic?: StrategicDecisionTopicKey;
  provisionalChoice?: ProvisionalDecisionUserChoice;
  /** When branch is `segment_confirmation_resolve`. */
  segmentConfirmationKind?:
    | "confirm"
    | "pending_ack_confirm"
    | "correct"
    | "help"
    | "frustration"
    | "reprompt";
};

/**
 * Pure decision for one guided-intake text turn (Phase 1).
 * Persistence and LLM calls stay in the route; this object tells the route what to run.
 */
export type TurnDecision = {
  user_intent: ConversationalUserIntent;
  pending_state: ConversationalPendingState;
  action: ConversationalEngineRouteBranch;
  current_mini_step: GuidedMiniStepId;
  next_mini_step: GuidedMiniStepId | null;
  current_phase: LimbicInterviewTraceV1["phase"];
  next_phase: LimbicInterviewTraceV1["phase"] | null;
  should_advance: boolean;
  should_not_advance: boolean;
  writes_to_responses: boolean;
  writes_to_completed_steps: boolean;
  summary_allowed: boolean;
  render_policy: ConversationalRenderPolicy;
  question_surface_type: ConversationalQuestionSurfaceType;
  /**
   * When true, the route skips the shared handler+LLM block entirely (pending audience
   * resolution and evidence shortcuts). When false, the route enters that block and may
   * still skip only the LLM call based on `notes_for_route.branch`.
   */
  skip_llm_extraction: boolean;
  notes_for_route: TurnDecisionNotesForRoute;
  /** Patches applied to `_limbic_interview_v1.decision_states` for this turn. */
  decision_status_updates: DecisionStatusPatch[];
  target_topic: StrategicDecisionTopicKey | null;
  reopened_topic: StrategicDecisionTopicKey | null;
  active_doubt_detected: boolean;
  /** When the mini-journey completes, whether the pilot summary may be shown. */
  can_show_summary: boolean;
  requires_confirmation: boolean;
  confirmation_options: string[] | null;
};

export type { DecisionStatusPatch, StrategicDecisionTopicKey } from "@/lib/intake/decision-state";
