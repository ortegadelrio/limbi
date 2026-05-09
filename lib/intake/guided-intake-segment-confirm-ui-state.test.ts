import { describe, expect, it } from "vitest";
import { pilotHidesOpenComposerDuringSegmentConfirmation } from "@/lib/intake/guided-intake-segment-confirm-ui-state";

describe("pilotHidesOpenComposerDuringSegmentConfirmation", () => {
  it("hides the open composer when the four segment confirmation buttons are visible", () => {
    expect(
      pilotHidesOpenComposerDuringSegmentConfirmation({
        segmentConfirmationUi: { version: 1, synthesis: "x", actions: [] },
        segmentConfirmBusy: false,
      }),
    ).toBe(true);
  });

  it("shows the open composer while awaiting free-text correction (no UI payload)", () => {
    expect(
      pilotHidesOpenComposerDuringSegmentConfirmation({
        segmentConfirmationUi: null,
        segmentConfirmBusy: false,
      }),
    ).toBe(false);
  });

  it("keeps the composer hidden while a segment confirmation action is in flight", () => {
    expect(
      pilotHidesOpenComposerDuringSegmentConfirmation({
        segmentConfirmationUi: null,
        segmentConfirmBusy: true,
      }),
    ).toBe(true);
  });

  it("hides the composer when both UI and busy are set (closed state during request)", () => {
    expect(
      pilotHidesOpenComposerDuringSegmentConfirmation({
        segmentConfirmationUi: { version: 1, synthesis: "x", actions: [] },
        segmentConfirmBusy: true,
      }),
    ).toBe(true);
  });
});
