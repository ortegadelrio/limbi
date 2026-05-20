import { describe, expect, it } from "vitest";
import { brainstormerWorkingBriefSchema } from "@/lib/brainstormer/conversation-contract";
import {
  mergeBrainstormerSessionProgress,
  mergeWorkingBrief,
} from "@/lib/brainstormer/merge-brainstormer-session-progress";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";

describe("mergeBrainstormerSessionProgress", () => {
  it("preserva prev y solo rellena campos no vacíos en next", () => {
    const prev = emptyBrainstormerSessionProgress();
    prev.session_summary = "A";
    prev.current_challenge = "B";
    const next = emptyBrainstormerSessionProgress();
    next.session_summary = "Nueva";
    next.audience_notes = "  Audiencia  ";
    const m = mergeBrainstormerSessionProgress(prev, next);
    expect(m.session_summary).toBe("Nueva");
    expect(m.current_challenge).toBe("B");
    expect(m.audience_notes).toBe("Audiencia");
  });

  it("eleva project_readiness y acumula should_suggest", () => {
    const prev = emptyBrainstormerSessionProgress();
    prev.project_readiness = "low";
    prev.should_suggest_project_conversion = false;
    prev.suggested_project_type = "other";
    prev.missing_project_inputs = ["A"];
    const next = emptyBrainstormerSessionProgress();
    next.project_readiness = "high";
    next.should_suggest_project_conversion = true;
    next.suggested_project_type = "event_promotion";
    next.missing_project_inputs = ["B"];
    const m = mergeBrainstormerSessionProgress(prev, next);
    expect(m.project_readiness).toBe("high");
    expect(m.should_suggest_project_conversion).toBe(true);
    expect(m.suggested_project_type).toBe("event_promotion");
    expect(m.missing_project_inputs).toEqual(["B"]);
  });

  it("no sobrescribe con strings vacíos o solo espacios", () => {
    const prev = emptyBrainstormerSessionProgress();
    prev.next_step = "Reunión";
    const next = emptyBrainstormerSessionProgress();
    next.next_step = "   ";
    const m = mergeBrainstormerSessionProgress(prev, next);
    expect(m.next_step).toBe("Reunión");
  });

  it("si next no trae missing_project_inputs, conserva prev", () => {
    const prev = emptyBrainstormerSessionProgress();
    prev.missing_project_inputs = ["Presupuesto"];
    const next = emptyBrainstormerSessionProgress();
    const m = mergeBrainstormerSessionProgress(prev, next);
    expect(m.missing_project_inputs).toEqual(["Presupuesto"]);
  });

  it("fusiona working_brief con campos confirmados sin perderlos si next omite working_brief", () => {
    const prev = emptyBrainstormerSessionProgress();
    prev.working_brief = brainstormerWorkingBriefSchema.parse({
      confirmed_conceptual_umbrella: "No sabías que lo querías",
      confirmed_decisions: ["Paraguas: No sabías que lo querías"],
      campaign_stage: "expectativa",
      conversion_bridge: "concepto → sketch → landing",
    });
    const next = emptyBrainstormerSessionProgress();
    next.session_summary = "Actualizado";
    const m = mergeBrainstormerSessionProgress(prev, next);
    expect(m.working_brief?.confirmed_conceptual_umbrella).toBe("No sabías que lo querías");
    expect(m.working_brief?.campaign_stage).toBe("expectativa");
  });

  it("mergeWorkingBrief: paraguas vacío en next no borra prev", () => {
    const prev = brainstormerWorkingBriefSchema.parse({
      confirmed_conceptual_umbrella: "No sabías que lo querías",
      conversion_bridge: "puente",
    });
    const next = brainstormerWorkingBriefSchema.parse({
      confirmed_conceptual_umbrella: "",
      conversion_bridge: "",
    });
    const m = mergeWorkingBrief(prev, next);
    expect(m.confirmed_conceptual_umbrella).toBe("No sabías que lo querías");
    expect(m.conversion_bridge).toBe("puente");
  });
});