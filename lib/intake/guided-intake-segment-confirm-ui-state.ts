/**
 * Guided Intake pilot: when the four segment-confirmation actions are shown,
 * the composer (textarea, escape chips, send) must stay hidden so the user
 * only picks a closed action. While a segment action is in flight, keep the
 * composer hidden as well.
 */
export function pilotHidesOpenComposerDuringSegmentConfirmation(params: {
  segmentConfirmationUi: unknown | null;
  segmentConfirmBusy: boolean;
}): boolean {
  return params.segmentConfirmBusy || Boolean(params.segmentConfirmationUi);
}
