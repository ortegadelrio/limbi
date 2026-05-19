import { describe, expect, it } from "vitest";
import {
  brandQuestionnaireSectionHref,
  questionnaireSectionKeyFromDiagnosisSection,
} from "@/lib/brands/brand-diagnosis-questionnaire-link";

describe("brand-diagnosis-questionnaire-link", () => {
  it("mapea claves de diagnóstico al section_key del cuestionario", () => {
    expect(questionnaireSectionKeyFromDiagnosisSection("differentiators")).toBe(
      "differentiation",
    );
    expect(questionnaireSectionKeyFromDiagnosisSection("voice_tone")).toBe(
      "voice_tone_messages",
    );
    expect(questionnaireSectionKeyFromDiagnosisSection("identity")).toBe("identity");
  });

  it("genera href con query section", () => {
    expect(brandQuestionnaireSectionHref("b1", "differentiators")).toBe(
      "/brands/b1/questionnaire?section=differentiation",
    );
  });
});
