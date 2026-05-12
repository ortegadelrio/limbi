import { describe, expect, it } from "vitest";
import { findingDuplicatesStructuredBrandContext } from "@/lib/brands/brand-document-finding-dedupe-context";
import type { BrandDocumentAnalysisFindingParsed } from "@/lib/schemas/brand-document-analysis";

const baseFinding = (): BrandDocumentAnalysisFindingParsed => ({
  section_key: "value_proposition",
  module_key: "core",
  question_key: "overall_value_result",
  relationship_type: "new",
  fact_type: "offer_detail",
  source_excerpt: "x",
  source_reference: null,
  extracted_fact: "Texto del hallazgo",
  ai_interpretation: null,
  existing_response_summary: null,
  proposed_inclusion: "Propuesta",
  confidence_score: 80,
});

describe("findingDuplicatesStructuredBrandContext", () => {
  it("returns false when no structured data", () => {
    const f = baseFinding();
    f.extracted_fact = "Algo totalmente nuevo en el PDF";
    f.proposed_inclusion = "Incluir algo totalmente nuevo en el PDF";
    expect(
      findingDuplicatesStructuredBrandContext(f, { offerItems: [], territories: [] }),
    ).toBe(false);
  });

  it("detects duplicate against offer item title+description", () => {
    const f = baseFinding();
    f.extracted_fact = "Programa de mentoría ejecutiva";
    f.proposed_inclusion = "Programa de mentoría ejecutiva";
    expect(
      findingDuplicatesStructuredBrandContext(f, {
        offerItems: [
          {
            title: "Programa de mentoría ejecutiva",
            description: "Acompañamiento a C-level",
          },
        ],
        territories: [],
      }),
    ).toBe(true);
  });

  it("does not drop contradicts findings", () => {
    const f = baseFinding();
    f.relationship_type = "contradicts";
    f.extracted_fact = "Programa de mentoría ejecutiva";
    f.proposed_inclusion = "Programa de mentoría ejecutiva";
    expect(
      findingDuplicatesStructuredBrandContext(f, {
        offerItems: [
          { title: "Programa de mentoría ejecutiva", description: null },
        ],
        territories: [],
      }),
    ).toBe(false);
  });
});
