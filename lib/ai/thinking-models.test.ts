import { describe, expect, it } from "vitest";
import {
  DEFAULT_THINKING_MODEL_KEY,
  LIMBI_THINKING_CANON,
  THINKING_MODELS,
  THINKING_MODEL_SELECTOR_OPTIONS,
  buildCompactThinkingModelPromptBlock,
  buildLimbiThinkingCanonPromptBlock,
  buildThinkingModelPromptBlock,
  getThinkingModelByKey,
  resolveThinkingModelForBrainstormer,
} from "@/lib/ai/thinking-models";

describe("thinking-models — configuración", () => {
  it("expone los seis modelos públicos (incluye Limbi orquestador)", () => {
    expect(THINKING_MODELS).toHaveLength(6);
    expect(THINKING_MODEL_SELECTOR_OPTIONS).toHaveLength(6);
    expect(THINKING_MODEL_SELECTOR_OPTIONS).toContain("limbi");
  });

  it("Limbi es default", () => {
    expect(DEFAULT_THINKING_MODEL_KEY).toBe("limbi");
  });

  it("Comercial y Conceptual conservan nombre público", () => {
    expect(getThinkingModelByKey("commercial")?.publicName).toBe("Comercial");
    expect(getThinkingModelByKey("symbolic")?.publicName).toBe("Conceptual");
  });

  it("Empático y Conceptual no se fusionan (claves y guardrails distintos)", () => {
    const empathic = getThinkingModelByKey("empathic")!;
    const symbolic = getThinkingModelByKey("symbolic")!;
    expect(empathic.key).not.toBe(symbolic.key);
    expect(empathic.publicName).toBe("Empático");
    expect(symbolic.publicName).toBe("Conceptual");
    expect(empathic.guardrails.join(" ")).toMatch(/audiencia/i);
    expect(symbolic.guardrails.join(" ")).toMatch(/símbolo|simbolo|narrativa/i);
  });
});

describe("thinking-models — canon transversal", () => {
  it("incluye guardrails sobre Base de Marca, tensiones, Base Límbica, tácticas y paraguas", () => {
    const joined = LIMBI_THINKING_CANON.join(" ");
    expect(joined).toMatch(/Base de Marca/i);
    expect(joined).toMatch(/tensiones/i);
    expect(joined).toMatch(/simbólicamente|simbólicamente/i);
    expect(joined).toMatch(/tácticas/i);
    expect(joined).toMatch(/paraguas conceptual/i);
  });

  it("bloque compacto de modelo es delta corto", () => {
    const compact = buildCompactThinkingModelPromptBlock({
      resolved: resolveThinkingModelForBrainstormer({
        selectedKey: "explorer",
        challengeText: "campaña diferente",
      }),
    });
    expect(compact).toContain("THINKING MODEL");
    expect(compact).toContain("Delta:");
    expect(compact.length).toBeLessThan(1200);
    expect(compact).not.toContain("Reasoning ritual:");
    expect(compact).toMatch(/internal|no repetir etiquetas/i);
  });

  it("canon y modelo van en bloques separados con roles distintos", () => {
    const canon = buildLimbiThinkingCanonPromptBlock();
    const model = buildThinkingModelPromptBlock({
      resolved: resolveThinkingModelForBrainstormer({
        selectedKey: "commercial",
        challengeText: "vender más",
      }),
    });
    expect(canon).toContain("LIMBI THINKING CANON");
    expect(canon).toMatch(/mandatory boundaries.*does not neutralize the active thinking model/i);
    expect(model).toContain("ACTIVE THINKING MODEL");
    expect(model).toMatch(/main reasoning engine for how/i);
    expect(model).not.toContain("LIMBI THINKING CANON (transversal");
  });
});

describe("thinking-models — resolución automática Limbi", () => {
  it("reto de venta → Comercial", () => {
    const r = resolveThinkingModelForBrainstormer({
      selectedKey: "limbi",
      challengeText: "Necesitamos mejorar la conversión del landing y cerrar más leads",
    });
    expect(r.primaryKey).toBe("commercial");
  });

  it("reto de campaña diferente → Disruptor", () => {
    const r = resolveThinkingModelForBrainstormer({
      selectedKey: "limbi",
      challengeText: "Queremos una campaña de activación con un concepto creativo diferente",
    });
    expect(r.primaryKey).toBe("explorer");
  });

  it("reto de ordenar portafolio → Planner", () => {
    const r = resolveThinkingModelForBrainstormer({
      selectedKey: "limbi",
      challengeText: "Hay que ordenar el portafolio y la propuesta de valor con más claridad",
    });
    expect(r.primaryKey).toBe("architect");
  });

  it("reto de audiencia/confianza → Empático", () => {
    const r = resolveThinkingModelForBrainstormer({
      selectedKey: "limbi",
      challengeText: "La audiencia no confía y hay barreras de percepción",
    });
    expect(r.primaryKey).toBe("empathic");
  });

  it("reto de narrativa/manifiesto → Conceptual", () => {
    const r = resolveThinkingModelForBrainstormer({
      selectedKey: "limbi",
      challengeText: "Necesitamos un manifiesto con tono y atmósfera narrativa",
    });
    expect(r.primaryKey).toBe("symbolic");
  });

  it("lanzamiento creativo de venta → Comercial + Disruptor", () => {
    const r = resolveThinkingModelForBrainstormer({
      selectedKey: "limbi",
      challengeText: "Lanzamiento creativo de campaña que debe vender y convertir",
    });
    expect(r.primaryKey).toBe("commercial");
    expect(r.secondaryKey).toBe("explorer");
  });

  it("causa social → Empático + Conceptual", () => {
    const r = resolveThinkingModelForBrainstormer({
      selectedKey: "limbi",
      challengeText: "Campaña de causa social movilizadora",
    });
    expect(r.primaryKey).toBe("empathic");
    expect(r.secondaryKey).toBe("symbolic");
  });

  it("modelo fijo no resuelve secundario", () => {
    const r = resolveThinkingModelForBrainstormer({
      selectedKey: "architect",
      challengeText: "cualquier texto",
    });
    expect(r.primaryKey).toBe("architect");
    expect(r.secondaryKey).toBeNull();
    expect(r.isAutoResolved).toBe(false);
  });
});
