import { describe, expect, it } from "vitest";
import {
  BRAND_BASES_EXECUTIVE_DISCLAIMER_ES,
  buildBrandKnowledgeUiModel,
} from "@/lib/brands/brand-bases-consolidated-ui";

describe("buildBrandKnowledgeUiModel", () => {
  it("compatibilidad v1.0: usa curator como ejecutiva y pilares como fallback de secciones", () => {
    const ui = buildBrandKnowledgeUiModel({
      curator_reading: "Síntesis curadora legada.",
      strategic_pillars: [
        { title: "Pilar A", body: "Texto del pilar." },
        { title: "Pilar B", body: "Otro cuerpo." },
      ],
      restrictions_and_alerts: "Restricciones.",
      evidence_narrative: "Evidencia.",
    });
    expect(ui.executiveReading).toBe("Síntesis curadora legada.");
    expect(ui.sectionInterpretations).toHaveLength(0);
    expect(ui.strategicPillars).toHaveLength(2);
    expect(ui.finalHighlights).toBeNull();
    expect(ui.offerArchitecture).toBeNull();
  });

  it("v1.1: respeta executive y secciones", () => {
    const ui = buildBrandKnowledgeUiModel({
      curator_reading: "Curador.",
      strategic_pillars: [{ title: "P", body: "B" }],
      restrictions_and_alerts: "R",
      evidence_narrative: "E",
      executive_reading: "Ejecutiva explícita.",
      section_interpretations: [
        {
          section_key: "identity",
          headline: "Identidad",
          interpretation: "Interpretación identidad.",
        },
      ],
      final_highlights: {
        key_strengths: ["a", "b"],
        strategic_tensions: ["t"],
        communication_opportunities: ["o", "p"],
        key_limbic_signals: ["l", "m"],
        narrative_care_and_avoids: ["n", "o"],
      },
      internal_base_notice: "Interno.",
      project_readiness_message: "Proyectos.",
      offer_architecture: {
        offer_nature: "product_service",
        offer_summary: "Resumen de oferta.",
        service_catalog: [
          {
            name: "Servicio demo",
            item_type: "service",
            description: "Desc",
            strategic_role: "Rol",
            main_value: "Valor",
          },
        ],
        commercial_use_guidance: "Usar el catálogo tal cual en piezas comerciales.",
      },
    });
    expect(ui.executiveReading).toBe("Ejecutiva explícita.");
    expect(ui.sectionInterpretations).toHaveLength(1);
    expect(ui.finalHighlights?.key_strengths).toHaveLength(2);
    expect(ui.internalBaseNotice).toBe("Interno.");
    expect(ui.offerArchitecture?.service_catalog).toHaveLength(1);
    expect(ui.offerArchitecture?.service_catalog[0]?.name).toBe("Servicio demo");
  });

  it("disclaimer estable", () => {
    expect(BRAND_BASES_EXECUTIVE_DISCLAIMER_ES.length).toBeGreaterThan(80);
  });
});
