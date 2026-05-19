import { ASSISTANT_MOVE_RENDER_HINTS_ES } from "@/lib/brainstormer/conversational-renderer/assistant-move-render-hints";
import { CONVERSATIONAL_RENDERER_VERSION } from "@/lib/brainstormer/conversational-renderer/build-renderer-system-instructions";
import { buildConsultingStyleRendererBlock } from "@/lib/brainstormer/conversational-renderer/consulting-style-render-block";
import { buildDeliverableBuildingRendererBlock } from "@/lib/brainstormer/conversational-renderer/deliverable-building-render-block";
import { buildWorkModeRendererBlock } from "@/lib/brainstormer/conversational-renderer/work-mode-render-hints";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";
import { CONVERSATION_DIRECTOR_VERSION } from "@/lib/brainstormer/conversation-director/types";

function formatList(label: string, items: readonly string[]): string {
  if (items.length === 0) return `${label}: (ninguno detectado en este turno)`;
  return `${label}:\n${items.map((i) => `  - ${i}`).join("\n")}`;
}

/**
 * Bloque legible para el renderer: dirección completa + reglas de ejecución.
 */
export function formatConversationDirectionForPrompt(
  decision: ConversationDirectorDecision,
): string {
  const renderHint = ASSISTANT_MOVE_RENDER_HINTS_ES[decision.assistant_move];

  return `CONVERSATION_DIRECTION (${CONVERSATION_DIRECTOR_VERSION} + ${CONVERSATIONAL_RENDERER_VERSION})

assistant_move: ${decision.assistant_move}
challenge_type: ${decision.challenge_type}
user_intent: ${decision.user_intent}
conversation_stage: ${decision.conversation_stage}

next_best_question: ${decision.next_best_question}
question_id: ${decision.question_id}
question_asks_for: ${decision.question_asks_for}
question_reason: ${decision.question_reason}

project_readiness: ${decision.project_readiness}
should_suggest_project_conversion: ${String(decision.should_suggest_project_conversion)}
should_use_web_search: ${String(decision.should_use_web_search)}
web_search_reason: ${decision.web_search_reason ?? "null"}

${buildWorkModeRendererBlock(decision)}

${buildConsultingStyleRendererBlock(decision)}

${buildDeliverableBuildingRendererBlock(decision)}

user_selected_previous_option: ${String(decision.user_selected_previous_option)}
selected_option_focus: ${decision.selected_option_focus ?? "null"}
${decision.option_advancement_directive ? `\noption_advancement_directive:\n${decision.option_advancement_directive}` : ""}

${formatList("known_from_brand_base", decision.known_from_brand_base)}

${formatList("missing_information", decision.missing_information)}

render_hint_for_assistant_move: ${renderHint}

RENDERER RULES (mandatory)
- Do NOT change assistant_move, work_mode, question_id, or the strategic intent of next_best_question.
- If transition_message is set: integrate it naturally (consultor senior), never as "modo sistema" or JSON dump.
- If should_request_user_material: do NOT produce final landing/copy; ask for file or paste via next_best_question.
- Close assistant_message with next_best_question (one question only).
- Use known_from_brand_base for evidence; use missing_information to know what NOT to pretend is resolved.
- question_reason explains why this question advances the session — align tone and focus, do not argue with it.
- If should_use_web_search is true: do not fabricate external data; set expectations and ask next_best_question.
- Follow consulting_style_directive (BRAIN-10): senior consultant voice, no weak filler phrases.
- If user_selected_previous_option: NEVER ask "¿seguimos profundizando o cambiamos de foco?" — follow option_advancement_directive.
- If should_generate_content_now: deliver section draft (150–280 words) in assistant_message, then ONE closing question (next_best_question). No FODA unless user asked.
- If user_has_no_material: never ask for notes, Word, PDF, or paste.
- If allow_structured_sections_list is true: numbered sections or ### headings allowed; still conversational, not a report template.
- If typo_avoid_terms is set: never repeat those tokens; use correct Spanish instead.
- Spanish prose: 60–140 words default; 60–180 for outline/structure; 150–280 when should_generate_content_now — consultor senior que escribe, no asistente que aconseja.`;
}
