import { describe, expect, it } from "vitest";
import {
  buildCompactThinkingModelPromptBlock,
  DISRUPTOR_FORBIDDEN_GENERIC_CONCEPTS,
  getCompactThinkingModelDelta,
  resolveThinkingModelForBrainstormer,
} from "@/lib/ai/thinking-models";

const BORINGSTORE_PHRASE = "No sabías que lo querías";

function compactBlock(primaryKey: "explorer" | "commercial", challengeText: string): string {
  return buildCompactThinkingModelPromptBlock({
    resolved: resolveThinkingModelForBrainstormer({
      selectedKey: primaryKey,
      challengeText,
    }),
  });
}

describe("deltas compactos — diferenciación Disruptor vs Comercial (Boringstore)", () => {
  const disruptorBlock = compactBlock("explorer", `Lanzamiento Boringstore. ${BORINGSTORE_PHRASE}`);
  const commercialBlock = compactBlock("commercial", `Lanzamiento Boringstore. ${BORINGSTORE_PHRASE}`);

  const disruptorDelta = getCompactThinkingModelDelta("explorer");
  const commercialDelta = getCompactThinkingModelDelta("commercial");

  it("Disruptor evita familia genérica sin enumerar clichés literales", () => {
    expect(disruptorDelta).toMatch(/familia genérica de descubrimiento|curiosidad vacía/i);
    expect(disruptorDelta).toMatch(/ruptura|deseo inesperado|ironía|idea conversable/i);
    expect(disruptorDelta).not.toMatch(/Descubre lo inesperado|Explora lo extraordinario|Viaje de descubrimiento/i);
    expect(disruptorBlock).toMatch(/DISRUPTOR/i);
    expect(disruptorBlock).not.toMatch(/Puente obligatorio.*landing.*CTA/i);
    expect(disruptorDelta.length).toBeLessThan(400);
  });

  it("lista DISRUPTOR_FORBIDDEN_GENERIC_CONCEPTS sigue existiendo para tests de producto", () => {
    expect(DISRUPTOR_FORBIDDEN_GENERIC_CONCEPTS.length).toBeGreaterThan(0);
    expect(disruptorDelta).not.toContain(DISRUPTOR_FORBIDDEN_GENERIC_CONCEPTS[0]!);
  });

  it("Comercial exige puente concepto → compra", () => {
    expect(commercialDelta).toMatch(
      /concepto.*deseo.*producto real.*landing.*CTA.*compra/i,
    );
    expect(commercialDelta).toMatch(/compra|conversión|CTA|landing|fricción|prueba/i);
    expect(commercialBlock).toMatch(/COMERCIAL/i);
    expect(commercialBlock).not.toMatch(/Evitar como territorio/i);
  });

  it("Disruptor y Comercial no comparten la misma formulación principal", () => {
    expect(disruptorDelta).not.toEqual(commercialDelta);
    expect(disruptorDelta).toMatch(/^DISRUPTOR:/);
    expect(commercialDelta).toMatch(/^COMERCIAL:/);
    expect(disruptorBlock).not.toBe(commercialBlock);
  });
});

describe("deltas compactos — Planner, Empático, Conceptual distintos", () => {
  it("cada modelo tiene apertura y foco no intercambiables", () => {
    const keys = ["explorer", "commercial", "architect", "empathic", "symbolic"] as const;
    const deltas = keys.map((k) => getCompactThinkingModelDelta(k));
    const unique = new Set(deltas);
    expect(unique.size).toBe(keys.length);

    expect(getCompactThinkingModelDelta("architect")).toMatch(/PLANNER|secuencia|sin volverse táctico/i);
    expect(getCompactThinkingModelDelta("empathic")).toMatch(/EMPÁTICO|barrera|sin tono sentimental/i);
    expect(getCompactThinkingModelDelta("symbolic")).toMatch(/CONCEPTUAL|metáfora|idea madre/i);
  });
});
