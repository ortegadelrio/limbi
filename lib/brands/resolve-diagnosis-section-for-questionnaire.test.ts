import { describe, expect, it } from "vitest";
import { resolveDiagnosisSectionForQuestionnaireSection } from "@/lib/brands/build-brand-field-improvement-context";
import type { BrandDiagnosisSectionScoreParsed } from "@/lib/schemas/brand-diagnosis";

function section(key: string): BrandDiagnosisSectionScoreParsed {
  return {
    section_key: key,
    section_label: key,
    score: 50,
    quality_level: "acceptable",
    diagnosis: "Diagnóstico de prueba.",
    depth_opportunities: [],
    strengths: [],
    gaps: [],
    contradictions: [],
    risks: [],
    recommendations: [],
    priority: "medium",
    can_generate_base: true,
    should_improve_before_consolidation: false,
  };
}

describe("resolveDiagnosisSectionForQuestionnaireSection", () => {
  it("resuelve aliases de cuestionario a diagnóstico", () => {
    const scores = [section("differentiators"), section("voice_tone")];
    expect(
      resolveDiagnosisSectionForQuestionnaireSection(scores, "differentiation")?.section_key,
    ).toBe("differentiators");
    expect(
      resolveDiagnosisSectionForQuestionnaireSection(scores, "voice_tone_messages")?.section_key,
    ).toBe("voice_tone");
  });

  it("usa section_key directo si coincide", () => {
    const scores = [section("identity")];
    expect(
      resolveDiagnosisSectionForQuestionnaireSection(scores, "identity")?.section_key,
    ).toBe("identity");
  });
});
