import { describe, expect, it } from "vitest";
import {
  structuredSourcesGuidanceForImproveSection,
  normalizeDiagnosisSectionForImprovement,
} from "@/lib/brands/build-brand-section-improvement-context";
import { filterBrandResponsesForActiveDefinitions } from "@/lib/brands/build-brand-diagnosis-context";
import type { BrandDiagnosisSectionScoreParsed } from "@/lib/schemas/brand-diagnosis";
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

describe("structuredSourcesGuidanceForImproveSection", () => {
  it("mentions structured offer and territories and limbic symbolic rule", () => {
    const g = structuredSourcesGuidanceForImproveSection("offer");
    expect(g).toMatch(/structured_offer_items/);
    expect(g).toMatch(/structured_audience_territories/);
    expect(g).toMatch(/brand_offer_profile/);
    const limbic = structuredSourcesGuidanceForImproveSection("brand_limbic_base");
    expect(limbic).toMatch(/simb[oó]lic/);
  });
});

describe("normalizeDiagnosisSectionForImprovement", () => {
  it("defaults depth_opportunities when missing", () => {
    const row = {
      section_key: "identity",
      section_label: "Identidad",
      score: 70,
      quality_level: "acceptable",
      diagnosis: "x",
      strengths: [],
      gaps: [],
      contradictions: [],
      risks: [],
      recommendations: [],
      priority: "medium",
      can_generate_base: true,
      should_improve_before_consolidation: false,
    } as BrandDiagnosisSectionScoreParsed;
    const out = normalizeDiagnosisSectionForImprovement(row);
    expect(out?.depth_opportunities).toEqual([]);
  });
});

describe("section improvement responses filtering", () => {
  it("excludes orphan responses not in active definitions", () => {
    const definitions = [def({ id: "active-1", section_key: "offer", question_key: "a" })];
    const rows: BrandResponseRow[] = [
      {
        id: "1",
        brand_id: "b",
        question_definition_id: "active-1",
        section_key: "offer",
        module_key: "m",
        question_key: "a",
        answer_value: {},
        answer_text: "ok",
        answer_type: "textarea",
        is_required: true,
        is_sensitive: false,
        source_type: "questionnaire",
        created_at: "",
        updated_at: "",
      },
      {
        id: "2",
        brand_id: "b",
        question_definition_id: "old",
        section_key: "offer",
        module_key: "m",
        question_key: "legacy",
        answer_value: {},
        answer_text: "old",
        answer_type: "textarea",
        is_required: true,
        is_sensitive: false,
        source_type: "questionnaire",
        created_at: "",
        updated_at: "",
      },
    ];
    const filtered = filterBrandResponsesForActiveDefinitions(rows, definitions);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.question_key).toBe("a");
  });
});
