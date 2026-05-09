import { z } from "zod";
import { AUDIENCE_TYPE_OPTIONS } from "@/lib/constants/wizard";

export const SEGMENT_CONFIRMATION_ACTION_PAYLOAD_SCHEMA = z.object({
  type: z.literal("segment_confirmation_action"),
  action: z.enum(["confirm", "adjust", "help", "pending"]),
  optional_text: z.string().max(12000).optional(),
});

export type SegmentConfirmationActionPayload = z.infer<
  typeof SEGMENT_CONFIRMATION_ACTION_PAYLOAD_SCHEMA
>;

/** Phrases aligned with `classifySegmentConfirmationUserReply` (free-text fallback). */
export function segmentConfirmationActionToClassifierText(
  action: SegmentConfirmationActionPayload["action"],
): string {
  switch (action) {
    case "confirm":
      return "Sí, así está bien";
    case "adjust":
      return "Quiero ajustar";
    case "help":
      return "Ayúdame a mejorarlo";
    case "pending":
      return "Dejémoslo pendiente";
    default:
      return "Sí, así está bien";
  }
}

/** User-visible line stored in interview trace. */
export function segmentConfirmationActionToTraceLine(
  action: SegmentConfirmationActionPayload["action"],
): string {
  switch (action) {
    case "confirm":
      return "Sí, así está bien";
    case "adjust":
      return "Quiero ajustar";
    case "help":
      return "Ayúdame a mejorarlo";
    case "pending":
      return "Dejémoslo pendiente";
    default:
      return "Sí, así está bien";
  }
}

export type SegmentConfirmationUiAction = {
  id: SegmentConfirmationActionPayload["action"];
  label: string;
};

/** Stable labels for the pilot UI (Spanish). */
export const SEGMENT_CONFIRMATION_UI_ACTIONS: readonly SegmentConfirmationUiAction[] =
  [
    { id: "confirm", label: "Sí, así está bien" },
    { id: "adjust", label: "Quiero ajustar" },
    { id: "help", label: "Ayúdame a mejorarlo" },
    { id: "pending", label: "Dejémoslo pendiente" },
  ] as const;

export function audienceWizardSlugToSpanishLabel(slug: string): string {
  const s = slug.trim().toLowerCase();
  const row = AUDIENCE_TYPE_OPTIONS.find((o) => o.value === s);
  return row?.label ?? slug;
}
