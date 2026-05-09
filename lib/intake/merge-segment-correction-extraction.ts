import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import type { SegmentCorrectionMode } from "@/lib/intake/segment-correction-mode";

/**
 * Additive correction fusion is done in the LLM output (see segment-correction prompt appendix).
 * This helper intentionally does not concatenate prose, so we never reintroduce “prior + nuevo” artifacts.
 */
export function mergePendingSegmentCorrectionExtraction(params: {
  mode: SegmentCorrectionMode;
  pending: IntakeExtractionOutput;
  incoming: IntakeExtractionOutput;
  miniStep: GuidedMiniStepId;
}): IntakeExtractionOutput {
  void params.pending;
  void params.miniStep;
  return params.incoming;
}
