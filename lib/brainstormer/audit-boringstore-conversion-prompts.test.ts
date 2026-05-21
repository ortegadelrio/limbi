import { describe, expect, it } from "vitest";
import {
  auditBoringstoreConversionPrompts,
  BORINGSTORE_CONVERSION_LAST_MESSAGE,
  BORINGSTORE_CONVERSION_LAST_MESSAGE_MATCHING,
  formatConversionAuditReport,
} from "@/lib/brainstormer/audit-boringstore-conversion-prompts";
import { classifyBrainstormerTurnIntent } from "@/lib/brainstormer/conversation-contract";
import { buildBoringstoreConversionThreadExcerpt } from "@/lib/brainstormer/audit-boringstore-conversion-prompts";

describe("Boringstore — auditoría conversión Disruptor vs Comercial", () => {
  const auditObserved = auditBoringstoreConversionPrompts(BORINGSTORE_CONVERSION_LAST_MESSAGE);
  const auditMatching = auditBoringstoreConversionPrompts(
    BORINGSTORE_CONVERSION_LAST_MESSAGE_MATCHING,
  );
  const excerpt = buildBoringstoreConversionThreadExcerpt();

  it("imprime reporte completo cuando BRAINSTORMER_AUDIT_PRINT=true", () => {
    const report = formatConversionAuditReport(auditObserved);
    expect(report.length).toBeGreaterThan(2000);
    if (process.env.BRAINSTORMER_AUDIT_PRINT === "true") {
      // eslint-disable-next-line no-console
      console.log("\n" + report);
      // eslint-disable-next-line no-console
      console.log("\n--- VARIANTE (patrones actuales) ---\n");
      // eslint-disable-next-line no-console
      console.log(formatConversionAuditReport(auditMatching));
    }
  });

  it("mensaje observado: clasifica conversion_bridge", () => {
    expect(
      classifyBrainstormerTurnIntent(BORINGSTORE_CONVERSION_LAST_MESSAGE, excerpt),
    ).toBe("conversion_bridge");
    expect(auditObserved.intent_disruptor).toBe("conversion_bridge");
    expect(auditObserved.disruptor.this_turn_block).toMatch(/compra|Convertir el concepto/i);
  });

  it("variante «cómo lo convertimos en compras en la página»: sí es conversion_bridge", () => {
    expect(
      classifyBrainstormerTurnIntent(BORINGSTORE_CONVERSION_LAST_MESSAGE_MATCHING, excerpt),
    ).toBe("conversion_bridge");
    expect(auditMatching.disruptor.this_turn_block).toMatch(/puente compra|compra en p[aá]gina/i);
  });

  it("conversion_bridge: obligación compartida y paraguas en brief", () => {
    expect(auditObserved.conversion_obligation_identical).toBe(true);
    expect(auditObserved.disruptor.brief_snapshot.confirmed_conceptual_umbrella).toMatch(
      /no sab[ií]as/i,
    );
    expect(auditObserved.disruptor.conversion_obligation_raw).toMatch(/pregunta|paraguas|compra/i);
  });

  it("deltas sí difieren; Disruptor sin CTA dominante en delta", () => {
    expect(auditObserved.disruptor.delta_only).not.toBe(auditObserved.commercial.delta_only);
    expect(auditObserved.disruptor.delta_only).toMatch(/ruptura|deseo inesperado|ironía/i);
    expect(auditObserved.commercial.delta_only).toMatch(/compra|CTA|landing|conversión/i);
    expect(auditObserved.disruptor.delta_only).not.toMatch(/Descubre lo inesperado/i);
  });

  it("Brand DNA compartido; sin clichés literales en campos", () => {
    expect(auditObserved.dna_literal_cliches).toEqual([]);
    expect(auditObserved.disruptor.brand_dna_block).toBe(auditObserved.commercial.brand_dna_block);
    expect(auditObserved.dna_fields.conversion_mechanism).toMatch(/producto falso|landing|CTA/i);
  });

  it("sin clichés literales en full_input", () => {
    expect(auditObserved.disruptor.literal_cliches_in_prompt).toEqual([]);
    expect(auditObserved.commercial.literal_cliches_in_prompt).toEqual([]);
  });
});
