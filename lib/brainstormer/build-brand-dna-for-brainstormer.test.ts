import { describe, expect, it } from "vitest";
import {
  BRAND_DNA_PROMPT_HEADER,
  brandDnaContainsLiteralClichePhrases,
  buildBrandDnaForBrainstormer,
} from "@/lib/brainstormer/build-brand-dna-for-brainstormer";
import {
  applyConversationContractToDirector,
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  buildWorkingBriefPromptBlock,
  countDirectorCompactOccurrences,
  emptyBrainstormerWorkingBrief,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { buildBrainstormerOpenAIInput as buildInput } from "@/lib/brainstormer/build-brainstormer-openai-input";
import { auditBoringstoreThinkingModelPrompts } from "@/lib/brainstormer/audit-boringstore-thinking-model-prompts";
import {
  BORINGSTORE_KNOWLEDGE_FIXTURE,
  BORINGSTORE_LIMBIC_FIXTURE,
  BORINGSTORE_LAST_USER_MESSAGE,
  buildBoringstoreThreadExcerpt,
} from "@/lib/brainstormer/boringstore-thinking-model-audit.fixture";
import { buildCompactThinkingModelPromptBlock, resolveThinkingModelForBrainstormer } from "@/lib/ai/thinking-models";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";

const sampleKnowledge = {
  executive_reading:
    "Boringstore: ironía del aburrimiento; e-commerce de productos mundanos con deseo inesperado.",
  section_interpretations: [
    {
      section_key: "identity",
      headline: "Ironía",
      interpretation: "Jugar con lo ordinario; no épica de aventura.",
    },
    {
      section_key: "audiences",
      headline: "Compradores",
      interpretation: "Adultos urbanos en e-commerce.",
    },
    {
      section_key: "value_proposition",
      headline: "No sabías que lo querías",
      interpretation: "Deseo inesperado por lo mundano.",
    },
    {
      section_key: "differentiators",
      headline: "Puente",
      interpretation: "Producto falso en expectativa; producto real en landing.",
    },
    {
      section_key: "voice_tone",
      headline: "Tono",
      interpretation: "Cómico seco, directo.",
    },
  ],
  offer_architecture: { offer_summary: "E-commerce D2C." },
  restrictions_and_alerts: "No usar Descubre lo inesperado como línea madre.",
  final_highlights: { key_strengths: ["Ironía de marca"] },
};

const sampleLimbic = { symbolic_reading: "Contraste seco; deseo inesperado." };

const minimalDirector: ConversationDirectorDecision = {
  assistant_move: "give_hypothesis_then_question",
  work_mode: "exploration",
  challenge_type: "other",
  user_intent: "explore",
  conversation_stage: "opening",
  next_best_question: "",
  question_id: null,
  question_asks_for: null,
  question_reason: null,
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

const LITERAL_CLICHES = [
  "Descubre lo inesperado",
  "Explora lo extraordinario",
  "Viaje de descubrimiento",
  "Momentos mágicos",
  "Experiencia única",
] as const;

function baseOpenAIArgs(overrides: Partial<Parameters<typeof buildInput>[0]> = {}) {
  const excerpt = buildBoringstoreThreadExcerpt();
  let brief = emptyBrainstormerWorkingBrief();
  for (const line of excerpt.split("\n\n")) {
    brief = updateBrainstormerWorkingBrief({
      prior: brief,
      userMessage: line.replace(/^user:\s*/i, ""),
      conversationExcerpt: excerpt,
    });
  }
  brief.confirmed_conceptual_umbrella = "No sabías que lo querías";
  const resolved = resolveThinkingModelForBrainstormer({
    selectedKey: "explorer",
    challengeText: BORINGSTORE_LAST_USER_MESSAGE,
  });
  const contract = buildConversationContractForTurn({
    brief,
    userMessage: BORINGSTORE_LAST_USER_MESSAGE,
    conversationExcerpt: excerpt,
    thinkingPrimaryKey: "explorer",
  });
  const director = applyConversationContractToDirector(
    resolveConversationDirector({
      user_message: BORINGSTORE_LAST_USER_MESSAGE,
      conversation_excerpt: excerpt,
      session_progress: emptyBrainstormerSessionProgress(),
      brand_signals: {
        identity_or_positioning: [],
        audiences: [],
        offer_or_roles: [],
        differentiators: [],
        credibility_assets: [],
        tone_or_limbic_cues: [],
        guardrails: [],
      },
      user_message_count: 3,
    }),
    contract,
  );

  return {
    brand_name: "Boringstore",
    session_title: "Lanzamiento digital",
    brand_context_status: "ready" as const,
    brand_context_has_pending_updates: false,
    brand_context_blocking_reasons: [] as string[],
    session_summary_progress: emptyBrainstormerSessionProgress(),
    conversation_excerpt: excerpt,
    conversation_director: director,
    conversation_contract_turn: contract,
    knowledge_payload: BORINGSTORE_KNOWLEDGE_FIXTURE,
    limbic_payload: BORINGSTORE_LIMBIC_FIXTURE,
    working_brief: brief,
    working_brief_block: buildWorkingBriefPromptBlock(brief),
    conversation_contract_block: buildConversationContractPromptBlock(contract),
    thinking_model_block: buildCompactThinkingModelPromptBlock({ resolved }),
    last_user_message: BORINGSTORE_LAST_USER_MESSAGE,
    ...overrides,
  };
}

describe("buildBrandDnaForBrainstormer", () => {
  it("genera bloque menor a 1.500 chars con fixture Boringstore", () => {
    const dna = buildBrandDnaForBrainstormer({
      knowledge_payload: BORINGSTORE_KNOWLEDGE_FIXTURE,
      limbic_payload: BORINGSTORE_LIMBIC_FIXTURE,
    });
    expect(dna.character_count).toBeLessThanOrEqual(1500);
    expect(dna.block).toContain(BRAND_DNA_PROMPT_HEADER);
  });

  it("incluye brand_truth, desired_effect, weak_territories y conversion_mechanism", () => {
    const brief = emptyBrainstormerWorkingBrief();
    brief.confirmed_conceptual_umbrella = "No sabías que lo querías";
    const { fields, block } = buildBrandDnaForBrainstormer({
      knowledge_payload: sampleKnowledge,
      limbic_payload: sampleLimbic,
      working_brief: brief,
    });
    expect(fields.brand_truth).toMatch(/ironía|mundano|Boringstore/i);
    expect(fields.desired_effect).toMatch(/No sabías que lo querías|deseo inesperado/i);
    expect(fields.weak_territories_to_avoid).toMatch(/familia genérica de descubrimiento vacío/i);
    expect(fields.conversion_mechanism).toMatch(/landing|CTA|compra/i);
    expect(block).toContain("brand_truth:");
    expect(block).toContain("desired_effect:");
    expect(block).toContain("weak_territories_to_avoid:");
    expect(block).toContain("conversion_mechanism:");
  });

  it("no contiene frases cliché literales en el bloque DNA", () => {
    const dna = buildBrandDnaForBrainstormer({
      knowledge_payload: BORINGSTORE_KNOWLEDGE_FIXTURE,
      limbic_payload: BORINGSTORE_LIMBIC_FIXTURE,
    });
    expect(brandDnaContainsLiteralClichePhrases(dna.block)).toBe(false);
    for (const cliché of LITERAL_CLICHES) {
      expect(dna.block.toLowerCase()).not.toContain(cliché.toLowerCase());
    }
  });
});

describe("buildBrainstormerOpenAIInput — comparativo modelos", () => {
  it("Disruptor y Comercial reciben instrucciones distintas en thinking block", () => {
    const comparison = auditBoringstoreThinkingModelPrompts({
      knowledge_payload: BORINGSTORE_KNOWLEDGE_FIXTURE,
      limbic_payload: BORINGSTORE_LIMBIC_FIXTURE,
      conversation_excerpt: buildBoringstoreThreadExcerpt(),
      last_user_message: BORINGSTORE_LAST_USER_MESSAGE,
    });
    expect(comparison.disruptor.thinking_model_block).toMatch(/ruptura|deseo inesperado|ironía/i);
    expect(comparison.commercial.thinking_model_block).toMatch(/compra|landing|CTA|conversión/i);
    expect(comparison.disruptor.delta_only).not.toMatch(/Descubre lo inesperado|Explora lo extraordinario/i);
    expect(comparison.disruptor.thinking_model_block_chars).toBeLessThan(500);
  });

  it("THIS TURN clasifica mensaje conector como conceptual", () => {
    const built = buildInput(baseOpenAIArgs());
    expect(built.full_input).toMatch(/conceptual|paraguas|idea rectora|mensaje conector/i);
    expect(built.full_input).not.toMatch(/continuar conversación estratégica/i);
  });
});
