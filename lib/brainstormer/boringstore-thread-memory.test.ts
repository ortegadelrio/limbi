import { describe, expect, it } from "vitest";
import {
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  buildWorkingBriefPromptBlock,
  classifyBrainstormerTurnIntent,
  updateBrainstormerWorkingBrief,
  emptyBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";

const BORINGSTORE_THREAD = [
  "No sabías que lo querías",
  "Ese sería el paraguas",
  "¿Cuál es la ruta a seguir?",
  "¿Esto qué etapa de campaña es? Tenemos un sketch de producto falso para expectativa.",
  "¿Cómo lo convertimos en compras en la página?",
] as const;

function buildExcerptThrough(index: number): string {
  return BORINGSTORE_THREAD.slice(0, index + 1)
    .map((m) => `user: ${m}`)
    .join("\n\n");
}

function simulateBriefThroughTurn(turnIndex: number) {
  let brief = emptyBrainstormerWorkingBrief();
  for (let i = 0; i <= turnIndex; i++) {
    brief = updateBrainstormerWorkingBrief({
      prior: brief,
      userMessage: BORINGSTORE_THREAD[i]!,
      conversationExcerpt: buildExcerptThrough(i > 0 ? i - 1 : 0),
    });
  }
  return brief;
}

describe("Boringstore — hilo con memoria de paraguas y etapas", () => {
  it("confirma paraguas tras «Ese sería el paraguas» y no reabre opciones", () => {
    const brief = simulateBriefThroughTurn(1);
    expect(brief.confirmed_conceptual_umbrella).toMatch(/no sab[ií]as que lo quer[ií]as/i);
    expect(brief.confirmed_decisions.some((d) => /paraguas/i.test(d))).toBe(true);

    const contract = buildConversationContractForTurn({
      brief,
      userMessage: BORINGSTORE_THREAD[2]!,
      conversationExcerpt: buildExcerptThrough(2),
      thinkingPrimaryKey: "explorer",
    });

    expect(classifyBrainstormerTurnIntent(BORINGSTORE_THREAD[2]!)).toBe("next_step");
    expect(contract.include_closing_question).toBe(false);
    expect(contract.response_obligation).toMatch(/expectativa|lanzamiento|conversi[oó]n|sostenimiento/i);
    expect(contract.response_obligation).not.toMatch(/2–3 paraguas/i);
    expect(contract.forbidden_response_patterns.join(" ")).toMatch(
      /familia genérica de descubrimiento|curiosidad decorativa/i,
    );

    const block = buildWorkingBriefPromptBlock(brief);
    expect(block).toContain("confirmed_umbrella:");
    expect(block).toMatch(/interno: no reemplazar paraguas/i);
  });

  it("ubica sketch en expectativa y usa marco de campaña, no producción", () => {
    const brief = simulateBriefThroughTurn(3);
    expect(brief.campaign_stage).toBe("expectativa");

    const contract = buildConversationContractForTurn({
      brief,
      userMessage: BORINGSTORE_THREAD[3]!,
      conversationExcerpt: buildExcerptThrough(3),
    });

    expect(classifyBrainstormerTurnIntent(BORINGSTORE_THREAD[3]!)).toBe("campaign_stage_inquiry");
    expect(contract.response_obligation).toMatch(/expectativa|prelanzamiento|lanzamiento|conversi[oó]n|sostenimiento/i);
    expect(contract.response_obligation).toMatch(/NO producción|conceptualizaci[oó]n|desarrollo de contenido/i);
    expect(contract.response_obligation).not.toMatch(/solo desarrollo de contenido como etapa/i);

    const prompt = buildConversationContractPromptBlock(contract);
    expect(prompt).toMatch(/interno: paraguas confirmado.*no sab[ií]as/i);
  });

  it("responde conversión con puente creativo, no e-commerce genérico", () => {
    const brief = simulateBriefThroughTurn(4);

    const contractDisruptor = buildConversationContractForTurn({
      brief,
      userMessage: BORINGSTORE_THREAD[4]!,
      conversationExcerpt: buildExcerptThrough(4),
      thinkingPrimaryKey: "explorer",
    });

    expect(classifyBrainstormerTurnIntent(BORINGSTORE_THREAD[4]!)).toBe("conversion_bridge");
    expect(contractDisruptor.response_obligation).toMatch(
      /producto falso|mecanismo creativo|deseo inesperado|no sab[ií]as/i,
    );
    expect(contractDisruptor.forbidden_response_patterns.join(" ")).toMatch(
      /SEO genérico|checklist e-commerce/i,
    );

    const contractCommercial = buildConversationContractForTurn({
      brief,
      userMessage: BORINGSTORE_THREAD[4]!,
      conversationExcerpt: buildExcerptThrough(4),
      thinkingPrimaryKey: "commercial",
    });
    expect(contractCommercial.response_obligation).toMatch(/landing|CTA|carrito|objeción|prueba/i);
    expect(contractDisruptor.response_obligation).not.toBe(contractCommercial.response_obligation);
  });
});
