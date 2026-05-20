import { describe, expect, it } from "vitest";
import {
  extractConfirmedConceptualUmbrella,
  extractQuotedConceptCandidate,
  isValidConceptualUmbrellaCandidate,
  normalizeStoredConceptualUmbrella,
} from "@/lib/brainstormer/working-brief-memory";
import {
  emptyBrainstormerWorkingBrief,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";

const THREAD = [
  "No sabías que lo querías",
  "Ese sería el paraguas",
  "¿Cuál es la ruta a seguir?",
  "¿Esto qué etapa de campaña es? Tenemos un sketch de producto falso para expectativa.",
  "¿Cómo convertimos ese concepto en compras dentro de la página?",
] as const;

function buildExcerptThrough(index: number): string {
  return THREAD.slice(0, index + 1)
    .map((m) => `user: ${m}`)
    .join("\n\n");
}

function simulateThrough(turnIndex: number) {
  let brief = emptyBrainstormerWorkingBrief();
  for (let i = 0; i <= turnIndex; i++) {
    brief = updateBrainstormerWorkingBrief({
      prior: brief,
      userMessage: THREAD[i]!,
      conversationExcerpt: buildExcerptThrough(i > 0 ? i - 1 : 0),
    });
  }
  return brief;
}

describe("confirmed_conceptual_umbrella — sin corrupción por preguntas", () => {
  it("«No sabías…» + «Ese sería el paraguas» confirma el paraguas correcto", () => {
    const brief = simulateThrough(1);
    expect(brief.confirmed_conceptual_umbrella).toMatch(/no sab[ií]as que lo quer[ií]as/i);
  });

  it("pregunta de etapa NO sobrescribe el paraguas", () => {
    const brief = simulateThrough(3);
    expect(brief.confirmed_conceptual_umbrella).toMatch(/no sab[ií]as que lo quer[ií]as/i);
    expect(brief.confirmed_conceptual_umbrella).not.toMatch(/qué etapa|sketch de producto falso/i);
  });

  it("pregunta de conversión NO sobrescribe el paraguas", () => {
    const brief = simulateThrough(4);
    expect(brief.confirmed_conceptual_umbrella).toMatch(/no sab[ií]as que lo quer[ií]as/i);
  });

  it("rechaza preguntas y frases operativas como candidatos", () => {
    expect(isValidConceptualUmbrellaCandidate("¿Esto qué etapa de campaña es?")).toBe(false);
    expect(isValidConceptualUmbrellaCandidate("¿Cómo lo convertimos en compras?")).toBe(false);
    expect(isValidConceptualUmbrellaCandidate("¿Cuál es la ruta a seguir?")).toBe(false);
    expect(isValidConceptualUmbrellaCandidate("No sabías que lo querías")).toBe(true);
  });

  it("extractConfirmed recupera frase conceptual tras confirmación", () => {
    const excerpt = "user: No sabías que lo querías\n\nuser: Ese sería el paraguas";
    expect(
      extractConfirmedConceptualUmbrella({
        userMessage: "Ese sería el paraguas",
        conversationExcerpt: excerpt,
        priorUmbrella: "",
      }),
    ).toMatch(/no sab[ií]as/i);
  });
});

describe("extractQuotedConceptCandidate — comillas en contexto conceptual", () => {
  const thinkingCurly =
    "Estaba pensando en \u201CNo sabías que lo querías\u201D. \u00BFQu\u00E9 piensas?";

  it("extrae solo la frase entre comillas curvas", () => {
    expect(extractQuotedConceptCandidate(thinkingCurly)).toBe("No sabías que lo querías");
  });

  it("updateBrainstormerWorkingBrief guarda solo el paraguas citado", () => {
    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: thinkingCurly,
      conversationExcerpt: "",
    });
    expect(brief.confirmed_conceptual_umbrella).toBe("No sabías que lo querías");
    expect(brief.confirmed_conceptual_umbrella).not.toMatch(/estaba pensando/i);
    expect(brief.confirmed_conceptual_umbrella).not.toMatch(/qu[eé] piensas/i);
    expect(brief.confirmed_conceptual_umbrella).not.toMatch(/\?/);
  });

  it("comillas rectas y latinas", () => {
    expect(extractQuotedConceptCandidate('Me gusta "No sabías que lo querías"')).toBe(
      "No sabías que lo querías",
    );
    expect(extractQuotedConceptCandidate("Dejemos «No sabías que lo querías»")).toBe(
      "No sabías que lo querías",
    );
  });

  it("normaliza paraguas contaminado previamente guardado", () => {
    const corrupted =
      'Estaba pensando en "No sabías que lo querías". ¿Qué piensas?';
    expect(normalizeStoredConceptualUmbrella(corrupted)).toBe("No sabías que lo querías");
  });

  it("pregunta de conversión no sobrescribe paraguas ya confirmado", () => {
    let brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: thinkingCurly,
      conversationExcerpt: "",
    });
    brief = updateBrainstormerWorkingBrief({
      prior: brief,
      userMessage: "¿Cómo convertimos ese concepto en compras dentro de la página?",
      conversationExcerpt: `user: ${thinkingCurly}`,
    });
    expect(brief.confirmed_conceptual_umbrella).toBe("No sabías que lo querías");
  });
});
