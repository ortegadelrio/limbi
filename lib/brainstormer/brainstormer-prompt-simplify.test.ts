import { describe, expect, it } from "vitest";
import { auditBrainstormerPromptComposition } from "@/lib/brainstormer/brainstormer-prompt-audit";
import { buildBrainstormerOpenAIInput } from "@/lib/brainstormer/build-brainstormer-openai-input";
import {
  applyConversationContractToDirector,
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  buildWorkingBriefPromptBlock,
  classifyBrainstormerTurnIntent,
  emptyBrainstormerWorkingBrief,
  shouldIncludeClosingQuestion,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { buildCompactThinkingModelPromptBlock, resolveThinkingModelForBrainstormer } from "@/lib/ai/thinking-models";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";

const minimalDirector: ConversationDirectorDecision = {
  assistant_move: "give_hypothesis_then_question",
  work_mode: "exploration",
  challenge_type: "other",
  user_intent: "explore",
  conversation_stage: "opening",
  next_best_question: "¿Qué dirección prefieres?",
  question_id: "q1",
  question_asks_for: "feedback",
  question_reason: "generic",
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

const boringstoreParaguas =
  "No sabías que lo querías. ¿Cuál sería el paraguas conceptual?";

describe("Brainstormer prompt v3 — auditoría de capas", () => {
  it("ordena capas compactas y mantiene full_input bajo techo razonable vs v2", () => {
    const resolved = resolveThinkingModelForBrainstormer({
      selectedKey: "explorer",
      challengeText: boringstoreParaguas,
    });
    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: boringstoreParaguas,
    });
    const contract = buildConversationContractForTurn({
      brief,
      userMessage: boringstoreParaguas,
      thinkingPrimaryKey: "explorer",
    });
    const built = buildBrainstormerOpenAIInput({
      brand_name: "Boringstore",
      session_title: "Lanzamiento",
      brand_context_status: "ready",
      brand_context_has_pending_updates: false,
      brand_context_blocking_reasons: [],
      session_summary_progress: emptyBrainstormerSessionProgress(),
      conversation_excerpt: `user: ${boringstoreParaguas}`,
      conversation_director: applyConversationContractToDirector(minimalDirector, contract),
      conversation_contract_turn: contract,
      knowledge_payload: { brand: "Boringstore" },
      limbic_payload: {},
      working_brief_block: buildWorkingBriefPromptBlock(brief),
      conversation_contract_block: buildConversationContractPromptBlock(contract),
      thinking_model_block: buildCompactThinkingModelPromptBlock({ resolved }),
      last_user_message: boringstoreParaguas,
    });

    const audit = auditBrainstormerPromptComposition({
      brand_name: "Boringstore",
      session_title: "Lanzamiento",
      brand_context_status: "ready",
      brand_context_has_pending_updates: false,
      brand_context_blocking_reasons: [],
      session_summary_progress: emptyBrainstormerSessionProgress(),
      conversation_excerpt: `user: ${boringstoreParaguas}`,
      conversation_director: minimalDirector,
      conversation_contract_turn: contract,
      knowledge_payload: { brand: "Boringstore" },
      limbic_payload: {},
      working_brief_block: buildWorkingBriefPromptBlock(brief),
      conversation_contract_block: buildConversationContractPromptBlock(contract),
      thinking_model_block: buildCompactThinkingModelPromptBlock({ resolved }),
      last_user_message: boringstoreParaguas,
    });

    expect(built.full_input).toContain("BRAINSTORMER CORE BEHAVIOR");
    expect(built.full_input).toContain("BRAND_DNA_FOR_BRAINSTORMER");
    expect(built.full_input).toContain("THIS TURN");
    expect(built.full_input).toContain("THINKING MODEL");
    expect(built.full_input).not.toContain("FROZEN_ACTIVE_KNOWLEDGE_BASE_JSON");
    expect(built.full_input).not.toContain("BRAINSTORMER PROMPT LAYER HIERARCHY");
    expect(built.full_input).not.toContain("Reasoning ritual:");

    const contractLayer = audit.layers.find((l) => l.layer === "turn_contract");
    const thinkingLayer = audit.layers.find((l) => l.layer === "thinking_model_delta");
    expect(contractLayer).toBeDefined();
    expect(thinkingLayer).toBeDefined();
    if (contractLayer && thinkingLayer) {
      expect(contractLayer.chars).toBeLessThan(2500);
      expect(thinkingLayer.chars).toBeLessThan(1400);
    }
  });
});

describe("Boringstore — paraguas conceptual cualitativo (contrato)", () => {
  it("exige postura sobre la frase, paraguas y despliegue; sin cierre obligatorio ni opciones genéricas", () => {
    expect(classifyBrainstormerTurnIntent(boringstoreParaguas)).toBe("conceptual_strategy_request");
    expect(shouldIncludeClosingQuestion("conceptual_strategy_request", boringstoreParaguas)).toBe(
      false,
    );

    const contract = buildConversationContractForTurn({
      brief: emptyBrainstormerWorkingBrief(),
      userMessage: boringstoreParaguas,
      thinkingPrimaryKey: "explorer",
    });

    expect(contract.include_closing_question).toBe(false);
    expect(contract.effective_closing_question).toBeNull();
    expect(contract.response_obligation).toMatch(/postura|paraguas conceptual/i);
    expect(contract.response_obligation).toMatch(/despliega|por qué funciona|Ese es el paraguas/i);
    expect(contract.response_obligation).toMatch(/postura|paraguas|prosa/i);
    expect(contract.response_obligation).not.toMatch(/DISRUPTOR \(HOW\)|2–3 paraguas/i);
    expect(contract.forbidden_response_patterns.join(" ")).toMatch(
      /familia genérica de descubrimiento/i,
    );

    const block = buildConversationContractPromptBlock(contract);
    expect(block).toMatch(/THIS TURN/);
    expect(block).toMatch(/closing: none/i);
    expect(block).not.toMatch(/closing:.*¿qué opinas/i);

    const director = applyConversationContractToDirector(minimalDirector, contract);
    expect(director.next_best_question).toBe("");
  });
});
