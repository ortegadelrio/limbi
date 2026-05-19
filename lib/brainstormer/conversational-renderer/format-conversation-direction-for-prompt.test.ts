import { describe, expect, it } from "vitest";
import { formatConversationDirectionForPrompt } from "@/lib/brainstormer/conversational-renderer/format-conversation-direction-for-prompt";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";

const sampleDecision: ConversationDirectorDecision = {
  challenge_type: "sales",
  user_intent: "ask_how",
  conversation_stage: "opening",
  known_from_brand_base: ["Audiencias: Profesionales de marketing"],
  missing_information: ["Meta de ventas / boletas", "Plazo"],
  assistant_move: "ask_one_strategic_question",
  next_best_question: "¿Cuántas boletas faltan por vender y cuánto tiempo queda?",
  question_id: "sales-opening-sales-gap",
  question_asks_for: "sales_gap",
  question_reason:
    "En ventas/eventos, la meta faltante y el plazo cambian la estrategia antes de proponer tácticas.",
  should_use_web_search: false,
  web_search_reason: null,
  should_suggest_project_conversion: false,
  project_readiness: "low",
  work_mode: "deliverable_building",
  concrete_deliverable_detected: true,
  detected_deliverable_type: "landing_page",
  should_request_user_material: true,
  requested_material_reason: "Falta el Word con los temas.",
  transition_message: "Pasamos a construir la landing.",
  world_cup_ip_guardrail: false,
  consulting_style_mode: "default",
  consulting_style_directive: "Voz consultor senior.",
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
};

describe("formatConversationDirectionForPrompt", () => {
  it("incluye campos estructurados para el renderer", () => {
    const block = formatConversationDirectionForPrompt(sampleDecision);
    expect(block).toContain("CONVERSATION_DIRECTION");
    expect(block).toContain("assistant_move: ask_one_strategic_question");
    expect(block).toContain("challenge_type: sales");
    expect(block).toContain("user_intent: ask_how");
    expect(block).toContain("conversation_stage: opening");
    expect(block).toContain(
      "next_best_question: ¿Cuántas boletas faltan por vender y cuánto tiempo queda?",
    );
    expect(block).toContain("question_id: sales-opening-sales-gap");
    expect(block).toContain("question_asks_for: sales_gap");
    expect(block).toContain("question_reason:");
    expect(block).toMatch(/meta faltante y el plazo/i);
    expect(block).toContain("known_from_brand_base:");
    expect(block).toContain("missing_information:");
    expect(block).toContain("render_hint_for_assistant_move:");
    expect(block).toContain("work_mode: deliverable_building");
    expect(block).toContain("should_request_user_material: true");
    expect(block).toContain("transition_message");
  });
});
