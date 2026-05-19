import { z } from "zod";
import type { ConversationDirectorAssistantMove } from "@/lib/brainstormer/conversation-director/types";
import type {
  ConversationDirectorChallengeType,
  ConversationDirectorStage,
  ConversationDirectorUserIntent,
} from "@/lib/brainstormer/conversation-director/types";

export const brainstormerQuestionChallengeTypeSchema = [
  "positioning",
  "sales",
  "campaign",
  "content",
  "activation",
  "audiovisual",
  "event_promotion",
  "general_strategy",
  "unknown",
] as const;

export type BrainstormerQuestionChallengeType =
  (typeof brainstormerQuestionChallengeTypeSchema)[number];

export const brainstormerQuestionStageSchema = [
  "opening",
  "exploration",
  "focusing",
  "structuring",
  "ready_for_project_seed",
] as const;

export type BrainstormerQuestionStage = (typeof brainstormerQuestionStageSchema)[number];

export const brainstormerQuestionAsksForSchema = [
  "objective",
  "audience_priority",
  "sales_gap",
  "deadline",
  "conversion_block",
  "positioning_goal",
  "perception_priority",
  "evidence",
  "channels",
  "resources",
  "format",
  "activation_context",
  "content_goal",
  "decision",
] as const;

export type BrainstormerQuestionAsksFor = (typeof brainstormerQuestionAsksForSchema)[number];

export const brainstormerQuestionAsksForZodSchema = z.enum(brainstormerQuestionAsksForSchema);

export type BrainstormerQuestionCandidate = {
  id: string;
  challenge_type: BrainstormerQuestionChallengeType;
  stage: BrainstormerQuestionStage;
  question: string;
  asks_for: BrainstormerQuestionAsksFor;
  priority: number;
  avoid_if_known?: string[];
};

export type ResolveNextQuestionInput = {
  challenge_type: ConversationDirectorChallengeType;
  user_intent: ConversationDirectorUserIntent;
  conversation_stage: ConversationDirectorStage;
  assistant_move: ConversationDirectorAssistantMove;
  known_from_brand_base: readonly string[];
  missing_information: readonly string[];
  user_selected_previous_option?: boolean;
  session_progress: {
    session_summary: string;
    current_challenge: string;
    preliminary_objective: string;
  };
};

export type ResolveNextQuestionResult = {
  question: string;
  candidate_id: string;
  asks_for: BrainstormerQuestionAsksFor;
  reason: string;
};

export const QUESTION_ENGINE_VERSION = "question-engine-v2" as const;
