import { describe, expect, it } from "vitest";
import { initialTrace, type LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";
import { resolveGuidedIntakeTurn } from "@/lib/intake/conversational-engine/resolve-guided-intake-turn";

function traceAt(
  miniStep: LimbicInterviewTraceV1["mini_step"],
  phase: LimbicInterviewTraceV1["phase"] = "main",
): LimbicInterviewTraceV1 {
  return {
    ...initialTrace(),
    phase,
    mini_step: miniStep,
    turns: [],
  };
}

describe("strategic guidance seeking (pattern-based)", () => {
  it("transformation: help / how-to request does not use llm_extraction branch", () => {
    const d = resolveGuidedIntakeTurn({
      userText:
        "No sé cómo plantearlo; para eso necesito tu ayuda con una lectura estratégica.",
      miniStep: "transformation",
      trace: traceAt("transformation"),
    });
    expect(d.notes_for_route.branch).toBe("capture_phase_strategic_deferral");
    expect(d.skip_llm_extraction).toBe(true);
    expect(d.should_not_advance).toBe(true);
    expect(d.writes_to_responses).toBe(false);
    expect(d.decision_status_updates).toHaveLength(0);
    expect(d.active_doubt_detected).toBe(false);
  });

  it("audience: short recommendation-style ask holds without advancing", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "¿A quién debería?",
      miniStep: "audience",
      trace: traceAt("audience"),
    });
    expect(d.notes_for_route.branch).toBe("capture_phase_strategic_deferral");
    expect(d.should_not_advance).toBe(true);
    expect(d.skip_llm_extraction).toBe(true);
    expect(d.writes_to_responses).toBe(false);
  });

  it("audience: bare sí is not treated as substantive answer", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "Sí",
      miniStep: "audience",
      trace: traceAt("audience"),
    });
    expect(d.notes_for_route.branch).toBe("bare_confirmation_hold");
    expect(d.should_not_advance).toBe(true);
    expect(d.skip_llm_extraction).toBe(true);
  });

  it("evidence: definitional question still uses clarification, not guidance hold", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "¿Qué significa evidencia en este paso?",
      miniStep: "evidence",
      trace: traceAt("evidence"),
    });
    expect(d.notes_for_route.branch).toBe("deterministic_clarification");
  });
});
