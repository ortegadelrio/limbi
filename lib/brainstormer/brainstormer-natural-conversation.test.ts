import { describe, expect, it } from "vitest";
import { BRAINSTORMER_CORE_BEHAVIOR_ES } from "@/lib/brainstormer/brainstormer-core-behavior";
import {
  userSeeksFeedbackOnProposedConcept,
  VISIBLE_FRAMEWORK_HEADERS_FORBIDDEN,
  WEAK_CREATIVE_TERRITORY_FAMILIES_FORBIDDEN,
} from "@/lib/brainstormer/brainstormer-natural-voice";
import {
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  classifyBrainstormerTurnIntent,
} from "@/lib/brainstormer/conversation-contract";
import { buildCompactThinkingModelPromptBlock } from "@/lib/ai/thinking-models";
import { resolveThinkingModelForBrainstormer } from "@/lib/ai/thinking-models";
import { buildConversationalRendererSystemInstructions } from "@/lib/brainstormer/conversational-renderer";

const FEEDBACK_MESSAGE =
  "Estaba pensando en 'No sabías que lo querías'. ¿Qué piensas?";

describe("voz conversacional — «No sabías que lo querías. ¿Qué piensas?»", () => {
  it("clasifica como concepto/validación, no menú de crítica genérica", () => {
    expect(userSeeksFeedbackOnProposedConcept(FEEDBACK_MESSAGE)).toBe(true);
    expect(classifyBrainstormerTurnIntent(FEEDBACK_MESSAGE)).toBe("conceptual_strategy_request");
  });

  it("contrato: postura, sin alternativas, sin plantilla visible", () => {
    const contract = buildConversationContractForTurn({
      brief: {
        contract_version: "v3",
        strategic_moment: "launch",
        current_request_type: "strategic_concept",
        active_constraints: [],
        user_corrections: [],
        rejected_paths: [],
        approved_signals: [],
        open_decisions: [],
        next_best_step: "",
        confirmed_decisions: [],
        confirmed_conceptual_umbrella: "",
        campaign_stage: "unknown",
        conversion_bridge: "",
      },
      userMessage: FEEDBACK_MESSAGE,
      thinkingPrimaryKey: "explorer",
    });

    const block = buildConversationContractPromptBlock(contract);
    expect(contract.response_obligation).toMatch(/pregunta|paraguas|concepto/i);
    expect(contract.response_obligation).not.toMatch(/2–3 paraguas|Paraguas conceptual 1/i);
    expect(contract.response_obligation).not.toMatch(/DISRUPTOR \(HOW\)|Grieta creativa/i);
    expect(contract.forbidden_response_patterns.join(" ")).toMatch(
      /Yo trabajaría|como eje de la campaña/i,
    );

    for (const header of VISIBLE_FRAMEWORK_HEADERS_FORBIDDEN) {
      expect(contract.forbidden_response_patterns).toContain(header);
    }
    expect(block).toMatch(/DELIVER|THIS TURN/i);
    expect(block).not.toMatch(/ANCHOR:.*LOCK/i);
  });

  it("thinking model y renderer: razonamiento interno, no plantilla visible", () => {
    const thinking = buildCompactThinkingModelPromptBlock({
      resolved: resolveThinkingModelForBrainstormer({
        selectedKey: "explorer",
        challengeText: FEEDBACK_MESSAGE,
      }),
    });
    expect(thinking).toMatch(/internal|no repetir etiquetas/i);
    expect(thinking).not.toMatch(/2–3 paraguas|Grieta creativa/i);

    const renderer = buildConversationalRendererSystemInstructions();
    expect(renderer).toMatch(/prosa conversacional|conversación/i);
    expect(renderer).not.toMatch(/Estructura: lectura del reto/i);
    expect(BRAINSTORMER_CORE_BEHAVIOR_ES).toMatch(/No lo cambiaría|Ese es el paraguas/i);
    expect(WEAK_CREATIVE_TERRITORY_FAMILIES_FORBIDDEN.length).toBeGreaterThanOrEqual(5);
    expect(BRAINSTORMER_CORE_BEHAVIOR_ES).not.toMatch(/Descubre lo inesperado/);
  });
});
