import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";
import { CONSULTING_STYLE_VERSION } from "@/lib/brainstormer/consulting-style/types";

export function buildConsultingStyleRendererBlock(
  decision: Pick<
    ConversationDirectorDecision,
    | "consulting_style_mode"
    | "consulting_style_directive"
    | "user_insight_anchor"
    | "typo_avoid_terms"
    | "allow_structured_sections_list"
  >,
): string {
  const lines = [
    `CONSULTING_STYLE (${CONSULTING_STYLE_VERSION})`,
    `consulting_style_mode: ${decision.consulting_style_mode}`,
    `allow_structured_sections_list: ${String(decision.allow_structured_sections_list)}`,
    `user_insight_anchor: ${decision.user_insight_anchor ?? "null"}`,
    `typo_avoid_terms: ${decision.typo_avoid_terms.length > 0 ? decision.typo_avoid_terms.join(", ") : "(none)"}`,
    "",
    "consulting_style_directive:",
    decision.consulting_style_directive,
  ];

  if (decision.allow_structured_sections_list) {
    lines.push(
      "",
      "LIST FORMAT: User asked for conference sections — numbered list is allowed this turn (still end with one question).",
    );
  }

  return lines.join("\n");
}
