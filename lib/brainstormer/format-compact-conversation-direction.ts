import type { BrainstormerConversationContractTurn } from "@/lib/brainstormer/conversation-contract";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";

/** Director mínimo para el prompt (evita duplicar reglas del renderer). */
export function formatCompactConversationDirectionForPrompt(
  decision: ConversationDirectorDecision,
  contract?: BrainstormerConversationContractTurn,
): string {
  const closing =
    contract?.include_closing_question && contract.effective_closing_question
      ? contract.effective_closing_question
      : decision.next_best_question?.trim() || "(none — end with proposal)";

  const lines = [
    "DIRECTOR (compact)",
    `move=${decision.assistant_move} mode=${decision.work_mode} intent=${decision.user_intent} stage=${decision.conversation_stage}`,
    `generate_now=${decision.should_generate_content_now} material_ask=${decision.should_request_user_material}`,
    `closing_question=${closing}`,
  ];

  if (decision.should_generate_content_now && decision.deliverable_building_directive) {
    lines.push(`deliverable: ${decision.deliverable_building_directive.slice(0, 240)}`);
  }
  if (decision.user_insight_anchor) {
    lines.push(`insight_anchor: ${decision.user_insight_anchor.slice(0, 160)}`);
  }
  if (decision.consulting_style_directive?.trim()) {
    lines.push(`style: ${decision.consulting_style_directive.slice(0, 160)}`);
  }

  return lines.join("\n");
}
