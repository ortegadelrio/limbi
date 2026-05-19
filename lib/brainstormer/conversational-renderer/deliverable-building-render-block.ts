import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";

/**
 * Bloque BRAIN-12 para el renderer: construcción real de entregables.
 */
export function buildDeliverableBuildingRendererBlock(
  decision: ConversationDirectorDecision,
): string {
  const lines = [
    `user_has_no_material: ${String(decision.user_has_no_material)}`,
    `current_deliverable_type: ${decision.current_deliverable_type ?? "null"}`,
    `current_deliverable_section: ${decision.current_deliverable_section ?? "null"}`,
    `deliverable_build_depth: ${decision.deliverable_build_depth}`,
    `should_generate_content_now: ${String(decision.should_generate_content_now)}`,
  ];

  if (decision.deliverable_building_directive) {
    lines.push("", "deliverable_building_directive:", decision.deliverable_building_directive);
  }

  if (decision.user_has_no_material) {
    lines.push(
      "",
      "NO MATERIAL (mandatory): User already said they have NO notes/files. Do NOT ask for Word, PDF, paste notes, or upload.",
    );
  }

  if (decision.should_generate_content_now) {
    lines.push(
      "",
      "SECTION DRAFT (mandatory): Write a REAL section draft in assistant_message (150–280 words) BEFORE the closing question.",
      "- Use ### heading with section title; 3–5 prose paragraphs; senior consultant/creative voice.",
      "- Forbidden after draft: FODA, SWOT, matrices, generic advice lists, '¿te gustaría profundizar?'.",
      "- Forbidden phrasing: 'podrías', 'sería útil', 'considera' — you are writing the piece, not coaching.",
      "- End assistant_message with next_best_question only (one question on tone or next section).",
    );
  } else if (decision.deliverable_build_depth === "outline") {
    lines.push(
      "",
      "OUTLINE MODE: Deliver narrative structure with tension; if user_has_no_material, build from brand base — do not request notes.",
    );
  }

  return lines.join("\n");
}
