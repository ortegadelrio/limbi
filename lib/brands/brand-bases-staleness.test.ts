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

  it("is stale when diagnosis was renewed after consolidation", () => {
    expect(
      isBrandCuratedBaseStaleFromFacts({
        baseCreatedAt: base,
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
  it("accepts a minimal valid payload", () => {
    const parsed = brandBaseConsolidationRawOutputSchema.safeParse({
      knowledge_base: {
        curator_reading: "Lectura.",
        strategic_pillars: [{ title: "Pilar", body: "Cuerpo." }],
        restrictions_and_alerts: "Nada que alertar de ejemplo.",
        evidence_narrative: "Evidencia resumida.",
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
