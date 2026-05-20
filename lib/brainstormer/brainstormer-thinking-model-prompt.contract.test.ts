import { describe, expect, it } from "vitest";
import { buildBrainstormerOpenAIInput } from "@/lib/brainstormer/build-brainstormer-openai-input";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";
import {
  buildCompactThinkingModelPromptBlock,
  resolveThinkingModelForBrainstormer,
} from "@/lib/ai/thinking-models";
import {
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  emptyBrainstormerWorkingBrief,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";

const minimalDirector: ConversationDirectorDecision = {
  assistant_move: "give_hypothesis_then_question",
  work_mode: "exploration",
  challenge_type: "other",
  user_intent: "explore",
  conversation_stage: "opening",
  next_best_question: "¿Cuál es el objetivo principal?",
  question_id: "q_open",
  question_asks_for: "objective",
  question_reason: "Need objective",
  transition_message: null,
  should_request_user_material: false,
  should_generate_content_now: false,
  should_suggest_project_conversion: false,
  should_use_web_search: false,
  user_has_no_material: false,
  deliverable_build_depth: null,
  current_deliverable_type: null,
  current_deliverable_section: null,
  deliverable_building_directive: null,
  consulting_style_mode: "default",
  consulting_style_directive: "",
  user_insight_anchor: null,
  typo_avoid_terms: [],
  allow_structured_sections_list: false,
  world_cup_ip_guardrail: false,
  known_from_brand_base: [],
  missing_information: [],
};

describe("Brainstormer prompt — modelos de pensamiento", () => {
  const resolved = resolveThinkingModelForBrainstormer({
    selectedKey: "commercial",
    challengeText: "mejorar conversión",
  });

  const thinking_model_block = buildCompactThinkingModelPromptBlock({ resolved });

  const brief = updateBrainstormerWorkingBrief({
    prior: emptyBrainstormerWorkingBrief(),
    userMessage: "Queremos vender más",
  });
  const contractBlock = buildConversationContractPromptBlock(
    buildConversationContractForTurn({ brief, userMessage: "Queremos vender más" }),
  );

  const built = buildBrainstormerOpenAIInput({
    brand_name: "Acme",
    session_title: "Reto Q2",
    brand_context_status: "ready",
    brand_context_has_pending_updates: false,
    brand_context_blocking_reasons: [],
    session_summary_progress: emptyBrainstormerSessionProgress(),
    conversation_excerpt: "user: Queremos vender más",
    conversation_director: minimalDirector,
    knowledge_payload: { brand: "test" },
    limbic_payload: { tone: "warm" },
    working_brief_block: "WORKING BRIEF (memory)",
    conversation_contract_block: contractBlock,
    thinking_model_block,
    last_user_message: "Queremos vender más",
  });

  it("incluye core, canon compacto y delta de modelo", () => {
    expect(built.full_input).toContain("BRAINSTORMER CORE BEHAVIOR");
    expect(built.full_input).toContain("CANON (boundaries only");
    expect(built.full_input).toContain("THINKING MODEL");
    expect(built.full_input).toContain("Delta:");
    expect(built.full_input).toContain("BRAND_DNA_FOR_BRAINSTORMER");
    expect(built.full_input).not.toContain("FROZEN_ACTIVE_KNOWLEDGE_BASE_JSON");
    const contractIdx = built.full_input.indexOf("THIS TURN");
    const thinkingIdx = built.full_input.indexOf("THINKING MODEL", contractIdx + 1);
    expect(contractIdx).toBeGreaterThan(-1);
    expect(thinkingIdx).toBeGreaterThan(contractIdx);
  });

  it("incluye último mensaje del usuario y reglas de salida", () => {
    expect(built.full_input).toContain("LAST USER MESSAGE");
    expect(built.full_input).toContain("Queremos vender más");
    expect(built.user_payload).toMatch(/assistant_message \+ session_progress/i);
  });

  it("resolved thinking model metadata", () => {
    expect(resolved.primaryKey).toBe("commercial");
  });
});
