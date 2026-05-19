import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBrandBaseSectionViews, buildBrandKnowledgeUiModel } from "@/lib/brands/brand-bases-consolidated-ui";

const root = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("bases UI — dos capas por sección", () => {
  it("componentes muestran Información de marca y Lectura de Limbi", () => {
    const dual = read("components/brands/bases/brand-bases-section-dual-layer.tsx");
    expect(dual).toContain("Información de marca");
    expect(dual).toContain("Lectura de Limbi");

    const reading = read("components/brands/bases/brand-bases-interpretive-reading.tsx");
    expect(reading).toContain("buildBrandBaseSectionViews");
    expect(reading).not.toContain("BrandBasesOfferSection");
    expect(reading).not.toContain("Interpretación por secciones");
  });

  it("v1.3 schema y prompt exigen brand_information", () => {
    const schema = read("lib/schemas/brand-base-consolidation.ts");
    expect(schema).toContain("brand-base-consolidation-v1.3");
    expect(schema).toContain("brand_information");

    const prompt = read("lib/prompts/brand-base-consolidation.ts");
    expect(prompt).toContain("brand_information");
  });

  it("buildBrandBaseSectionViews separa oferta en catálogo + lectura", () => {
    const ui = buildBrandKnowledgeUiModel({
      curator_reading: "C",
      strategic_pillars: [{ title: "P", body: "B" }],
      restrictions_and_alerts: "R",
      evidence_narrative: "E",
      executive_reading: "Ejecutiva",
      section_interpretations: [
        {
          section_key: "offer",
          headline: "Oferta",
          brand_information: "Consultoría y conferencias.",
          interpretation: "Sistema integrado, no servicios aislados.",
        },
      ],
      final_highlights: {
        key_strengths: ["a", "b"],
        strategic_tensions: ["t"],
        communication_opportunities: ["o", "p"],
        key_limbic_signals: ["l", "m"],
        narrative_care_and_avoids: ["n", "o"],
      },
      internal_base_notice: "N",
      project_readiness_message: "P",
      offer_architecture: {
        offer_nature: "service",
        offer_summary: "Resumen oferta.",
        service_catalog: [
          {
            name: "Consultoría",
            item_type: "service",
            description: "Estrategia narrativa",
            strategic_role: "",
            main_value: "",
          },
        ],
        commercial_use_guidance: "Usar catálogo en piezas comerciales.",
      },
      credibility_architecture: {
        authority_signals: [],
        institutional_roles: [],
        industry_leadership_assets: [],
        founder_credentials: [],
        business_ecosystem: [],
        reputation_proof_points: [],
        communication_use_guidance: "Sin datos.",
        cautions: [],
      },
    });
    const offer = buildBrandBaseSectionViews(ui).find((s) => s.id === "offer");
    expect(offer?.brandInformation).toContain("Consultoría");
    expect(offer?.limbiReading).toContain("Sistema integrado");
    expect(offer?.offerCatalog).toHaveLength(1);
  });
});
