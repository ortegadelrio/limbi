import { describe, expect, it } from "vitest";
import {
  guidedIntakeEvaluateQuestionnaireUrl,
  guidedIntakeQuestionnaireClarifyPath,
} from "@/lib/intake/guided-intake-diagnosis-copy";
import {
  shouldShowGuidedIntakeDiagnosticCompletionPanel,
  summaryIndicatesGuidedFirstCaptureDiagnosticPreview,
} from "@/lib/intake/guided-intake-completion-ui";
import {
  coerceLegacyTraceForStrategicInterview,
  type LimbicInterviewTraceV1,
} from "@/lib/intake/orchestrator";
import type { StrategicInterviewPilotSummary } from "@/lib/intake/strategic-interview-summary";

const sampleSummary: StrategicInterviewPilotSummary = {
  title: "Completamos la primera captura del reto.",
  body: "Vista previa diagnóstica.\n\n1. Lo que entend\u00ed",
  weakLine: null,
};

describe("summaryIndicatesGuidedFirstCaptureDiagnosticPreview", () => {
  it("matches canonical pilot summary title", () => {
    expect(summaryIndicatesGuidedFirstCaptureDiagnosticPreview(sampleSummary)).toBe(
      true,
    );
  });

  it("matches body-only diagnostic preview marker", () => {
    expect(
      summaryIndicatesGuidedFirstCaptureDiagnosticPreview({
        title: "Otro título",
        body: "Vista previa diagnóstica.\n\nAlgo más.",
        weakLine: null,
      }),
    ).toBe(true);
  });

  it("does not match unrelated summaries", () => {
    expect(
      summaryIndicatesGuidedFirstCaptureDiagnosticPreview({
        title: "Borrador",
        body: "Sin vista previa diagnóstica.",
        weakLine: null,
      }),
    ).toBe(false);
  });
});

describe("shouldShowGuidedIntakeDiagnosticCompletionPanel", () => {
  it("is true for done + complete trace", () => {
    expect(
      shouldShowGuidedIntakeDiagnosticCompletionPanel({
        tracePhase: "done",
        miniStep: "complete",
        summary: null,
      }),
    ).toBe(true);
  });

  it("is true when summary indicates completion even if trace is out of sync", () => {
    expect(
      shouldShowGuidedIntakeDiagnosticCompletionPanel({
        tracePhase: "main",
        miniStep: "evidence",
        summary: sampleSummary,
      }),
    ).toBe(true);
  });

  it("is false for in-progress capture without summary", () => {
    expect(
      shouldShowGuidedIntakeDiagnosticCompletionPanel({
        tracePhase: "main",
        miniStep: "audience",
        summary: null,
      }),
    ).toBe(false);
  });
});

describe("coerceLegacyTraceForStrategicInterview (done without mini_step)", () => {
  it("sets mini_step to complete when phase is done", () => {
    const partial: LimbicInterviewTraceV1 = {
      version: 1,
      pilot_id: "strategic_interview_v1",
      phase: "done",
      follow_up_used: false,
      turns: [],
    };
    const tr = coerceLegacyTraceForStrategicInterview(partial);
    expect(tr.mini_step).toBe("complete");
    expect(tr.phase).toBe("done");
  });
});

describe("guided intake diagnosis URLs", () => {
  it("evaluate path matches API route", () => {
    expect(guidedIntakeEvaluateQuestionnaireUrl("abc")).toBe(
      "/api/projects/abc/evaluate-questionnaire",
    );
  });

  it("clarify path matches questionnaire-clarify page", () => {
    expect(guidedIntakeQuestionnaireClarifyPath("abc")).toBe(
      "/projects/abc/questionnaire-clarify",
    );
  });
});
