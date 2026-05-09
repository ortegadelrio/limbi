import { describe, expect, it } from "vitest";
import { buildCapturePhaseStrategicDeferralInterviewerMessage } from "@/lib/intake/capture-phase-strategic-deferral";
import { initialTrace } from "@/lib/intake/orchestrator";
import { resolveGuidedIntakeTurn } from "@/lib/intake/conversational-engine/resolve-guided-intake-turn";

describe("buildCapturePhaseStrategicDeferralInterviewerMessage", () => {
  it("defers recommendations and adds generic actor examples only", () => {
    const msg = buildCapturePhaseStrategicDeferralInterviewerMessage();
    expect(msg).toMatch(/Todavía no es el momento de recomendar/i);
    expect(msg).toMatch(/quién compra|quién usa|autoriza/i);
    expect(msg).not.toMatch(/colegios|padres/i);
  });
});

describe("resolveGuidedIntakeTurn capture-first", () => {
  it("routes recommendation-style asks on main phase to deferral, not strategic validation", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "¿A quién me recomiendas?",
      miniStep: "audience",
      trace: { ...initialTrace(), phase: "main", mini_step: "audience", turns: [] },
    });
    expect(d.notes_for_route.branch).toBe("capture_phase_strategic_deferral");
    expect(d.user_intent).toBe("clarification_question");
    expect(d.next_phase).toBe("main");
    expect(d.requires_confirmation).toBe(false);
  });

  it("keeps deterministic strategic validation when already in strategy_validation phase", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "¿Crees que tiene sentido priorizar el foco operativo antes que el comercial?",
      miniStep: "audience",
      trace: {
        ...initialTrace(),
        phase: "strategy_validation",
        mini_step: "audience",
        turns: [],
      },
    });
    expect(d.notes_for_route.branch).toBe("deterministic_strategic_validation");
    expect(d.requires_confirmation).toBe(true);
  });
});
