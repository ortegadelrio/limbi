import { describe, expect, it } from "vitest";
import { isStrategicRecommendationOrDelegateAsk } from "@/lib/intake/guided-intake-recommendation-ask";

describe("isStrategicRecommendationOrDelegateAsk", () => {
  it("flags delegate / recommendation phrasing", () => {
    expect(isStrategicRecommendationOrDelegateAsk("¿A quién me recomiendas?")).toBe(true);
    expect(isStrategicRecommendationOrDelegateAsk("¿Cuál consideras tú?")).toBe(true);
    expect(isStrategicRecommendationOrDelegateAsk("¿Qué debería poner?")).toBe(true);
    expect(isStrategicRecommendationOrDelegateAsk("Dime tú cuál es mejor")).toBe(true);
  });

  it("does not flag plain definition of the prompt", () => {
    expect(isStrategicRecommendationOrDelegateAsk("¿A qué te refieres con audiencia?")).toBe(
      false,
    );
  });
});
