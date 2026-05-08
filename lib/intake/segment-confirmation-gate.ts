import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import type { LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { miniStepToPilotSegmentKey } from "@/lib/intake/decision-state";

/** Strategic pilot segments that require explicit user confirmation before advancing. */
export function miniStepRequiresSegmentConfirmationGate(
  miniStep: GuidedMiniStepId,
): boolean {
  if (miniStep === "challenge_type") return true;
  return miniStepToPilotSegmentKey(miniStep) !== null;
}

/**
 * After an LLM (or deterministic) extraction, enter segment confirmation when we would
 * otherwise advance the mini journey on the same step (no new follow-up round).
 */
export function shouldOfferSegmentConfirmationAfterExtraction(params: {
  miniStep: GuidedMiniStepId;
  tracePhase: LimbicInterviewTraceV1["phase"];
  needsFollowUp: boolean;
  followUpUsed: boolean;
}): boolean {
  const { miniStep, tracePhase, needsFollowUp, followUpUsed } = params;
  if (!miniStepRequiresSegmentConfirmationGate(miniStep)) return false;
  if (needsFollowUp && !followUpUsed) return false;
  return tracePhase === "main" || tracePhase === "follow_up";
}

export function extractionPayloadForTrace(
  extraction: IntakeExtractionOutput,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(extraction)) as Record<string, unknown>;
}
