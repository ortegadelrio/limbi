import { describe, expect, it } from "vitest";
import {
  BRAND_DIAGNOSIS_SCORING_POLICY_V2,
  buildBrandDiagnosisSourceSnapshot,
  buildCoverage,
  filterBrandResponsesForActiveDefinitions,
  hasMinimumInputForDiagnosis,
} from "@/lib/brands/build-brand-diagnosis-context";
import {
  applyOptionalEmptinessSectionScoreFloors,
  brandDiagnosisRawOutputSchema,
} from "@/lib/schemas/brand-diagnosis";
import type { BrandOfferNature, BrandResponseRow, QuestionDefinitionRow } from "@/types/database";

function def(overrides: Partial<QuestionDefinitionRow>): QuestionDefinitionRow {
  return {
    id: "d1",
    journey_type: "brand",
    section_key: "identity",
    module_key: "core",
    question_key: "q1",
    question_text: "Q1",
    help_text: null,
    answer_type: "textarea",
    options: [],
    applies_to: null,
    is_required: true,
    is_sensitive: false,
    is_active: true,
    evaluation_weight: 1,
    display_order: 1,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  } as QuestionDefinitionRow;
}

function resp(overrides: Partial<BrandResponseRow>): BrandResponseRow {
  return {
    id: "r1",
    brand_id: "b1",
    question_definition_id: "d1",
    section_key: "identity",
    module_key: "core",
    question_key: "q1",
    answer_value: {},
    answer_text: "x",
    answer_type: "textarea",
    is_required: true,
    is_sensitive: false,
    source_type: "questionnaire",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  } as BrandResponseRow;
}

describe("filterBrandResponsesForActiveDefinitions", () => {
  it("drops responses whose question_key has no active definition", () => {
    const definitions = [def({ id: "active-1", question_key: "a" })];
    const rows = [
      resp({ question_definition_id: "active-1", question_key: "a" }),
      resp({ id: "orphan", question_definition_id: "old-catalog", question_key: "legacy" }),
    ];
    const filtered = filterBrandResponsesForActiveDefinitions(rows, definitions);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.question_key).toBe("a");
  });

  it("re-attaches obsolete question_definition_id via active question_key and preserves answer_text", () => {
    const definitions = [
      def({ id: "active-1", question_key: "q1", section_key: "identity", module_key: "m1" }),
    ];
    const sentinel = "FRASE_CENTINELA_ACTUALIZACION_MARCA_2026";
    const rows = [
      resp({
        question_definition_id: "old-b",
        question_key: "q1",
        answer_text: sentinel,
        section_key: "legacy-section",
        module_key: "legacy-mod",
        updated_at: "2026-06-01",
      }),
    ];
    const filtered = filterBrandResponsesForActiveDefinitions(rows, definitions);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.question_definition_id).toBe("active-1");
    expect(filtered[0]!.section_key).toBe("identity");
    expect(filtered[0]!.module_key).toBe("m1");
    expect(filtered[0]!.answer_text).toBe(sentinel);
  });

  it("dedupes by question_key and keeps the row with newer updated_at", () => {
    const definitions = [def({ id: "active-1", question_key: "q1" })];
    const rows = [
      resp({
        id: "old-row",
        question_definition_id: "active-1",
        question_key: "q1",
        answer_text: "primera",
        updated_at: "2026-01-01",
      }),
      resp({
        id: "new-row",
        question_definition_id: "zombie",
        question_key: "q1",
        answer_text: "segunda",
        updated_at: "2026-08-01",
      }),
    ];
    const filtered = filterBrandResponsesForActiveDefinitions(rows, definitions);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.answer_text).toBe("segunda");
    expect(filtered[0]!.question_definition_id).toBe("active-1");
  });
});

describe("buildBrandDiagnosisSourceSnapshot", () => {
  function snapForResponses(responses: BrandResponseRow[]) {
    return buildBrandDiagnosisSourceSnapshot({
      strategicSectionKeys: ["identity"],
      offerNature: "service" as BrandOfferNature,
      promptVersion: "pv-test",
      definitionsCount: 1,
      responses,
      approvedFactsCount: 0,
      approvedFactsDigest: "0".repeat(48),
      approvedSectionImprovements: [],
      approvedSectionImprovementsDigest: "1".repeat(48),
      structuredOfferItemCount: 0,
      structuredAudienceTerritoryCount: 0,
      structuredOfferItems: [],
      structuredAudienceTerritories: [],
    });
  }

  it("changes responses_meta_hash when answer_text changes for the same question_key", () => {
    const a = snapForResponses([
      resp({ question_definition_id: "d1", question_key: "q1", answer_text: "aaa" }),
    ]);
    const b = snapForResponses([
      resp({ question_definition_id: "d1", question_key: "q1", answer_text: "bbb" }),
    ]);
    expect(a.responses_meta_hash).not.toBe(b.responses_meta_hash);
  });

  it("includes structured offer item text in the hash", () => {
    const r = [resp({ question_definition_id: "d1", question_key: "q1" })];
    const withoutItems = snapForResponses(r);
    const withItems = buildBrandDiagnosisSourceSnapshot({
      strategicSectionKeys: ["identity"],
      offerNature: "service" as BrandOfferNature,
      promptVersion: "pv-test",
      definitionsCount: 1,
      responses: r,
      approvedFactsCount: 0,
      approvedFactsDigest: "0".repeat(48),
      approvedSectionImprovements: [],
      approvedSectionImprovementsDigest: "1".repeat(48),
      structuredOfferItemCount: 1,
      structuredAudienceTerritoryCount: 0,
      structuredOfferItems: [{ item_type: "service", title: "Uno", description: null }],
      structuredAudienceTerritories: [],
    });
    expect(withoutItems.responses_meta_hash).not.toBe(withItems.responses_meta_hash);
  });
});

