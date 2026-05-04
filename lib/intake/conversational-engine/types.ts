import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import type { LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";

/** Canonical user intents for routing (engine layer; broader than extraction-schema enum). */
export type ConversationalUserIntent =
  | "answer"
  | "clarification_question"
  | "strategic_validation_question"
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
  | "evidence_uncertainty_advance"
  | "deterministic_clarification"
  | "deterministic_strategic_validation"
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
};
