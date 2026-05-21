import { describe, expect, it } from "vitest";
import {
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  classifyBrainstormerTurnIntent,
  emptyBrainstormerWorkingBrief,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import {
  BORINGSTORE_LAST_USER_MESSAGE,
  buildBoringstoreThreadExcerpt,
} from "@/lib/brainstormer/boringstore-thinking-model-audit.fixture";

const CONCEPTUAL_PHRASES = [
  "cuál es el paraguas conceptual",
  "necesito un concepto rector",
  "cuál es el mensaje conector",
  "cuál sería el mensaje general",
  "necesito la idea madre",
  "qué frase ordena la campaña",
  "cómo articulamos toda la campaña",
  "cuál es la gran idea",
  "Necesito definir un mensaje que sirva como conector de toda la campaña",
] as const;

const LEVEL_CORRECTION_PHRASES = [
  "eso son tácticas, necesito el concepto",
  "primero definamos el mensaje",
  "pero sin concepto creativo?",
] as const;

describe("conceptual_strategy_request — clasificación semántica", () => {
  for (const phrase of CONCEPTUAL_PHRASES) {
    it(`clasifica «${phrase.slice(0, 48)}…»`, () => {
      expect(classifyBrainstormerTurnIntent(phrase)).toBe("conceptual_strategy_request");
    });
  }

  for (const phrase of LEVEL_CORRECTION_PHRASES) {
    it(`corrección de nivel: «${phrase.slice(0, 40)}…»`, () => {
      expect(classifyBrainstormerTurnIntent(phrase)).toBe("conceptual_level_correction");
    });
  }

  it("corrección de nivel con excerpt previo", () => {
    const excerpt = buildBoringstoreThreadExcerpt();
    expect(
      classifyBrainstormerTurnIntent("eso son tácticas, necesito el concepto", excerpt),
    ).toBe("conceptual_level_correction");
  });

  it("mensaje conector Boringstore no cae en general", () => {
    expect(classifyBrainstormerTurnIntent(BORINGSTORE_LAST_USER_MESSAGE)).toBe(
      "conceptual_strategy_request",
    );
  });
});

describe("conceptual_strategy_request — obligación", () => {
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

  const contract = buildConversationContractForTurn({
    brief,
    userMessage: BORINGSTORE_LAST_USER_MESSAGE,
    conversationExcerpt: excerpt,
    thinkingPrimaryKey: "explorer",
  });

  it("no obliga plantilla Lectura/Criterio/Ruta", () => {
    expect(contract.response_obligation).not.toMatch(/Responder con lectura del reto/i);
    expect(contract.response_obligation).toMatch(/pregunta|paraguas|eje/i);
    expect(contract.response_obligation).not.toMatch(/trabajar.*como eje/i);
  });

  it("ancla paraguas confirmado sin reabrir menú", () => {
    expect(contract.response_obligation).toMatch(/paraguas confirmado|validar/i);
  });

  it("THIS TURN no dice continuar conversación genérica", () => {
    const block = buildConversationContractPromptBlock(contract);
    expect(block).toMatch(/paraguas|pregunta|DELIVER/i);
    expect(block).not.toMatch(/continuar conversación estratégica/i);
  });

  it("obligación mínima igual entre modelos", () => {
    const commercial = buildConversationContractForTurn({
      brief,
      userMessage: BORINGSTORE_LAST_USER_MESSAGE,
      conversationExcerpt: excerpt,
      thinkingPrimaryKey: "commercial",
    });
    expect(commercial.response_obligation).toBe(contract.response_obligation);
    expect(contract.response_obligation).not.toMatch(/ruptura|deseo inesperado|ironía/i);
  });
});
