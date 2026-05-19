import { describe, expect, it } from "vitest";
import {
  BRAND_FIELD_IMPROVE_BEFORE_DIAGNOSIS_HINT_ES,
  canShowLimbiFieldImprove,
} from "@/lib/brands/brand-field-improve-eligibility";

describe("canShowLimbiFieldImprove", () => {
  it("no muestra mejora sin diagnóstico activo", () => {
    expect(
      canShowLimbiFieldImprove({
        hasActiveDiagnosis: false,
        answerType: "textarea",
        sectionKey: "identity",
      }),
    ).toBe(false);
  });

  it("muestra mejora en texto con diagnóstico", () => {
    expect(
      canShowLimbiFieldImprove({
        hasActiveDiagnosis: true,
        answerType: "textarea",
        sectionKey: "identity",
      }),
    ).toBe(true);
  });

  it("no muestra en material_context ni en single_choice", () => {
    expect(
      canShowLimbiFieldImprove({
        hasActiveDiagnosis: true,
        answerType: "textarea",
        sectionKey: "material_context",
      }),
    ).toBe(false);
    expect(
      canShowLimbiFieldImprove({
        hasActiveDiagnosis: true,
        answerType: "single_choice",
        sectionKey: "identity",
      }),
    ).toBe(false);
  });

  it("expone microcopy antes del diagnóstico", () => {
    expect(BRAND_FIELD_IMPROVE_BEFORE_DIAGNOSIS_HINT_ES).toContain("primer diagnóstico");
  });
});
