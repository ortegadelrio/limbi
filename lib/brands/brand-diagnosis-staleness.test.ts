import { describe, expect, it } from "vitest";
import { isBrandDiagnosisStale } from "@/lib/brands/brand-diagnosis-staleness";

const evalAt = "2026-05-01T12:00:00Z";

describe("isBrandDiagnosisStale", () => {
  const evaluation = { created_at: evalAt };

  it("is false without evaluation", () => {
    expect(
      isBrandDiagnosisStale({
        evaluation: null,
        responseRows: [{ updated_at: "2026-06-01T12:00:00Z" }],
      }),
    ).toBe(false);
  });

  it("marks stale when brand_responses updated after evaluation", () => {
    expect(
      isBrandDiagnosisStale({
        evaluation,
        responseRows: [{ updated_at: "2026-05-02T12:00:00Z" }],
      }),
    ).toBe(true);
  });

  it("marks stale when offer items flag set", () => {
    expect(
      isBrandDiagnosisStale({
        evaluation,
        hasStaleOfferItems: true,
      }),
    ).toBe(true);
  });

  it("marks stale when audience territories flag set", () => {
    expect(
      isBrandDiagnosisStale({
        evaluation,
        hasStaleAudienceTerritories: true,
      }),
    ).toBe(true);
  });

  it("marks stale when source facts updated after evaluation", () => {
    expect(
      isBrandDiagnosisStale({
        evaluation,
        hasSourceFactsUpdatedAfterEvaluation: true,
      }),
    ).toBe(true);
  });

  it("marks stale when improvement approved_at after evaluation", () => {
    expect(
      isBrandDiagnosisStale({
        evaluation,
        improvementRows: [{ approved_at: "2026-05-10T12:00:00Z", updated_at: null }],
      }),
    ).toBe(true);
  });

  it("marks stale when improvement updated_at after evaluation (approved_at older)", () => {
    expect(
      isBrandDiagnosisStale({
        evaluation,
        improvementRows: [
          { approved_at: "2026-04-01T12:00:00Z", updated_at: "2026-05-10T12:00:00Z" },
        ],
      }),
    ).toBe(true);
  });

  it("is not stale when no post-evaluation signals", () => {
    expect(
      isBrandDiagnosisStale({
        evaluation,
        responseRows: [],
        hasSourceFactsUpdatedAfterEvaluation: false,
        improvementRows: [],
        offerProfileUpdatedAt: evalAt,
        brandRowUpdatedAt: evalAt,
        hasStaleOfferItems: false,
        hasStaleAudienceTerritories: false,
      }),
    ).toBe(false);
  });
});
