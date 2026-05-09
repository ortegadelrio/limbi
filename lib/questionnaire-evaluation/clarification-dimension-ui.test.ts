import { describe, expect, it } from "vitest";
import {
  clarificationDimensionHeadline,
  provisionalQualityLevelFromScore,
  provisionalQualityLevelLabelEs,
} from "@/lib/questionnaire-evaluation/clarification-dimension-ui";

describe("clarificationDimensionHeadline", () => {
  it("maps known dimensions to Spanish labels", () => {
    expect(clarificationDimensionHeadline("evidence")).toBe("Estamos afinando: Evidencia");
    expect(clarificationDimensionHeadline("audience")).toBe("Estamos afinando: Audiencia");
    expect(clarificationDimensionHeadline("differentiation_product")).toBe(
      "Estamos afinando: Diferencial",
    );
    expect(clarificationDimensionHeadline("tone")).toBe("Estamos afinando: Tono");
    expect(clarificationDimensionHeadline("challenge_friction")).toBe(
      "Estamos afinando: Reto",
    );
    expect(clarificationDimensionHeadline("transformation_experience")).toBe(
      "Estamos afinando: Beneficio",
    );
  });
});

describe("provisionalQualityLevelFromScore", () => {
  it("labels tiers in Spanish", () => {
    expect(provisionalQualityLevelLabelEs(provisionalQualityLevelFromScore(30))).toBe("Bajo");
    expect(provisionalQualityLevelLabelEs(provisionalQualityLevelFromScore(60))).toBe("Medio");
    expect(provisionalQualityLevelLabelEs(provisionalQualityLevelFromScore(90))).toBe("Alto");
  });
});
