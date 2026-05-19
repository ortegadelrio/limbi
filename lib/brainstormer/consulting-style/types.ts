import { z } from "zod";

export const consultingStyleModeSchema = z.enum([
  "default",
  "repair_confusion",
  "name_strong_idea",
  "conference_structure_with_notes",
]);

export type ConsultingStyleMode = z.infer<typeof consultingStyleModeSchema>;

export type ConsultingStyleDetectionInput = {
  user_message: string;
  conversation_excerpt: string;
  challenge_type: string;
};

export type ConsultingStyleDetectionResult = {
  consulting_style_mode: ConsultingStyleMode;
  consulting_style_directive: string;
  user_insight_anchor: string | null;
  typo_avoid_terms: string[];
  allow_structured_sections_list: boolean;
  preferred_closing_question: string | null;
};

export const CONSULTING_STYLE_VERSION = "consulting-style-v1" as const;
