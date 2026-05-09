import { describe, expect, it } from "vitest";
import { resolveGuidedIntakeTurn } from "@/lib/intake/conversational-engine";
import { extractionPayloadForTrace } from "@/lib/intake/segment-confirmation-gate";
import type { LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import {
  detectSegmentCorrectionMode,
  shouldResolveSegmentWhileCorrectionPending,
  shouldUseSegmentCorrectionLlmPath,
} from "@/lib/intake/segment-correction-mode";
import { mergePendingSegmentCorrectionExtraction } from "@/lib/intake/merge-segment-correction-extraction";
import {
  nextMiniStep,
  questionForMiniStep,
} from "@/lib/intake/guided-interview-flow";

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

describe("segment correction mode detection", () => {
  it("treats agregaría as additive, not replacement", () => {
    expect(detectSegmentCorrectionMode("Agregaría que también aplica a otro canal.")).toBe(
      "add",
    );
    expect(shouldUseSegmentCorrectionLlmPath("Agregaría que también aplica.", false)).toBe(
      true,
    );
  });

  it("treats replacement markers as replace", () => {
    expect(detectSegmentCorrectionMode("Mejor dicho, la idea central es otra.")).toBe(
      "replace",
    );
    expect(shouldUseSegmentCorrectionLlmPath("Mejor dicho, otra idea.", false)).toBe(true);
  });

  it("treats wording-improvement markers as improve", () => {
    expect(detectSegmentCorrectionMode("Hazlo más claro, suena raro.")).toBe("improve");
    expect(shouldUseSegmentCorrectionLlmPath("Redáctalo mejor.", false)).toBe(true);
  });

  it("routes short confirm phrases to segment resolution while correction is pending", () => {
    expect(shouldUseSegmentCorrectionLlmPath("Sí, así está bien", false)).toBe(false);
    expect(shouldResolveSegmentWhileCorrectionPending("Sí, así está bien", false)).toBe(
      true,
    );
  });

  it("routes substantive correction text to the LLM path", () => {
    const t =
      "Hay otro actor que también debe quedar explícito en la misma línea estratégica.";
    expect(shouldUseSegmentCorrectionLlmPath(t, false)).toBe(true);
    expect(shouldResolveSegmentWhileCorrectionPending(t, false)).toBe(false);
  });
});

describe("mergePendingSegmentCorrectionExtraction (additive)", () => {
  it("returns the LLM extraction unchanged for add mode (fusion happens in the model, not by concatenation)", () => {
    const pending = minimalExtraction("prev", "unit", {
      strategic_base: {
        problem_description_optional:
          "Una tensión es que quien autoriza necesita más señales de confianza.",
      },
    });
    const incoming = minimalExtraction("new", "unit", {
      strategic_base: {
        problem_description_optional:
          "Una sola redacción integrada que funde autorización y recomendación sin repetir la frase previa.",
      },
    });
    const merged = mergePendingSegmentCorrectionExtraction({
      mode: "add",
      pending,
      incoming,
      miniStep: "problem",
    });
    expect(merged).toBe(incoming);
    const sb = merged.extracted_response_updates?.strategic_base as Record<
      string,
      unknown
    >;
    expect(sb.problem_description_optional).toBe(
      "Una sola redacción integrada que funde autorización y recomendación sin repetir la frase previa.",
    );
  });

  it("does not merge when mode is replace", () => {
    const pending = minimalExtraction("prev", "unit", {
      strategic_base: { problem_description_optional: "Texto anterior largo." },
    });
    const incoming = minimalExtraction("new", "unit", {
      strategic_base: { problem_description_optional: "Solo la nueva idea." },
    });
    const merged = mergePendingSegmentCorrectionExtraction({
      mode: "replace",
      pending,
      incoming,
      miniStep: "problem",
    });
    const sb = merged.extracted_response_updates?.strategic_base as Record<
      string,
      unknown
    >;
    expect(sb.problem_description_optional).toBe("Solo la nueva idea.");
  });
});

describe("resolveGuidedIntakeTurn + correction pending", () => {
  const traceBase = (
    awaitingCorrection: boolean,
    segMini: "tailored_what" | "problem" | "transformation" | "audience" | "evidence",
    journeyMini: typeof segMini,
  ): LimbicInterviewTraceV1 => ({
    version: 1,
    pilot_id: "strategic_interview_v1",
    phase: "segment_confirmation",
    follow_up_used: false,
    mini_step: journeyMini,
    turns: [],
    segment_confirmation_pending: {
      version: 1,
      mini_step: segMini,
      extraction: extractionPayloadForTrace(
        minimalExtraction("captura", "unit", {
          strategic_base: { simple_description: "Línea base." },
        }),
      ),
      ...(awaitingCorrection ? { awaiting_segment_correction: true } : {}),
    },
  });

  it("does not send structured confirm to LLM when a correction was awaited", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "Sí, así está bien",
      miniStep: "problem",
      trace: traceBase(true, "problem", "problem"),
    });
    expect(d.action).toBe("segment_confirmation_resolve");
    expect(d.notes_for_route.segmentConfirmationKind).toBe("confirm");
    expect(d.skip_llm_extraction).toBe(true);
  });
});

describe("expected bank question after segment confirm (gated steps)", () => {
  const ct = "service";
  const other = false;

  it("advances tailored_what → problem", () => {
    const n = nextMiniStep("tailored_what");
    expect(n).toBe("problem");
    expect(questionForMiniStep(n!, ct, other)).toBeTruthy();
  });

  it("advances problem → transformation", () => {
    const n = nextMiniStep("problem");
    expect(n).toBe("transformation");
    expect(questionForMiniStep(n!, ct, other)).toBeTruthy();
  });

  it("advances transformation → audience", () => {
    const n = nextMiniStep("transformation");
    expect(n).toBe("audience");
    expect(questionForMiniStep(n!, ct, other)).toBeTruthy();
  });

  it("advances audience → evidence", () => {
    const n = nextMiniStep("audience");
    expect(n).toBe("evidence");
    expect(questionForMiniStep(n!, ct, other)).toBeTruthy();
  });

  it("advances evidence → complete (no further bank question)", () => {
    const n = nextMiniStep("evidence");
    expect(n).toBe("complete");
    expect(questionForMiniStep(n!, ct, other)).toBeNull();
  });
});
