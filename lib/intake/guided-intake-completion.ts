import { readInterviewTrace } from "@/lib/intake/orchestrator";

/**
 * True when guided strategic interview V1 finished its first capture
 * (diagnostic preview / complete mini_step), including before classic wizard review.
 */
export function isGuidedStrategicIntakeFirstCaptureComplete(
  responses: Record<string, unknown>,
): boolean {
  const tr = readInterviewTrace(responses);
  if (!tr) return false;
  return (
    tr.pilot_id === "strategic_interview_v1" &&
    tr.phase === "done" &&
    tr.mini_step === "complete"
  );
}
