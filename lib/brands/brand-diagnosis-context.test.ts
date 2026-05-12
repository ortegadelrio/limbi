import { describe, expect, it } from "vitest";
import {
  BRAND_DIAGNOSIS_SCORING_POLICY_V2,
  buildCoverage,
  filterBrandResponsesForActiveDefinitions,
  hasMinimumInputForDiagnosis,
} from "@/lib/brands/build-brand-diagnosis-context";
import {
  applyOptionalEmptinessSectionScoreFloors,
  brandDiagnosisRawOutputSchema,
} from "@/lib/schemas/brand-diagnosis";
import type { BrandResponseRow, QuestionDefinitionRow } from "@/types/database";

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
  it("drops responses whose question_definition_id is not in active definitions", () => {
    const definitions = [def({ id: "active-1", question_key: "a" })];
    const rows = [
      resp({ question_definition_id: "active-1", question_key: "a" }),
      resp({ id: "orphan", question_definition_id: "old-catalog", question_key: "legacy" }),
    ];
    const filtered = filterBrandResponsesForActiveDefinitions(rows, definitions);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.question_key).toBe("a");
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
