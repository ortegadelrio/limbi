import { describe, expect, it } from "vitest";
import { buildBrainstormerOpenAIInput } from "@/lib/brainstormer/build-brainstormer-openai-input";
import {
  applyConversationContractToDirector,
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  buildWorkingBriefPromptBlock,
  classifyBrainstormerTurnIntent,
  updateBrainstormerWorkingBrief,
  emptyBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import {
  BORINGSTORE_KNOWLEDGE_FIXTURE,
  BORINGSTORE_LIMBIC_FIXTURE,
} from "@/lib/brainstormer/boringstore-thinking-model-audit.fixture";
import {
  buildBoringstoreConversionThreadExcerpt,
  BORINGSTORE_CONVERSION_LAST_MESSAGE,
  BORINGSTORE_CONVERSION_THREAD_MESSAGES,
} from "@/lib/brainstormer/audit-boringstore-conversion-prompts";
import {
  buildCompactThinkingModelPromptBlock,
  resolveThinkingModelForBrainstormer,
} from "@/lib/ai/thinking-models";
import { isConversionBridgeRequest } from "@/lib/brainstormer/working-brief-memory";
import { extractDetectedBrandSignalsFromPayloads } from "@/lib/brainstormer/brand-signals-from-active-base";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";

const LITERAL_CLICHES = [
  "Descubre lo inesperado",
  "Explora lo extraordinario",
  "Momentos mágicos",
] as const;

function buildBriefForConversionTurn() {
  let brief = emptyBrainstormerWorkingBrief();
  const parts: string[] = [];
  for (const msg of BORINGSTORE_CONVERSION_THREAD_MESSAGES) {
    brief = updateBrainstormerWorkingBrief({
      prior: brief,
      userMessage: msg,
      conversationExcerpt: parts.join("\n\n"),
    });
    parts.push(`user: ${msg}`);
  }
  return updateBrainstormerWorkingBrief({
    prior: brief,
    userMessage: BORINGSTORE_CONVERSION_LAST_MESSAGE,
    conversationExcerpt: buildBoringstoreConversionThreadExcerpt(),
  });
}

function buildPromptForModel(key: "explorer" | "commercial") {
  const excerpt = buildBoringstoreConversionThreadExcerpt();
  const brief = buildBriefForConversionTurn();
  const resolved = resolveThinkingModelForBrainstormer({
    selectedKey: key,
    challengeText: BORINGSTORE_CONVERSION_LAST_MESSAGE,
  });
  const contract = buildConversationContractForTurn({
    brief,
    userMessage: BORINGSTORE_CONVERSION_LAST_MESSAGE,
    conversationExcerpt: excerpt,
    thinkingPrimaryKey: resolved.primaryKey,
  });
  const brandSignals = extractDetectedBrandSignalsFromPayloads(
    BORINGSTORE_KNOWLEDGE_FIXTURE,
    BORINGSTORE_LIMBIC_FIXTURE,
  );
  const director = applyConversationContractToDirector(
    resolveConversationDirector({
      user_message: BORINGSTORE_CONVERSION_LAST_MESSAGE,
      conversation_excerpt: excerpt,
      session_progress: emptyBrainstormerSessionProgress(),
      brand_signals: brandSignals,
      user_message_count: 5,
    }),
    contract,
  );
  const built = buildBrainstormerOpenAIInput({
    brand_name: "Boringstore",
    session_title: "Lanzamiento digital",
    brand_context_status: "ready",
    brand_context_has_pending_updates: false,
    brand_context_blocking_reasons: [],
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
    last_user_message: BORINGSTORE_CONVERSION_LAST_MESSAGE,
  });
  return { contract, built, brief };
}

describe("conversion_bridge — detección semántica", () => {
  it("clasifica frases de conversión (incluida la del usuario)", () => {
    expect(
      classifyBrainstormerTurnIntent(
        "¿Cómo convertimos ese concepto en compras dentro de la página?",
      ),
    ).toBe("conversion_bridge");
    expect(isConversionBridgeRequest("¿Cómo hacemos que esto termine en ventas?")).toBe(true);
    expect(isConversionBridgeRequest("¿Cómo lo llevamos a producto real y carrito?")).toBe(true);
  });
});

describe("conversion_bridge — HOW por modelo (mismo ADN, brief, mensaje)", () => {
  const disruptor = buildPromptForModel("explorer");
  const commercial = buildPromptForModel("commercial");

  it("paraguas confirmado correcto", () => {
    expect(disruptor.brief.confirmed_conceptual_umbrella).toMatch(/no sab[ií]as/i);
  });

  it("THIS TURN: conversion_bridge con obligación mínima compartida", () => {
    expect(disruptor.contract.turn_intent).toBe("conversion_bridge");
    expect(disruptor.contract.response_obligation).toBe(
      commercial.contract.response_obligation,
    );
    expect(disruptor.contract.response_obligation).toMatch(/pregunta|paraguas|compra/i);
    expect(disruptor.contract.response_obligation).not.toMatch(/producto falso abre la conversaci/i);
  });

  it("full_input sin clichés literales; AVOID con familias codificadas", () => {
    for (const { built, contract } of [disruptor, commercial]) {
      for (const cliche of LITERAL_CLICHES) {
        expect(built.full_input).not.toContain(cliche);
      }
      const forbidden = contract.forbidden_response_patterns.join(" ");
      expect(forbidden).toMatch(/Yo trabajaría|como eje de la campaña/i);
      expect(forbidden).not.toMatch(/Descubre lo inesperado/);
      expect(built.full_input).not.toMatch(/Descubre lo inesperado|Explora lo extraordinario|Momentos mágicos/);
    }
  });

  it("bloques thinking difieren; THIS TURN comparte obligación mínima", () => {
    const dBlock = buildConversationContractPromptBlock(disruptor.contract);
    const cBlock = buildConversationContractPromptBlock(commercial.contract);
    expect(dBlock).toBe(cBlock);
    expect(disruptor.built.full_input).not.toBe(commercial.built.full_input);
  });
});
