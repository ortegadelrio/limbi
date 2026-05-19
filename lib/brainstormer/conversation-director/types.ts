import { z } from "zod";
import { consultingStyleModeSchema } from "@/lib/brainstormer/consulting-style/types";
import {
  currentDeliverableTypeSchema,
  deliverableBuildDepthSchema,
} from "@/lib/brainstormer/deliverable-building-mode/types";
import { selectedOptionFocusSchema } from "@/lib/brainstormer/option-selection-advancement/types";
import { brainstormerQuestionAsksForZodSchema } from "@/lib/brainstormer/question-engine/types";

export const conversationDirectorChallengeTypeSchema = z.enum([
  "positioning",
  "sales",
  "campaign",
  "content",
  "activation",
  "audiovisual",
  "event_promotion",
  "general_strategy",
  "unknown",
]);

export const conversationDirectorUserIntentSchema = z.enum([
  "explore",
  "ask_how",
  "ask_validation",
  "correct_assistant",
  "ask_for_plan",
  "ask_for_ideas",
  "ask_for_research",
  "wants_project",
  "needs_clarity",
  "selected_option",
  "build_deliverable_content",
  "ask_credentials",
  "unclear",
]);

export const conversationDirectorStageSchema = z.enum([
  "opening",
  "exploration",
  "focusing",
  "structuring",
  "ready_for_project_seed",
]);

export const conversationDirectorAssistantMoveSchema = z.enum([
  "ask_one_strategic_question",
  "give_hypothesis_then_question",
  "compare_options",
  "propose_micro_plan",
  "repair_and_reframe",
  "suggest_research",
  "suggest_project_seed",
]);

export const conversationDirectorProjectReadinessSchema = z.enum(["low", "medium", "high"]);

export const conversationDirectorWorkModeSchema = z.enum([
  "exploration",
  "strategic_focus",
  "project_seed",
  "deliverable_building",
  "research_needed",
]);

export const detectedDeliverableTypeSchema = z.enum([
  "landing_page",
  "campaign_plan",
  "content_plan",
  "paid_media_plan",
  "audiovisual_script",
  "activation_concept",
  "presentation",
  "other",
]);

export const conversationDirectorDecisionSchema = z.object({
  challenge_type: conversationDirectorChallengeTypeSchema,
  user_intent: conversationDirectorUserIntentSchema,
  conversation_stage: conversationDirectorStageSchema,
  known_from_brand_base: z.array(z.string().max(500)).max(32),
  missing_information: z.array(z.string().max(500)).max(24),
  assistant_move: conversationDirectorAssistantMoveSchema,
  next_best_question: z.string().max(2000),
  question_id: z.string().max(120),
  question_asks_for: brainstormerQuestionAsksForZodSchema,
  question_reason: z.string().max(2000),
  should_use_web_search: z.boolean(),
  web_search_reason: z.string().max(1000).nullable(),
  should_suggest_project_conversion: z.boolean(),
  project_readiness: conversationDirectorProjectReadinessSchema,
  work_mode: conversationDirectorWorkModeSchema,
  concrete_deliverable_detected: z.boolean(),
  detected_deliverable_type: detectedDeliverableTypeSchema.nullable(),
  should_request_user_material: z.boolean(),
  requested_material_reason: z.string().max(1000).nullable(),
  transition_message: z.string().max(1200).nullable(),
  world_cup_ip_guardrail: z.boolean(),
  consulting_style_mode: consultingStyleModeSchema,
  consulting_style_directive: z.string().max(2000),
  user_insight_anchor: z.string().max(500).nullable(),
  typo_avoid_terms: z.array(z.string().max(80)).max(12),
  allow_structured_sections_list: z.boolean(),
  user_selected_previous_option: z.boolean(),
  selected_option_focus: selectedOptionFocusSchema.nullable(),
  option_advancement_directive: z.string().max(2000).nullable(),
  user_has_no_material: z.boolean(),
  current_deliverable_type: currentDeliverableTypeSchema.nullable(),
  current_deliverable_section: z.string().max(500).nullable(),
  deliverable_build_depth: deliverableBuildDepthSchema,
  should_generate_content_now: z.boolean(),
  deliverable_building_directive: z.string().max(2000).nullable(),
});

export type ConversationDirectorChallengeType = z.infer<
  typeof conversationDirectorChallengeTypeSchema
>;
export type ConversationDirectorUserIntent = z.infer<typeof conversationDirectorUserIntentSchema>;
export type ConversationDirectorStage = z.infer<typeof conversationDirectorStageSchema>;
export type ConversationDirectorAssistantMove = z.infer<
  typeof conversationDirectorAssistantMoveSchema
>;
export type ConversationDirectorProjectReadiness = z.infer<
  typeof conversationDirectorProjectReadinessSchema
>;
export type ConversationDirectorWorkMode = z.infer<typeof conversationDirectorWorkModeSchema>;
export type DetectedDeliverableType = z.infer<typeof detectedDeliverableTypeSchema>;
export type ConversationDirectorDecision = z.infer<typeof conversationDirectorDecisionSchema>;

export const CONVERSATION_DIRECTOR_VERSION = "conversation-director-v7" as const;

export type ResolveConversationDirectorInput = {
  user_message: string;
  conversation_excerpt: string;
  session_progress: {
    session_summary: string;
    current_challenge: string;
    preliminary_objective: string;
    project_readiness: ConversationDirectorProjectReadiness;
    should_suggest_project_conversion: boolean;
  };
  brand_signals: {
    identity_or_positioning: readonly string[];
    audiences: readonly string[];
    offer_or_roles: readonly string[];
    differentiators: readonly string[];
    credibility_assets: readonly string[];
    tone_or_limbic_cues: readonly string[];
    guardrails: readonly string[];
  };
  user_message_count: number;
};
