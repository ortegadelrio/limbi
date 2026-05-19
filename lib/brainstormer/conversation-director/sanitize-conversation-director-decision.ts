import { truncateDirectorSignal } from "@/lib/brainstormer/conversation-director/truncate-director-signal";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";

/**
 * Asegura que la decisión del director cumple límites de longitud antes de validar con Zod.
 */
export function sanitizeConversationDirectorDecision(
  decision: ConversationDirectorDecision,
): ConversationDirectorDecision {
  return {
    ...decision,
    known_from_brand_base: decision.known_from_brand_base.map((s) =>
      truncateDirectorSignal(s),
    ),
    missing_information: decision.missing_information.map((s) => truncateDirectorSignal(s)),
    next_best_question: truncateDirectorSignal(decision.next_best_question, 2000),
    question_id: truncateDirectorSignal(decision.question_id, 120),
    question_reason: truncateDirectorSignal(decision.question_reason, 2000),
    web_search_reason:
      decision.web_search_reason === null
        ? null
        : truncateDirectorSignal(decision.web_search_reason, 1000),
    requested_material_reason:
      decision.requested_material_reason === null
        ? null
        : truncateDirectorSignal(decision.requested_material_reason, 1000),
    transition_message:
      decision.transition_message === null
        ? null
        : truncateDirectorSignal(decision.transition_message, 1200),
    consulting_style_directive: truncateDirectorSignal(decision.consulting_style_directive, 2000),
    user_insight_anchor:
      decision.user_insight_anchor === null
        ? null
        : truncateDirectorSignal(decision.user_insight_anchor, 500),
    typo_avoid_terms: decision.typo_avoid_terms.map((t) => truncateDirectorSignal(t, 80)),
    option_advancement_directive:
      decision.option_advancement_directive === null
        ? null
        : truncateDirectorSignal(decision.option_advancement_directive, 2000),
    current_deliverable_section:
      decision.current_deliverable_section === null
        ? null
        : truncateDirectorSignal(decision.current_deliverable_section, 500),
    deliverable_building_directive:
      decision.deliverable_building_directive === null
        ? null
        : truncateDirectorSignal(decision.deliverable_building_directive, 2000),
  };
}
