import { describe, expect, it } from "vitest";
import { shouldFreezeCompletedStepsForTurn } from "@/lib/intake/conversational-engine/completed-steps-policy";
import type { TurnDecision } from "@/lib/intake/conversational-engine/types";

function minimalTurn(
  over: Partial<TurnDecision>,
): TurnDecision {
  return {
    user_intent: "answer",
    pending_state: "none",
    action: "llm_extraction",
    current_mini_step: "audience",
    next_mini_step: null,
    current_phase: "main",
    next_phase: null,
    should_advance: false,
    should_not_advance: false,
    writes_to_responses: true,
    writes_to_completed_steps: true,
    summary_allowed: false,
    render_policy: "default",
    question_surface_type: "primary_bank",
    skip_llm_extraction: false,
    notes_for_route: { branch: "llm_extraction" },
    decision_status_updates: [],
    target_topic: null,
    reopened_topic: null,
    active_doubt_detected: false,
    can_show_summary: true,
    requires_confirmation: false,
    confirmation_options: null,
    ...over,
  };
}

describe("shouldFreezeCompletedStepsForTurn", () => {
  it("freezes when engine reports active_doubt_detected even if route flag is false", () => {
    const engine = minimalTurn({
      active_doubt_detected: true,
      should_not_advance: false,
    });
    expect(shouldFreezeCompletedStepsForTurn(engine, false)).toBe(true);
  });

  it("freezes when route already set shouldNotAdvance", () => {
    const engine = minimalTurn({ active_doubt_detected: false });
    expect(shouldFreezeCompletedStepsForTurn(engine, true)).toBe(true);
  });

  it("freezes when engine should_not_advance", () => {
    const engine = minimalTurn({
      should_not_advance: true,
      active_doubt_detected: false,
    });
    expect(shouldFreezeCompletedStepsForTurn(engine, false)).toBe(true);
  });

  it("allows merge when no hold signals", () => {
    const engine = minimalTurn({});
    expect(shouldFreezeCompletedStepsForTurn(engine, false)).toBe(false);
  });
});
