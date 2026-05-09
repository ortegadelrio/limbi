import { describe, expect, it } from "vitest";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { extractionPayloadForTrace } from "@/lib/intake/segment-confirmation-gate";
import type { LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";
import {
  buildSegmentConfirmationUiFromTrace,
  suppressNextQuestionForSegmentConfirmationUi,
} from "@/lib/intake/segment-confirmation-ui";
import {
  segmentConfirmationActionToClassifierText,
  SEGMENT_CONFIRMATION_UI_ACTIONS,
} from "@/lib/intake/segment-confirmation-actions";
import { classifySegmentConfirmationUserReply } from "@/lib/intake/segment-confirmation";

function minimalExtraction(
  interviewer_message: string,
  internal_notes = "unit",
  extracted_response_updates: Record<string, unknown> = {},
): IntakeExtractionOutput {
  return {
    extracted_response_updates,
    confidence_by_field: {},
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [],
    answer_status: "clear",
    target_response_paths: [],
    internal_notes,
    interviewer_message,
    public_copy_allowed: false,
    user_intent: "answer",
  };
}

describe("buildSegmentConfirmationUiFromTrace", () => {
  it("returns synthesis metadata and four actions when segment confirmation is open", () => {
    const trace: LimbicInterviewTraceV1 = {
      version: 1,
      pilot_id: "strategic_interview_v1",
      phase: "segment_confirmation",
      follow_up_used: false,
      mini_step: "tailored_what",
      turns: [],
      segment_confirmation_pending: {
        version: 1,
        mini_step: "tailored_what",
        extraction: extractionPayloadForTrace(
          minimalExtraction("captura", "unit", {
            strategic_base: { simple_description: "Un programa de mentoría para founders." },
          }),
        ),
      },
    };
    const ui = buildSegmentConfirmationUiFromTrace(trace);
    expect(ui?.version).toBe(1);
    expect(ui?.synthesis).toMatch(/mentoría|founders/i);
    expect(ui?.actions).toHaveLength(4);
    expect(ui?.actions.map((a) => a.id).sort()).toEqual(
      ["adjust", "confirm", "help", "pending"].sort(),
    );
  });

  it("returns null while awaiting a free-text correction", () => {
    const trace: LimbicInterviewTraceV1 = {
      version: 1,
      pilot_id: "strategic_interview_v1",
      phase: "segment_confirmation",
      follow_up_used: false,
      mini_step: "audience",
      turns: [],
      segment_confirmation_pending: {
        version: 1,
        mini_step: "audience",
        extraction: extractionPayloadForTrace(minimalExtraction("x")),
        awaiting_segment_correction: true,
      },
    };
    expect(buildSegmentConfirmationUiFromTrace(trace)).toBeNull();
  });

  it("does not surface wizard enum values or catalog labels when only audience_type is set", () => {
    const trace: LimbicInterviewTraceV1 = {
      version: 1,
      pilot_id: "strategic_interview_v1",
      phase: "segment_confirmation",
      follow_up_used: false,
      mini_step: "audience",
      turns: [],
      segment_confirmation_pending: {
        version: 1,
        mini_step: "audience",
        extraction: extractionPayloadForTrace(
          minimalExtraction("x", "unit", {
            audience_base: { audience_type: "community_citizens" },
          }),
        ),
      },
    };
    const ui = buildSegmentConfirmationUiFromTrace(trace);
    expect(ui?.synthesis).not.toMatch(/community_citizens|end_consumers/i);
    expect(ui?.synthesis).not.toMatch(/ciudadanos|Comunidad\/|consumidores finales/i);
    expect(ui?.synthesis).toMatch(/etiqueta interna|frase concreta|actores/i);
  });
});

describe("suppressNextQuestionForSegmentConfirmationUi", () => {
  it("clears next_question when UI is present or correction is awaited", () => {
    const withUi: LimbicInterviewTraceV1 = {
      version: 1,
      pilot_id: "strategic_interview_v1",
      phase: "segment_confirmation",
      follow_up_used: false,
      mini_step: "problem",
      turns: [],
      segment_confirmation_pending: {
        version: 1,
        mini_step: "problem",
        extraction: extractionPayloadForTrace(
          minimalExtraction("y", "unit", {
            strategic_base: {
              problem_description_optional: "Stockouts en retail urbano.",
            },
          }),
        ),
      },
    };
    const a = suppressNextQuestionForSegmentConfirmationUi({
      nextTrace: withUi,
      nextQuestion: "¿Siguiente pregunta del flujo?",
    });
    expect(a.next_question).toBeNull();
    expect(a.segment_confirmation_ui).not.toBeNull();
    expect(a.suppress_extra_question_surfaces).toBe(true);

    const correcting: LimbicInterviewTraceV1 = {
      ...withUi,
      segment_confirmation_pending: {
        version: 1,
        mini_step: "problem",
        extraction: extractionPayloadForTrace(minimalExtraction("y")),
        awaiting_segment_correction: true,
      },
    };
    const b = suppressNextQuestionForSegmentConfirmationUi({
      nextTrace: correcting,
      nextQuestion: "¿Siguiente?",
    });
    expect(b.next_question).toBeNull();
    expect(b.segment_confirmation_ui).toBeNull();
    expect(b.suppress_extra_question_surfaces).toBe(true);
  });
});

describe("segment confirmation button phrases align with free-text classifier", () => {
  it("maps each UI action id to the same class as the canonical Spanish label", () => {
    for (const a of SEGMENT_CONFIRMATION_UI_ACTIONS) {
      const phrase = segmentConfirmationActionToClassifierText(a.id);
      const kind = classifySegmentConfirmationUserReply({
        userText: phrase,
        awaitingPendingAck: false,
      });
      if (a.id === "confirm") expect(kind).toBe("confirm");
      else if (a.id === "adjust") expect(kind).toBe("correct");
      else if (a.id === "help") expect(kind).toBe("help");
      else if (a.id === "pending") expect(kind).toBe("pending_missing_info");
    }
  });
});
