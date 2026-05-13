import { describe, expect, it } from "vitest";
import {
  isAfterConsolidationCreatedAt,
  isBrandCuratedBaseStaleFromFacts,
} from "@/lib/brands/brand-bases-staleness";
import { buildBrandBaseConsolidationSourceSnapshot } from "@/lib/brands/build-brand-base-consolidation-context";
import { brandBaseConsolidationRawOutputSchema } from "@/lib/schemas/brand-base-consolidation";

describe("isAfterConsolidationCreatedAt", () => {
  it("returns false when timestamp is before or equal to base", () => {
    expect(isAfterConsolidationCreatedAt("2026-05-01T00:00:00Z", "2026-04-01T00:00:00Z")).toBe(
      false,
    );
    expect(isAfterConsolidationCreatedAt("2026-05-01T00:00:00Z", "2026-05-01T00:00:00Z")).toBe(
      false,
    );
  });

  it("returns true when timestamp is strictly after base", () => {
    expect(isAfterConsolidationCreatedAt("2026-05-01T00:00:00Z", "2026-05-02T00:00:00Z")).toBe(
      true,
    );
  });
});

describe("isBrandCuratedBaseStaleFromFacts", () => {
  const base = "2026-05-01T00:00:00Z";

  it("is stale when active diagnosis is stale (cascade)", () => {
    expect(
      isBrandCuratedBaseStaleFromFacts({
        baseCreatedAt: base,
        activeDiagnosisIsStale: true,
        diagnosisRenewedAfterBase: false,
        hasResponsesUpdatedAfterBase: false,
        hasSourceFactsUpdatedAfterBase: false,
        hasImprovementsApprovedAfterBase: false,
        offerProfileUpdatedAt: null,
        brandRowUpdatedAt: null,
        hasStaleOfferItems: false,
        hasStaleAudienceTerritories: false,
      }),
    ).toBe(true);
  });

  it("is stale when diagnosis was renewed after consolidation", () => {
    expect(
      isBrandCuratedBaseStaleFromFacts({
        baseCreatedAt: base,
        activeDiagnosisIsStale: false,
        diagnosisRenewedAfterBase: true,
        hasResponsesUpdatedAfterBase: false,
        hasSourceFactsUpdatedAfterBase: false,
        hasImprovementsApprovedAfterBase: false,
        offerProfileUpdatedAt: null,
        brandRowUpdatedAt: null,
        hasStaleOfferItems: false,
        hasStaleAudienceTerritories: false,
      }),
    ).toBe(true);
  });

  it("is stale when offer items changed after base", () => {
    expect(
      isBrandCuratedBaseStaleFromFacts({
        baseCreatedAt: base,
        activeDiagnosisIsStale: false,
        diagnosisRenewedAfterBase: false,
        hasResponsesUpdatedAfterBase: false,
        hasSourceFactsUpdatedAfterBase: false,
        hasImprovementsApprovedAfterBase: false,
        offerProfileUpdatedAt: null,
        brandRowUpdatedAt: null,
        hasStaleOfferItems: true,
        hasStaleAudienceTerritories: false,
      }),
    ).toBe(true);
  });

  it("is not stale when nothing changed after base", () => {
    expect(
      isBrandCuratedBaseStaleFromFacts({
        baseCreatedAt: base,
        activeDiagnosisIsStale: false,
        diagnosisRenewedAfterBase: false,
        hasResponsesUpdatedAfterBase: false,
        hasSourceFactsUpdatedAfterBase: false,
        hasImprovementsApprovedAfterBase: false,
        offerProfileUpdatedAt: null,
        brandRowUpdatedAt: null,
        hasStaleOfferItems: false,
        hasStaleAudienceTerritories: false,
      }),
    ).toBe(false);
  });

  it("is stale when offer profile updated after base", () => {
    expect(
      isBrandCuratedBaseStaleFromFacts({
        baseCreatedAt: base,
        activeDiagnosisIsStale: false,
        diagnosisRenewedAfterBase: false,
        hasResponsesUpdatedAfterBase: false,
        hasSourceFactsUpdatedAfterBase: false,
        hasImprovementsApprovedAfterBase: false,
        offerProfileUpdatedAt: "2026-06-01T00:00:00Z",
        brandRowUpdatedAt: null,
        hasStaleOfferItems: false,
        hasStaleAudienceTerritories: false,
      }),
    ).toBe(true);
  });
});