describe("hasMinimumInputForDiagnosis", () => {
  it("returns true when structured offer items exist even without responses", () => {
    expect(
      hasMinimumInputForDiagnosis([], 0, 0, {
        structuredOfferItemCount: 1,
        structuredTerritoryCount: 0,
      }),
    ).toBe(true);
  });

  it("returns true when structured territories exist", () => {
    expect(
      hasMinimumInputForDiagnosis([], 0, 0, {
        structuredOfferItemCount: 0,
        structuredTerritoryCount: 2,
      }),
    ).toBe(true);
  });

  it("returns false when everything is empty", () => {
    expect(hasMinimumInputForDiagnosis([], 0, 0, {})).toBe(false);
  });
});

describe("buildCoverage structural signals", () => {
  it("marks audiences as non-empty when territories exist", () => {
    const definitions = [def({ id: "d-a", section_key: "audiences", question_key: "aud1" })];
    const coverage = buildCoverage(definitions, [], [], ["audiences"], 0, 1);
    expect(coverage[0]!.appears_empty).toBe(false);
  });

  it("marks offer-related section as non-empty when offer items exist", () => {
    const definitions = [def({ id: "d-o", section_key: "offer", question_key: "off1" })];
    const coverage = buildCoverage(definitions, [], [], ["offer"], 2, 0);
    expect(coverage[0]!.appears_empty).toBe(false);
  });
});

describe("BRAND_DIAGNOSIS_SCORING_POLICY_V2", () => {
  it("mentions offer_nature profile and structured tables", () => {
    const blob = BRAND_DIAGNOSIS_SCORING_POLICY_V2.notes.join(" ");
    expect(blob).toMatch(/brand_offer_profile\.offer_nature/);
    expect(blob).toMatch(/structured_offer_items/);
    expect(blob).toMatch(/structured_audience_territories/);
    expect(blob).toMatch(/simb[oó]lic/);
    expect(blob).toMatch(/current_evidence/);
  });
});

describe("applyOptionalEmptinessSectionScoreFloors", () => {
  it("raises a low score when all mandatory answered but optionals remain empty", () => {
    const raw = {
      overall_score: 40,
      quality_level: "weak" as const,
      strategic_reading: "Lectura",
      section_scores: [
        {
          section_key: "identity",
          section_label: "Identidad",
          score: 35,
          quality_level: "critical" as const,
          diagnosis: "Diagnóstico",
          strengths: [],
          gaps: ["falta opcional"],
          depth_opportunities: [],
          contradictions: [],
          risks: [],
          recommendations: [],
          priority: "medium" as const,
          can_generate_base: false,
          should_improve_before_consolidation: true,
        },
      ],
      critical_gaps: [],
      contradictions: [],
      improvement_plan: [],
      next_recommended_action: "improve_required" as const,
    };
    const parsed = brandDiagnosisRawOutputSchema.parse(raw);
    const coverage = new Map([
      [
        "identity",
        {
          section_key: "identity",
          required_questions: 1,
          required_answered: 1,
          optional_questions: 2,
          optional_answered: 0,
          approved_facts_count: 0,
          appears_empty: false,
        },
      ],
    ]);
    const out = applyOptionalEmptinessSectionScoreFloors(parsed, coverage);
    expect(out.section_scores[0]!.score).toBe(56);
  });

  it("does not raise score when mandatory questions are unanswered", () => {
    const raw = {
      overall_score: 40,
      quality_level: "weak" as const,
      strategic_reading: "Lectura",
      section_scores: [
        {
          section_key: "identity",
          section_label: "Identidad",
          score: 35,
          quality_level: "critical" as const,
          diagnosis: "Diagnóstico",
          strengths: [],
          gaps: [],
          depth_opportunities: [],
          contradictions: [],
          risks: [],
          recommendations: [],
          priority: "medium" as const,
          can_generate_base: false,
          should_improve_before_consolidation: true,
        },
      ],
      critical_gaps: [],
      contradictions: [],
      improvement_plan: [],
      next_recommended_action: "improve_required" as const,
    };
    const parsed = brandDiagnosisRawOutputSchema.parse(raw);
    const coverage = new Map([
      [
        "identity",
        {
          section_key: "identity",
          required_questions: 2,
          required_answered: 1,
          optional_questions: 1,
          optional_answered: 0,
          approved_facts_count: 0,
          appears_empty: true,
        },
      ],
    ]);
    const out = applyOptionalEmptinessSectionScoreFloors(parsed, coverage);
    expect(out.section_scores[0]!.score).toBe(35);
  });
});
