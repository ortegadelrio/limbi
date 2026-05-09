import type { StrategicInterviewPilotSummary } from "@/lib/intake/strategic-interview-summary";

/**
 * True when the strategic pilot summary is the post–first-capture diagnostic preview
 * (same shape as `buildStrategicInterviewPilotSummary` at closure).
 */
export function summaryIndicatesGuidedFirstCaptureDiagnosticPreview(
  summary: StrategicInterviewPilotSummary,
): boolean {
  const title = summary.title.trim().toLowerCase();
  const body = summary.body.trim().toLowerCase();
  if (title.includes("primera captura") && title.includes("reto")) return true;
  /** Same opening line as `buildStrategicInterviewPilotSummary` — avoid matching “sin vista previa…”. */
  if (body.startsWith("vista previa diagnóstica")) return true;
  return false;
}

/**
 * Show the completion card (summary + diagnostic CTAs), not only when React trace
 * state is perfectly in sync with the server.
 */
export function shouldShowGuidedIntakeDiagnosticCompletionPanel(params: {
  tracePhase: string;
  miniStep: string | null;
  summary: StrategicInterviewPilotSummary | null;
}): boolean {
  const traceDone =
    params.tracePhase === "done" && params.miniStep === "complete";
  if (traceDone) return true;
  if (
    params.summary !== null &&
    summaryIndicatesGuidedFirstCaptureDiagnosticPreview(params.summary)
  ) {
    return true;
  }
  return false;
}