describe("brandBaseConsolidationRawOutputSchema", () => {
  it("accepts a valid v1.1 payload", () => {
    const section = (section_key: string) => ({
      section_key,
      headline: `Lectura ${section_key}`,
      interpretation:
        "Párrafo interpretativo con densidad suficiente para la sección. Desarrollamos qué implica para la marca, qué ofrece y qué tensiones aparecen sin inventar hechos.",
    });
    const parsed = brandBaseConsolidationRawOutputSchema.safeParse({
      knowledge_base: {
        curator_reading: "Lectura curadora global.",
        strategic_pillars: [{ title: "Pilar", body: "Cuerpo del pilar con detalle estratégico." }],
        restrictions_and_alerts: "Nada que alertar de ejemplo.",
        evidence_narrative: "Evidencia resumida.",
        executive_reading: "Lectura ejecutiva en varios párrafos con foco en decisiones.",
        section_interpretations: [
          section("identity"),
          section("offer"),
          section("audiences"),
          section("value_proposition"),
          section("differentiators"),
          section("evidence"),
          section("voice_tone"),
          section("restrictions"),
        ],
        final_highlights: {
          key_strengths: ["Fortaleza 1", "Fortaleza 2"],
          strategic_tensions: ["Tensión 1"],
          communication_opportunities: ["Oportunidad 1", "Oportunidad 2"],
          key_limbic_signals: ["Señal 1", "Señal 2"],
          narrative_care_and_avoids: ["Cuidado 1", "Cuidado 2"],
        },
        internal_base_notice: "La base completa queda guardada para uso interno.",
        project_readiness_message: "La marca está razonablemente lista para iniciar proyectos.",
        offer_architecture: {
          offer_nature: "service",
          offer_summary:
            "La oferta se articula en torno a servicios de producción audiovisual con acompañamiento integral.",
          service_catalog: [
            {
              name: "Producción de videos corporativos",
              item_type: "service",
              description: "Desde el guion hasta la edición.",
              strategic_role: "Núcleo de ingresos recurrentes.",
              main_value: "Calidad técnica y narrativa.",
            },
          ],
          commercial_use_guidance:
            "Listá estos nombres en piezas comerciales; no inventes servicios fuera de este catálogo.",
        },
      },
      limbic_base: {
        symbolic_reading: "Lectura simbólica.",
        atmosphere_and_metaphor: "Metáfora.",
        rhythm_and_energy: "Ritmo.",
        expressive_codes: "Códigos.",
        non_literal_guidance: "Usar como brújula, no como copy.",
        symbolic_restrictions: "No literalizar.",
      },
    });
    expect(parsed.success).toBe(true);
  });
});

describe("buildBrandBaseConsolidationSourceSnapshot", () => {
  it("merges consolidation metadata onto diagnosis snapshot", () => {
    const snap = buildBrandBaseConsolidationSourceSnapshot({
      diagnosisSourceSnapshot: { definitions_count: 3 },
      activeEvaluationId: "ev-1",
      consolidationRunId: "run-1",
    });
    expect(snap.definitions_count).toBe(3);
    expect(snap.active_evaluation_id).toBe("ev-1");
    expect(snap.consolidation_run_id).toBe("run-1");
    expect(typeof snap.consolidation_context_version).toBe("string");
    expect(typeof snap.consolidation_prompt_version).toBe("string");
  });
});
