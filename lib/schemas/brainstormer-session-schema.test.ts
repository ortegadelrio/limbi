import { describe, expect, it } from "vitest";
import {
  brainstormerSessionProgressSchema,
  BRAINSTORMER_SESSION_PROMPT_VERSION,
  coerceBrainstormerSessionProgress,
  patchBrainstormerSessionBodySchema,
  postBrainstormerMessageBodySchema,
  postBrainstormerSessionBodySchema,
} from "@/lib/schemas/brainstormer-session";

describe("brainstormer-session schemas", () => {
  it("POST sesión: acepta brand_id y opcionales", () => {
    const a = postBrainstormerSessionBodySchema.safeParse({
      brand_id: "550e8400-e29b-41d4-a716-446655440000",
      title: "X",
      initial_user_message: "Hola",
    });
    expect(a.success).toBe(true);
    const b = postBrainstormerSessionBodySchema.safeParse({
      brand_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(b.success).toBe(true);
    const c = postBrainstormerSessionBodySchema.safeParse({ brand_id: "not-uuid" });
    expect(c.success).toBe(false);
  });

  it("PATCH sesión: solo open, paused, closed", () => {
    const ok = patchBrainstormerSessionBodySchema.safeParse({ status: "paused" });
    expect(ok.success).toBe(true);
    const bad = patchBrainstormerSessionBodySchema.safeParse({ status: "running" });
    expect(bad.success).toBe(false);
  });

  it("POST mensaje: content requerido", () => {
    const ok = postBrainstormerMessageBodySchema.safeParse({ content: "Hola" });
    expect(ok.success).toBe(true);
    const bad = postBrainstormerMessageBodySchema.safeParse({ content: "" });
    expect(bad.success).toBe(false);
  });

  it("versión de prompt fija", () => {
    expect(BRAINSTORMER_SESSION_PROMPT_VERSION).toBe("brainstormer-session-v1.2");
  });

  it("session_progress incluye señales de proyecto", () => {
    const p = brainstormerSessionProgressSchema.safeParse({
      session_summary: "S",
      current_challenge: "C",
      preliminary_objective: "O",
      audience_notes: "A",
      tension_or_pain: "T",
      opportunities: "Op",
      ideas_explored: "I",
      recommended_routes: "R",
      open_questions: "Q",
      next_step: "N",
      project_readiness: "medium",
      suggested_project_type: "event_promotion",
      should_suggest_project_conversion: true,
      project_seed_summary: "Semilla",
      missing_project_inputs: ["Presupuesto"],
    });
    expect(p.success).toBe(true);
  });

  it("coerceBrainstormerSessionProgress completa snapshots legacy sin campos de proyecto", () => {
    const legacy = {
      session_summary: "X",
      current_challenge: "",
      preliminary_objective: "",
      audience_notes: "",
      tension_or_pain: "",
      opportunities: "",
      ideas_explored: "",
      recommended_routes: "",
      open_questions: "",
      next_step: "",
    };
    const c = coerceBrainstormerSessionProgress(legacy);
    expect(c.session_summary).toBe("X");
    expect(c.project_readiness).toBe("low");
    expect(c.should_suggest_project_conversion).toBe(false);
    expect(c.missing_project_inputs).toEqual([]);
  });
});
