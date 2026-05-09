import { describe, expect, it } from "vitest";
import { isGuidedStrategicIntakeFirstCaptureComplete } from "@/lib/intake/guided-intake-completion";
import { LIMBIC_INTERVIEW_TRACE_KEY } from "@/lib/intake/orchestrator";

describe("isGuidedStrategicIntakeFirstCaptureComplete", () => {
  it("returns true for strategic pilot trace done + complete", () => {
    const responses = {
      strategic_base: { simple_description: "x" },
      [LIMBIC_INTERVIEW_TRACE_KEY]: {
        version: 1,
        pilot_id: "strategic_interview_v1",
        phase: "done",
        mini_step: "complete",
        follow_up_used: false,
        turns: [],
      },
    };
    expect(isGuidedStrategicIntakeFirstCaptureComplete(responses)).toBe(true);
  });

  it("returns false when wizard-only responses have no trace", () => {
    expect(
      isGuidedStrategicIntakeFirstCaptureComplete({
        strategic_base: {},
      }),
    ).toBe(false);
  });

  it("returns false when phase is not done", () => {
    const responses = {
      [LIMBIC_INTERVIEW_TRACE_KEY]: {
        version: 1,
        pilot_id: "strategic_interview_v1",
        phase: "main",
        follow_up_used: false,
        turns: [],
      },
    };
    expect(isGuidedStrategicIntakeFirstCaptureComplete(responses)).toBe(false);
  });

  it("returns false for offering_module pilot", () => {
    const responses = {
      [LIMBIC_INTERVIEW_TRACE_KEY]: {
        version: 1,
        pilot_id: "offering_module_v1",
        phase: "done",
        follow_up_used: false,
        turns: [],
      },
    };
    expect(isGuidedStrategicIntakeFirstCaptureComplete(responses)).toBe(false);
  });
});
