import { resolveNextQuestion } from "@/lib/brainstormer/question-engine";
import type {
  ConversationDirectorDecision,
  ResolveConversationDirectorInput,
} from "@/lib/brainstormer/conversation-director/types";
import { sanitizeConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/sanitize-conversation-director-decision";

/**
 * Dirección mínima segura si la validación falla tras sanitizar.
 * Evita exponer errores técnicos al usuario.
 */
export function buildFallbackConversationDirectorDecision(
  input: ResolveConversationDirectorInput,
): ConversationDirectorDecision {
  const { question, candidate_id, asks_for, reason } = resolveNextQuestion({
    challenge_type: "unknown",
    user_intent: "explore",
    conversation_stage: "opening",
    assistant_move: "ask_one_strategic_question",
    known_from_brand_base: [],
    missing_information: ["Definición concreta del reto en esta sesión"],
    session_progress: input.session_progress,
  });

  return sanitizeConversationDirectorDecision({
    challenge_type: "unknown",
    user_intent: "explore",
    conversation_stage: "opening",
    known_from_brand_base: [],
    missing_information: ["Definición concreta del reto en esta sesión"],
    assistant_move: "ask_one_strategic_question",
    next_best_question: question,
    question_id: candidate_id,
    question_asks_for: asks_for,
    question_reason: reason,
    should_use_web_search: false,
    web_search_reason: null,
    should_suggest_project_conversion: false,
    project_readiness: input.session_progress.project_readiness,
    work_mode: "exploration",
    concrete_deliverable_detected: false,
    detected_deliverable_type: null,
    should_request_user_material: false,
    requested_material_reason: null,
    transition_message: null,
    world_cup_ip_guardrail: false,
    consulting_style_mode: "default",
    consulting_style_directive: "Voz consultor senior: directo, sin lenguaje débil.",
    user_insight_anchor: null,
    typo_avoid_terms: [],
    allow_structured_sections_list: false,
    user_selected_previous_option: false,
    selected_option_focus: null,
    option_advancement_directive: null,
    user_has_no_material: false,
    current_deliverable_type: null,
    current_deliverable_section: null,
    deliverable_build_depth: "outline",
    should_generate_content_now: false,
    deliverable_building_directive: null,
  });
}

