import { z } from "zod";

export const selectedOptionFocusSchema = z.enum([
  "sell_consulting",
  "get_conferences",
  "public_authority",
  "confirm_ideas",
  "has_notes_to_share",
]);

export type SelectedOptionFocus = z.infer<typeof selectedOptionFocusSchema>;

export type OptionSelectionDetectionInput = {
  user_message: string;
  conversation_excerpt: string;
};

export type OptionSelectionDetectionResult = {
  user_selected_previous_option: boolean;
  selected_option_focus: SelectedOptionFocus | null;
  advancement_directive: string | null;
  preferred_next_question: string | null;
  preferred_question_id: string | null;
  updated_challenge_type: "positioning" | "sales" | "event_promotion" | "content" | null;
};

export const OPTION_SELECTION_ADVANCEMENT_VERSION = "option-selection-advancement-v1" as const;
