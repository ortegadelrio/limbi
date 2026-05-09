import { describe, expect, it } from "vitest";
import {
  initialTrace,
  type LimbicInterviewTraceV1,
} from "@/lib/intake/orchestrator";
import { resolveGuidedIntakeTurn } from "@/lib/intake/conversational-engine/resolve-guided-intake-turn";
import { applyDecisionStatusPatches } from "@/lib/intake/decision-state";
import { pilotSummaryBlockedByDecisionStates } from "@/lib/intake/decision-state";

function traceStrategic(
  over: Partial<LimbicInterviewTraceV1> = {},
): LimbicInterviewTraceV1 {
  return {
    ...initialTrace(),
    phase: "main",
    mini_step: "audience",
    turns: [],
    ...over,
  };
}

describe("Phase 2 decision layer (pattern table)", () => {
  it("A: active doubt / validation — does not advance; audience provisional; summary gated", () => {
    const trace = traceStrategic({ phase: "main", mini_step: "audience" });
    const d = resolveGuidedIntakeTurn({
      userText: "No estoy seguro, ¿a quién crees?",
      miniStep: "audience",
      trace,
    });
    expect(d.user_intent).toBe("clarification_question");
    expect(d.should_not_advance).toBe(true);
    expect(d.notes_for_route.branch).toBe("capture_phase_strategic_deferral");
    expect(d.decision_status_updates).toHaveLength(0);
    expect(d.active_doubt_detected).toBe(false);
    expect(d.can_show_summary).toBe(false);
  });

  it("B: confirm after provisional guidance advances intent to confirmation", () => {
    const trace = traceStrategic({
      phase: "strategy_validation",
      mini_step: "audience",
    });
    const d = resolveGuidedIntakeTurn({
      userText: "me quedo con esa",
      miniStep: "audience",
      trace,
    });
    expect(d.notes_for_route.branch).toBe("provisional_decision_resolution");
    expect(d.user_intent).toBe("confirmation");
    const aud = d.decision_status_updates.find((x) => x.topic === "audience");
    expect(aud?.status).toBe("confirmed");
    expect(d.should_advance).toBe(true);
  });

  it("C: leave pending — pending status and limitation path", () => {
    const trace = traceStrategic({
      phase: "strategy_validation",
      mini_step: "evidence",
    });
    const d = resolveGuidedIntakeTurn({
      userText: "dejémoslo pendiente",
      miniStep: "evidence",
      trace,
    });
    expect(d.notes_for_route.branch).toBe("provisional_decision_resolution");
    expect(d.writes_to_responses).toBe(true);
    const ev = d.decision_status_updates.find((x) => x.topic === "evidence");
    expect(ev?.status).toBe("pending");
    expect(d.should_advance).toBe(true);
  });

  it("D: reopen prior topic from another mini-step — routes audience; no evidence write", () => {
    const trace = traceStrategic({ mini_step: "evidence", phase: "main" });
    const d = resolveGuidedIntakeTurn({
      userText: "Me gustaría definir mejor la audiencia",
      miniStep: "evidence",
      trace,
    });
    expect(d.target_topic).toBe("audience");
    expect(d.reopened_topic).toBe("audience");
    expect(d.writes_to_responses).toBe(false);
    expect(d.should_not_advance).toBe(true);
    expect(d.can_show_summary).toBe(false);
    expect(["evidence_return_to_audience", "strategic_topic_reroute"]).toContain(
      d.notes_for_route.branch,
    );
  });

  it("E: cross-topic substantive portable — LLM override to audience, not meta reroute", () => {
    const trace = traceStrategic({ mini_step: "evidence", phase: "main" });
    const d = resolveGuidedIntakeTurn({
      userText:
        "Pensándolo bien, la audiencia principal son las personas con rol de coordinación operativa.",
      miniStep: "evidence",
      trace,
    });
    expect(d.notes_for_route.branch).toBe("cross_topic_llm_extraction");
    expect(d.notes_for_route.overrideMiniStep).toBe("audience");
    expect(d.notes_for_route.restoreMiniStepAfter).toBe("evidence");
    expect(d.target_topic).toBe("audience");
  });

  it("F: problem correction while on audience — cross-topic extraction to problem", () => {
    const trace = traceStrategic({ mini_step: "audience", phase: "main" });
    const d = resolveGuidedIntakeTurn({
      userText:
        "El problema real es que los equipos pierden demasiado tiempo ubicando información crítica.",
      miniStep: "audience",
      trace,
    });
    expect(d.notes_for_route.branch).toBe("cross_topic_llm_extraction");
    expect(d.notes_for_route.overrideMiniStep).toBe("problem");
    expect(d.notes_for_route.restoreMiniStepAfter).toBe("audience");
    expect(d.target_topic).toBe("problem");
  });

  it("G: summary blocked when decision_states remain provisional after patch", () => {
    const base = traceStrategic();
    const patched = applyDecisionStatusPatches(
      base.decision_states,
      [
        {
          topic: "audience",
          status: "provisional",
          reason: "test",
          source: "test",
        },
      ],
      new Date().toISOString(),
    );
    expect(
      pilotSummaryBlockedByDecisionStates(patched, { userExplicitProceed: false }),
    ).toBe(true);
    expect(
      pilotSummaryBlockedByDecisionStates(patched, { userExplicitProceed: true }),
    ).toBe(false);
  });

  it("H: production resolvers do not embed forbidden example tokens", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = new URL("./resolve-guided-intake-turn.ts", import.meta.url);
    const src = await readFile(path, "utf8");
    const banned = [
      "gerentes comerciales",
      "directores administrativos",
      "colegios",
      "padres",
      "gobierno local",
      "ancianato",
      "B2B",
    ];
    const lower = src.toLowerCase();
    for (const b of banned) {
      expect(lower.includes(b.toLowerCase()), `unexpected token: ${b}`).toBe(
        false,
      );
    }
  });
});
