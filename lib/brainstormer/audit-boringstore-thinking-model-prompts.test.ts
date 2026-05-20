import { describe, expect, it } from "vitest";
import {
  auditBoringstoreThinkingModelPrompts,
  countGenericFamilyTerms,
  formatThinkingModelAuditReport,
} from "@/lib/brainstormer/audit-boringstore-thinking-model-prompts";
import {
  BORINGSTORE_KNOWLEDGE_FIXTURE,
  BORINGSTORE_LIMBIC_FIXTURE,
  BORINGSTORE_LAST_USER_MESSAGE,
  buildBoringstoreThreadExcerpt,
} from "@/lib/brainstormer/boringstore-thinking-model-audit.fixture";

const auditArgs = {
  knowledge_payload: BORINGSTORE_KNOWLEDGE_FIXTURE,
  limbic_payload: BORINGSTORE_LIMBIC_FIXTURE,
  conversation_excerpt: buildBoringstoreThreadExcerpt(),
  last_user_message: BORINGSTORE_LAST_USER_MESSAGE,
};

describe("Boringstore — auditoría Disruptor vs Comercial (full_input)", () => {
  const comparison = auditBoringstoreThinkingModelPrompts(auditArgs);

  it("imprime reporte de auditoría (muestras full_input)", () => {
    const report = formatThinkingModelAuditReport(comparison);
    expect(report.length).toBeGreaterThan(500);
    if (process.env.BRAINSTORMER_AUDIT_PRINT === "true") {
      // eslint-disable-next-line no-console
      console.log("\n" + report);
      // eslint-disable-next-line no-console
      console.log("\n--- FULL_INPUT DISRUPTOR (primeros 4000 chars) ---\n");
      // eslint-disable-next-line no-console
      console.log(comparison.disruptor.full_input.slice(0, 4000));
      // eslint-disable-next-line no-console
      console.log("\n--- FULL_INPUT COMERCIAL (primeros 4000 chars) ---\n");
      // eslint-disable-next-line no-console
      console.log(comparison.commercial.full_input.slice(0, 4000));
    }
  });

  it("mismo ADN y working brief; solo cambia bloque THINKING MODEL en adelante", () => {
    const wbD = comparison.disruptor.positions.working_brief;
    const wbC = comparison.commercial.positions.working_brief;
    expect(wbD).toBeGreaterThan(-1);
    expect(comparison.disruptor.full_input.slice(0, wbD)).toBe(
      comparison.commercial.full_input.slice(0, wbC),
    );
    expect(comparison.disruptor.thinking_model_block).not.toBe(
      comparison.commercial.thinking_model_block,
    );
  });

  it("orden: DNA → brief → THIS TURN → THINKING MODEL → director → LAST USER", () => {
    const p = comparison.disruptor.positions;
    expect(p.brand_dna).toBeLessThan(p.working_brief);
    expect(p.working_brief).toBeLessThan(p.this_turn);
    expect(p.this_turn).toBeLessThan(p.thinking_model);
    expect(p.thinking_model).toBeLessThan(p.director);
    expect(p.director).toBeLessThan(p.last_user_message);
  });

  it("Disruptor: delta con deseo inesperado, ruptura; sin puente landing/CTA dominante", () => {
    const d = comparison.disruptor.delta_only;
    const block = comparison.disruptor.thinking_model_block;
    expect(d).toMatch(/deseo inesperado|ruptura|ironía|contraste|idea conversable/i);
    expect(d).toMatch(/familia genérica de descubrimiento/i);
    expect(d).not.toMatch(/Descubre lo inesperado|Explora lo extraordinario/i);
    expect(block).toMatch(/DISRUPTOR/i);
    expect(block).not.toMatch(/Puente obligatorio.*landing.*CTA/i);
  });

  it("Comercial: delta con conversión, compra, landing, CTA", () => {
    const d = comparison.commercial.delta_only;
    const block = comparison.commercial.thinking_model_block;
    expect(d).toMatch(/conversión|compra|landing|CTA|producto real/i);
    expect(block).toMatch(/COMERCIAL/i);
    expect(d).not.toMatch(/Evitar como territorio.*Descubre lo inesperado/i);
  });

  it("no comparten la misma familia de instrucción principal", () => {
    expect(comparison.disruptor.delta_only).not.toEqual(comparison.commercial.delta_only);
    const disruptorOpening = comparison.disruptor.delta_only.split(".")[0] ?? "";
    const commercialOpening = comparison.commercial.delta_only.split(".")[0] ?? "";
    expect(disruptorOpening).toMatch(/^DISRUPTOR/);
    expect(commercialOpening).toMatch(/^COMERCIAL/);
    expect(disruptorOpening).not.toBe(commercialOpening);
  });

  it("DNA sin frases cliché literales; deltas Disruptor más cortos que antes", () => {
    const dna = comparison.dna_fields;
    expect(dna.brand_truth).toBeDefined();
    expect(dna.desired_effect).toMatch(/No sabías|deseo inesperado/i);
    expect(dna.weak_territories_to_avoid).toMatch(/familia genérica de descubrimiento/i);
    expect(comparison.disruptor.delta_only).not.toMatch(/Descubre lo inesperado/i);
    expect(comparison.disruptor.thinking_model_block_chars).toBeLessThan(500);
    expect(comparison.commercial.thinking_model_block_chars).toBeLessThan(450);
  });
});
