import { describe, expect, it } from "vitest";
import {
  guidedIntakeDebugCompletionSummaryFixture,
  isGuidedIntakeDebugCompleteShortcutCore,
} from "@/lib/intake/guided-intake-debug-complete";
import { summaryIndicatesGuidedFirstCaptureDiagnosticPreview } from "@/lib/intake/guided-intake-completion-ui";

describe("isGuidedIntakeDebugCompleteShortcutCore", () => {
  it("is never true in production", () => {
    expect(
      isGuidedIntakeDebugCompleteShortcutCore({
        nodeEnv: "production",
        guidedPilotEnabled: true,
        guidedParam: "1",
        debugCompleteParam: "1",
      }),
    ).toBe(false);
  });

  it("requires pilot flag, guided=1, and debugComplete=1", () => {
    expect(
      isGuidedIntakeDebugCompleteShortcutCore({
        nodeEnv: "development",
        guidedPilotEnabled: false,
        guidedParam: "1",
        debugCompleteParam: "1",
      }),
    ).toBe(false);
    expect(
      isGuidedIntakeDebugCompleteShortcutCore({
        nodeEnv: "development",
        guidedPilotEnabled: true,
        guidedParam: "0",
        debugCompleteParam: "1",
      }),
    ).toBe(false);
    expect(
      isGuidedIntakeDebugCompleteShortcutCore({
        nodeEnv: "development",
        guidedPilotEnabled: true,
        guidedParam: "1",
        debugCompleteParam: null,
      }),
    ).toBe(false);
    expect(
      isGuidedIntakeDebugCompleteShortcutCore({
        nodeEnv: "development",
        guidedPilotEnabled: true,
        guidedParam: "true",
        debugCompleteParam: "true",
      }),
    ).toBe(true);
  });
});

describe("guidedIntakeDebugCompletionSummaryFixture", () => {
  it("is recognized as the diagnostic preview summary", () => {
    const s = guidedIntakeDebugCompletionSummaryFixture();
    expect(summaryIndicatesGuidedFirstCaptureDiagnosticPreview(s)).toBe(true);
  });
});
