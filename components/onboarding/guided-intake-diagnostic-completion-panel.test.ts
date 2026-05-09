import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuidedIntakeDiagnosticCompletionPanel } from "@/components/onboarding/guided-intake-diagnostic-completion-panel";
import {
  GUIDED_INTAKE_DIAGNOSIS_PRIMARY_CTA_ES,
  GUIDED_INTAKE_DIAGNOSIS_SECONDARY_CTA_ES,
} from "@/lib/intake/guided-intake-diagnosis-copy";
import { shouldShowGuidedIntakeDiagnosticCompletionPanel } from "@/lib/intake/guided-intake-completion-ui";
import type { StrategicInterviewPilotSummary } from "@/lib/intake/strategic-interview-summary";

const diagnosticPreviewSummary: StrategicInterviewPilotSummary = {
  title: "Completamos la primera captura del reto.",
  body: "Vista previa diagnóstica.\n\n1. Lo que entendí",
  weakLine: null,
};

describe("GuidedIntakeDiagnosticCompletionPanel", () => {
  it("renders both diagnosis CTAs for the diagnostic preview summary", () => {
    const html = renderToStaticMarkup(
      React.createElement(GuidedIntakeDiagnosticCompletionPanel, {
        summary: diagnosticPreviewSummary,
        diagnosisLoading: false,
        diagnosisError: null,
        continueBaseHref: "/projects/new?projectId=test",
        onRunDiagnosis: () => {},
      }),
    );
    expect(html).toContain(GUIDED_INTAKE_DIAGNOSIS_PRIMARY_CTA_ES);
    expect(html).toContain(GUIDED_INTAKE_DIAGNOSIS_SECONDARY_CTA_ES);
  });

  it("uses diagnosis CTA test ids, not suggested-answer chip test ids", () => {
    const html = renderToStaticMarkup(
      React.createElement(GuidedIntakeDiagnosticCompletionPanel, {
        summary: diagnosticPreviewSummary,
        diagnosisLoading: false,
        diagnosisError: null,
        continueBaseHref: "/x",
        onRunDiagnosis: () => {},
      }),
    );
    expect(html).toContain('data-testid="guided-intake-diagnosis-primary-cta"');
    expect(html).toContain('data-testid="guided-intake-diagnosis-secondary-cta"');
    expect(html).not.toContain("guided-intake-suggested-answer-chip");
  });
});

describe("diagnostic completion panel visibility (logic)", () => {
  it("shows the same completion surface for done+complete trace as for diagnostic preview summary", () => {
    expect(
      shouldShowGuidedIntakeDiagnosticCompletionPanel({
        tracePhase: "done",
        miniStep: "complete",
        summary: null,
      }),
    ).toBe(true);
    expect(
      shouldShowGuidedIntakeDiagnosticCompletionPanel({
        tracePhase: "main",
        miniStep: "evidence",
        summary: diagnosticPreviewSummary,
      }),
    ).toBe(true);
  });
});
