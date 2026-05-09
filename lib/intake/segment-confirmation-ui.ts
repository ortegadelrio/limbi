import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import { parseIntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import type { LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";
import {
  SEGMENT_CONFIRMATION_UI_ACTIONS,
  type SegmentConfirmationUiAction,
} from "@/lib/intake/segment-confirmation-actions";
import {
  buildSegmentConfirmationStructuredCore,
  sanitizeInterpretationCoreForSegmentConfirmation,
} from "@/lib/intake/segment-confirmation";

export type SegmentConfirmationUiPayloadV1 = {
  version: 1;
  synthesis: string;
  actions: readonly SegmentConfirmationUiAction[];
};

export function buildSegmentConfirmationUiFromTrace(
  trace: LimbicInterviewTraceV1,
): SegmentConfirmationUiPayloadV1 | null {
  const p = trace.segment_confirmation_pending;
  if (!p || p.version !== 1) return null;
  if (p.awaiting_segment_correction) return null;
  if (p.awaiting_pending_ack) return null;

  const parsed = parseIntakeExtractionOutput(p.extraction);
  if (!parsed.ok) return null;

  const ms = p.mini_step as GuidedMiniStepId;
  const structured = buildSegmentConfirmationStructuredCore(parsed.data, ms);
  const synthesis =
    structured.length > 0
      ? structured
      : sanitizeInterpretationCoreForSegmentConfirmation(
          parsed.data.interviewer_message.trim(),
        );

  return {
    version: 1,
    synthesis,
    actions: SEGMENT_CONFIRMATION_UI_ACTIONS,
  };
}

export function suppressNextQuestionForSegmentConfirmationUi(params: {
  nextTrace: LimbicInterviewTraceV1;
  nextQuestion: string | null;
}): {
  next_question: string | null;
  segment_confirmation_ui: SegmentConfirmationUiPayloadV1 | null;
  /** When true, hide follow-up and other competing “second” questions in the client. */
  suppress_extra_question_surfaces: boolean;
} {
  const segment_confirmation_ui = buildSegmentConfirmationUiFromTrace(params.nextTrace);
  const awaitingCorrection = Boolean(
    params.nextTrace.segment_confirmation_pending?.awaiting_segment_correction,
  );
  const suppress =
    Boolean(segment_confirmation_ui) || awaitingCorrection;
  return {
    segment_confirmation_ui,
    next_question: suppress ? null : params.nextQuestion,
    suppress_extra_question_surfaces: suppress,
  };
}
