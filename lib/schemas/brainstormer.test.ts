import { describe, expect, it } from "vitest";
import {
  brainstormBrandContextStatusSchema,
  brainstormCommonBaseSchema,
  brainstormProjectBaseSchema,
  brainstormProjectBaseStatusSchema,
  brainstormSessionStatusSchema,
  brainstormSuggestedProjectTypeSchema,
} from "@/lib/schemas/brainstormer";

describe("brainstormer schemas", () => {
  it("brand_context_status acepta ready | advisory | blocked", () => {
    expect(brainstormBrandContextStatusSchema.safeParse("ready").success).toBe(true);
    expect(brainstormBrandContextStatusSchema.safeParse("invalid").success).toBe(false);
  });
  it("common_base acepta campos defined, hypothesis y pending", () => {
    const parsed = brainstormCommonBaseSchema.safeParse({
      challenge: { value: "Lanzar X", status: "defined" },
      possible_insight: { value: "Quizá Y", status: "hypothesis" },
      main_audience: { value: "", status: "pending" },
    });
    expect(parsed.success).toBe(true);
  });

  it("suggested_project_type acepta confidence y reasoning", () => {
    const parsed = brainstormSuggestedProjectTypeSchema.safeParse({
      type: "campaign_360",
      confidence: "high",
      alternative_types: ["launch"],
      reasoning: "El usuario habló de fases y canales múltiples.",
    });
    expect(parsed.success).toBe(true);
  });

  it("project_base acepta pending_information como lista", () => {
    const parsed = brainstormProjectBaseSchema.safeParse({
      common_base: {},
      pending_information: [
        { label: "Presupuesto", detail: "TBD", priority: "medium" },
      ],
      suggested_project_type: {
        type: "not_sure_yet",
        confidence: "low",
        reasoning: "Aún exploramos.",
      },
      conversion_readiness: {
        level: "medium",
        can_convert: true,
        reason: "Hay reto y ruta tentativa.",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza status de sesión inválidos", () => {
    expect(brainstormSessionStatusSchema.safeParse("running").success).toBe(false);
    expect(brainstormSessionStatusSchema.safeParse("open").success).toBe(true);
  });

  it("rechaza status de project base inválidos", () => {
    expect(brainstormProjectBaseStatusSchema.safeParse("live").success).toBe(false);
    expect(brainstormProjectBaseStatusSchema.safeParse("draft").success).toBe(true);
  });
});
