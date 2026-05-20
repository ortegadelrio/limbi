import { describe, expect, it, vi } from "vitest";
import { conceptualFallbackUsesForbiddenGenericLabels } from "@/lib/brainstormer/build-conceptual-output-fallback";
import { buildBrandDnaForBrainstormer } from "@/lib/brainstormer/build-brand-dna-for-brainstormer";
import {
  BORINGSTORE_KNOWLEDGE_FIXTURE,
  BORINGSTORE_LIMBIC_FIXTURE,
} from "@/lib/brainstormer/boringstore-thinking-model-audit.fixture";
import { buildBrainstormerOutputFallback } from "@/lib/brainstormer/build-brainstormer-output-fallback";
import {
  assistantMessageHasVisibleLeaks,
  findVisibleLeakIssues,
} from "@/lib/brainstormer/sanitize-visible-assistant-message";
import {
  applyBrainstormerOutputQualityGate,
  hasDisruptorBridgePhrase,
  validateBrainstormerOutputQuality,
} from "@/lib/brainstormer/validate-brainstormer-output-quality";
import type { BrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";
import { emptyBrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";

const UMBRELLA = "No sabías que lo querías";

const DNA_NO_EVIDENCE = `evidence_allowed: Solo pruebas ya en la base; no inventar casos ni cifras.`;

const BORINGSTORE_DNA_BLOCK = buildBrandDnaForBrainstormer({
  knowledge_payload: BORINGSTORE_KNOWLEDGE_FIXTURE,
  limbic_payload: BORINGSTORE_LIMBIC_FIXTURE,
}).block;

function briefWithUmbrella(): BrainstormerWorkingBrief {
  const b = emptyBrainstormerWorkingBrief();
  b.confirmed_conceptual_umbrella = UMBRELLA;
  return b;
}

const GENERIC_LANDING_RESPONSE = `
Para convertir el concepto en compras, haría una landing con CTA claro, testimonios de clientes,
producto del día, descubrimientos recomendados y joyas ocultas. La curiosidad y el descubrimiento
serían el eje: teasers visuales, gamificación y productos únicos en la página.
`.trim();

const DISRUPTOR_GOOD_RESPONSE = `
Yo lo llevaría con un producto falso que abre la risa bajo «No sabías que lo querías»: un objeto
que no existe, pero esto sí — el producto real en la página. El producto falso abre la conversación; el producto real captura la compra.
Gancho creativo → deseo inesperado → producto real → compra como consecuencia del deseo provocado.
`.trim();

const WEAK_REPAIR_STILL_BAD = `
Haría una landing con CTA, testimonios y descubrimientos recomendados. La curiosidad sería el eje
con teasers visuales para generar expectativa genérica.
`.trim();

const COMMERCIAL_TESTIMONIALS_RESPONSE = `
Landing con producto real, CTA y carrito. Mostraríamos testimonios y reseñas verificadas de clientes
satisfechos, más un descuento del 20% para cerrar la compra.
`.trim();

const COMMERCIAL_GOOD_RESPONSE = `
Conecto «No sabías que lo querías» a venta: sketch → landing con producto real, CTA y carrito.
La objeción («¿es broma?») se responde con el producto real; cuando existan reseñas verificadas,
las usamos — hoy, reacciones reales de usuarios en la pieza de expectativa.
`.trim();

const GENERIC_CONCEPT_RESPONSE = `
El paraguas sería «Lo inesperado en lo cotidiano»: Descubre lo inesperado en productos mundanos.
Curiosidad creativa para toda la campaña.
`.trim();

const TEASER_ONLY_EXPECTATION = `
Para expectativa usaría teasers visuales y curiosidad en redes. Calendario de teasers y descubrimiento
de productos cada semana.
`.trim();

const TACTICAL_WITHOUT_CONCEPT = `
Arrancaría con calendario editorial, teasers visuales, influencers y hashtags. Publicaciones en
redes tres veces por semana y un plan de contenidos para la campaña.
`.trim();

describe("buildBrainstormerOutputFallback", () => {
  it("Disruptor conversion_bridge: contiene puente, producto falso/real y compra", () => {
    const fb = buildBrainstormerOutputFallback({
      turn_intent: "conversion_bridge",
      thinking_model_key: "explorer",
      working_brief: briefWithUmbrella(),
    });
    expect(hasDisruptorBridgePhrase(fb)).toBe(true);
    expect(fb).toMatch(/producto falso|producto real|compra/i);
    expect(fb).toMatch(/abre la conversaci[oó]n.*captura la compra/i);
    const v = validateBrainstormerOutputQuality({
      assistant_message: fb,
      turn_intent: "conversion_bridge",
      thinking_model_key: "explorer",
      working_brief: briefWithUmbrella(),
    });
    expect(v.ok).toBe(true);
  });

  it("Comercial conversion_bridge: no inventa testimonios como hechos", () => {
    const fb = buildBrainstormerOutputFallback({
      turn_intent: "conversion_bridge",
      thinking_model_key: "commercial",
      working_brief: briefWithUmbrella(),
    });
    expect(fb).toMatch(/cuando existan reseñas|reacciones reales/i);
    expect(fb).not.toMatch(/testimonios de clientes satisfechos/i);
    const v = validateBrainstormerOutputQuality({
      assistant_message: fb,
      turn_intent: "conversion_bridge",
      thinking_model_key: "commercial",
      working_brief: briefWithUmbrella(),
      brand_dna: DNA_NO_EVIDENCE,
    });
    expect(v.ok).toBe(true);
  });

  it("conceptual_strategy_request con paraguas: Ese es el paraguas. No lo cambiaría.", () => {
    const fb = buildBrainstormerOutputFallback({
      turn_intent: "conceptual_strategy_request",
      thinking_model_key: "explorer",
      working_brief: briefWithUmbrella(),
      last_user_message: "¿Cuál es el mensaje conector? Pensaba en No sabías que lo querías",
    });
    expect(fb).toMatch(/Ese es el paraguas.*No lo cambiar[ií]a/i);
    expect(fb).toMatch(/No sab[ií]as/);
  });

  it("campaign_expectation: ocultar, revelar, tensión y paraguas", () => {
    const fb = buildBrainstormerOutputFallback({
      turn_intent: "campaign_expectation",
      thinking_model_key: "explorer",
      working_brief: briefWithUmbrella(),
    });
    expect(fb).toMatch(/ocultamos|revelamos|tensi[oó]n/i);
    expect(fb).toMatch(/seguir|No sab[ií]as/i);
    const v = validateBrainstormerOutputQuality({
      assistant_message: fb,
      turn_intent: "campaign_expectation",
      thinking_model_key: "explorer",
      working_brief: briefWithUmbrella(),
    });
    expect(v.ok).toBe(true);
  });

  it("campaign_expectation con paraguas contaminado en brief usa cita limpia", () => {
    const brief = briefWithUmbrella();
    brief.confirmed_conceptual_umbrella =
      'Estaba pensando en "No sabías que lo querías". ¿Qué piensas?';
    const fb = buildBrainstormerOutputFallback({
      turn_intent: "campaign_expectation",
      thinking_model_key: "explorer",
      working_brief: brief,
      last_user_message: "¿Esto qué etapa de campaña es?",
    });
    expect(fb).toMatch(/«No sab[ií]as que lo quer[ií]as»/);
    expect(fb).not.toMatch(/estaba pensando/i);
    expect(fb).not.toMatch(/qu[eé] piensas/i);
  });

  it("fallbacks no contienen etiquetas de modelo ni lenguaje meta", () => {
    const intents = [
      ["conceptual_strategy_request", "explorer"] as const,
      ["campaign_expectation", "explorer"] as const,
      ["conversion_bridge", "explorer"] as const,
      ["conversion_bridge", "commercial"] as const,
    ];
    for (const [intent, model] of intents) {
      const fb = buildBrainstormerOutputFallback({
        turn_intent: intent,
        thinking_model_key: model,
        working_brief: briefWithUmbrella(),
      });
      expect(assistantMessageHasVisibleLeaks(fb)).toBe(false);
      expect(fb).not.toMatch(/desde\s+(comercial|disruptor|planner)/i);
    }
  });

  it("conceptual_strategy_request fallback pasa validación completa", () => {
    const fb = buildBrainstormerOutputFallback({
      turn_intent: "conceptual_strategy_request",
      thinking_model_key: "explorer",
      working_brief: briefWithUmbrella(),
    });
    const v = validateBrainstormerOutputQuality({
      assistant_message: fb,
      turn_intent: "conceptual_strategy_request",
      thinking_model_key: "explorer",
      working_brief: briefWithUmbrella(),
    });
    expect(v.ok).toBe(true);
    expect(v.issues).toHaveLength(0);
  });

  it("conceptual_strategy_request sin paraguas: no propone conceptos genéricos prohibidos", () => {
    const fb = buildBrainstormerOutputFallback(
      {
        turn_intent: "conceptual_strategy_request",
        thinking_model_key: "explorer",
        working_brief: emptyBrainstormerWorkingBrief(),
        last_user_message:
          "Necesito definir un mensaje que sirva como conector de toda la campaña",
      },
      { brand_dna: BORINGSTORE_DNA_BLOCK },
    );
    expect(conceptualFallbackUsesForbiddenGenericLabels(fb)).toBe(false);
    expect(fb).not.toMatch(
      /Descubrimientos Sorprendentes|Conexi[oó]n Aut[eé]ntica|La rutina tambi[eé]n puede ser extraordinaria/i,
    );
    expect(fb).toMatch(/Mi paraguas ser[ií]a «/);
    expect(fb).not.toMatch(/\bmen[uú]\s+de\b|varias\s+opciones|tres\s+opciones/i);
  });

  it("Boringstore DNA: fallback conceptual propone deseo inesperado concreto", () => {
    const fb = buildBrainstormerOutputFallback(
      {
        turn_intent: "conceptual_strategy_request",
        thinking_model_key: "explorer",
        working_brief: emptyBrainstormerWorkingBrief(),
        last_user_message:
          "Necesito definir un mensaje que sirva como conector de toda la campaña",
      },
      { brand_dna: BORINGSTORE_DNA_BLOCK },
    );
    expect(fb).toMatch(
      /deseo inesperado|no lo buscabas|ahora lo quieres|no lo necesitabas|hasta que lo viste/i,
    );
    const v = validateBrainstormerOutputQuality({
      assistant_message: fb,
      turn_intent: "conceptual_strategy_request",
      thinking_model_key: "explorer",
      working_brief: emptyBrainstormerWorkingBrief(),
      brand_dna: BORINGSTORE_DNA_BLOCK,
      last_user_message:
        "Necesito definir un mensaje que sirva como conector de toda la campaña",
    });
    expect(v.ok).toBe(true);
  });

  it("usuario propone «No sabías que lo querías»: valida sin reemplazar", () => {
    const fb = buildBrainstormerOutputFallback(
      {
        turn_intent: "conceptual_strategy_request",
        thinking_model_key: "explorer",
        working_brief: emptyBrainstormerWorkingBrief(),
        last_user_message:
          'Estaba pensando en "No sabías que lo querías". ¿Qué piensas?',
      },
      { brand_dna: BORINGSTORE_DNA_BLOCK },
    );
    expect(fb).toMatch(/Ese es el paraguas.*No lo cambiar[ií]a/i);
    expect(fb).toMatch(/No sab[ií]as que lo quer[ií]as/);
    expect(fb).not.toMatch(/Mi paraguas ser[ií]a «No lo buscabas/i);
  });
});

describe("applyBrainstormerOutputQualityGate — fallback tras reparación fallida", () => {
  const gateArgs = {
    turn_intent: "conversion_bridge" as const,
    thinking_model_key: "explorer" as const,
    working_brief: briefWithUmbrella(),
    last_user_message: "¿Cómo convertimos ese concepto en compras dentro de la página?",
    working_brief_block: `confirmed_umbrella: ${UMBRELLA}`,
    thinking_model_block: "THINKING MODEL (internal — Disruptor)",
    brand_dna: DNA_NO_EVIDENCE,
  };

  it("si reparación sigue fallando, usa fallback y NO guarda la versión floja", async () => {
    const repair = vi.fn().mockResolvedValue(WEAK_REPAIR_STILL_BAD);
    const result = await applyBrainstormerOutputQualityGate({
      ...gateArgs,
      assistant_message: GENERIC_LANDING_RESPONSE,
      generateRepair: repair,
    });
    expect(repair).toHaveBeenCalledTimes(1);
    expect(result.repair_attempted).toBe(true);
    expect(result.repair_used).toBe(true);
    expect(result.repair_still_failed).toBe(true);
    expect(result.fallback_used).toBe(true);
    expect(result.assistant_message).not.toBe(GENERIC_LANDING_RESPONSE);
    expect(result.assistant_message).not.toBe(WEAK_REPAIR_STILL_BAD);
    expect(hasDisruptorBridgePhrase(result.assistant_message)).toBe(true);
    expect(result.assistant_message).toMatch(/producto falso|producto real|compra/i);
    expect(result.pre_repair_issues.length).toBeGreaterThan(0);
  });

  it("reparación exitosa no usa fallback", async () => {
    const repair = vi.fn().mockResolvedValue(DISRUPTOR_GOOD_RESPONSE);
    const result = await applyBrainstormerOutputQualityGate({
      ...gateArgs,
      assistant_message: GENERIC_LANDING_RESPONSE,
      generateRepair: repair,
    });
    expect(result.fallback_used).toBe(false);
    expect(result.assistant_message).toBe(DISRUPTOR_GOOD_RESPONSE);
    expect(result.quality.ok).toBe(true);
  });

  it("respuesta válida inicial no dispara reparación ni fallback", async () => {
    const repair = vi.fn();
    const result = await applyBrainstormerOutputQualityGate({
      ...gateArgs,
      assistant_message: DISRUPTOR_GOOD_RESPONSE,
      generateRepair: repair,
    });
    expect(repair).not.toHaveBeenCalled();
    expect(result.fallback_used).toBe(false);
  });
});

describe("validateBrainstormerOutputQuality — rechazos", () => {
  it("rechaza respuesta genérica Disruptor conversion", () => {
    const r = validateBrainstormerOutputQuality({
      assistant_message: GENERIC_LANDING_RESPONSE,
      turn_intent: "conversion_bridge",
      thinking_model_key: "explorer",
      working_brief: briefWithUmbrella(),
    });
    expect(r.ok).toBe(false);
    expect(r.repair_instruction).toMatch(/REEMPLAZA|esto no existe/i);
  });

  it("rechaza testimonios Comercial sin evidencia", () => {
    const r = validateBrainstormerOutputQuality({
      assistant_message: COMMERCIAL_TESTIMONIALS_RESPONSE,
      turn_intent: "conversion_bridge",
      thinking_model_key: "commercial",
      working_brief: briefWithUmbrella(),
      brand_dna: DNA_NO_EVIDENCE,
    });
    expect(r.ok).toBe(false);
    expect(r.issues.join(" ")).toMatch(/testimonios|reseñas/i);
  });

  it("rechaza concepto genérico", () => {
    const r = validateBrainstormerOutputQuality({
      assistant_message: GENERIC_CONCEPT_RESPONSE,
      turn_intent: "conceptual_strategy_request",
      thinking_model_key: "explorer",
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(r.ok).toBe(false);
  });

  it("rechaza expectativa solo teasers", () => {
    const r = validateBrainstormerOutputQuality({
      assistant_message: TEASER_ONLY_EXPECTATION,
      turn_intent: "campaign_expectation",
      thinking_model_key: "explorer",
      working_brief: briefWithUmbrella(),
    });
    expect(r.ok).toBe(false);
  });

  it("rechaza lenguaje interno visible al usuario", () => {
    const leaks = [
      "Desde Comercial, conectaría el concepto a la landing.",
      "Tomaría postura con una idea rectora concreta sobre el paraguas.",
      "Esto es interno: el sistema debe incluir el puente.",
    ];
    for (const msg of leaks) {
      expect(assistantMessageHasVisibleLeaks(msg)).toBe(true);
      const issues = findVisibleLeakIssues(msg);
      expect(issues.length).toBeGreaterThan(0);
      const r = validateBrainstormerOutputQuality({
        assistant_message: msg,
        turn_intent: "conceptual_strategy_request",
        thinking_model_key: "explorer",
        working_brief: briefWithUmbrella(),
      });
      expect(r.ok).toBe(false);
    }
  });
});
