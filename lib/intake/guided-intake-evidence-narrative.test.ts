import { describe, expect, it } from "vitest";
import { NO_CLEAR_EVIDENCE } from "@/lib/constants/wizard";
import {
  detectProofLikeEvidenceNarrative,
  explicitEvidenceAbsenceDeclaration,
} from "@/lib/intake/guided-intake-evidence-input-classifier";
import {
  inferWizardEvidenceTypesFromProofNarrative,
  normalizeEvidenceStepExtractionOutput,
} from "@/lib/intake/guided-intake-evidence-narrative";
import { isGuidedStrategicIntakeFirstCaptureComplete } from "@/lib/intake/guided-intake-completion";
import {
  advanceMiniStepFrom,
  LIMBIC_INTERVIEW_TRACE_KEY,
  type LimbicInterviewTraceV1,
} from "@/lib/intake/orchestrator";
import {
  buildSegmentConfirmationStructuredCore,
  segmentConfirmAdvanceAckMessage,
} from "@/lib/intake/segment-confirmation";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";

const SAMPLE_COLEGIOS =
  "No tengo más que mi experiencia de más de 10 años y 450 viajes realizados para otros colegios.";

describe("detectProofLikeEvidenceNarrative", () => {
  it("treats ‘no tengo más que …’ with substance as proof", () => {
    expect(detectProofLikeEvidenceNarrative(SAMPLE_COLEGIOS)).toBe(true);
  });

  it("does not treat bare ‘no tengo evidencia’ as proof narrative", () => {
    expect(detectProofLikeEvidenceNarrative("No tengo evidencia todavía.")).toBe(false);
  });
});

describe("explicitEvidenceAbsenceDeclaration", () => {
  it("is false when the user only offers proof (even if the sentence starts with no tengo más que)", () => {
    expect(explicitEvidenceAbsenceDeclaration(SAMPLE_COLEGIOS)).toBe(false);
  });

  it("is true for explicit lack of evidence", () => {
    expect(explicitEvidenceAbsenceDeclaration("No tengo evidencia clara aún.")).toBe(true);
    expect(explicitEvidenceAbsenceDeclaration("Aún no tengo pruebas.")).toBe(true);
  });
});

describe("inferWizardEvidenceTypesFromProofNarrative", () => {
  it("infers wizard-safe types for años, viajes and colegios", () => {
    const t = inferWizardEvidenceTypesFromProofNarrative(SAMPLE_COLEGIOS);
    expect(t).toContain("results");
    expect(t).toContain("clients_partners");
    expect(t).toContain("case_studies");
    expect(t.every((x) => x !== "experience" && x !== "metrics")).toBe(true);
  });
});

describe("normalizeEvidenceStepExtractionOutput", () => {
  it("removes no_clear_evidence, adds narrative detail, and clears follow-up for proof answers", () => {
    const before: IntakeExtractionOutput = {
      extracted_response_updates: {
        evidence_base: {
          evidence_types: [NO_CLEAR_EVIDENCE],
          evidence_details: {},
        },
      },
      confidence_by_field: {},
      needs_follow_up: true,
      follow_up_question: "¿Puedes dar un ejemplo?",
      suggested_answer_chips: [],
      answer_status: "weak",
      target_response_paths: [],
      internal_notes: "test",
      interviewer_message: "Algo largo y analítico.",
      public_copy_allowed: false,
      user_intent: "strategic_validation_question",
    };
    const out = normalizeEvidenceStepExtractionOutput(SAMPLE_COLEGIOS, before);
    expect(out.needs_follow_up).toBe(false);
    expect(out.follow_up_question).toBeNull();
    expect(out.user_intent).toBe("answer");
    const eb = out.extracted_response_updates?.evidence_base as Record<string, unknown>;
    const types = eb.evidence_types as string[];
    expect(types.includes(NO_CLEAR_EVIDENCE)).toBe(false);
    expect(types.length).toBeGreaterThan(0);
    const det = eb.evidence_details as Record<string, string>;
    expect(det.narrativa_usuario).toContain("450");
  });

  it("produces segment confirmation copy without internal slug tokens", () => {
    const normalized = normalizeEvidenceStepExtractionOutput(SAMPLE_COLEGIOS, {
      extracted_response_updates: { evidence_base: {} },
      confidence_by_field: {},
      needs_follow_up: false,
      follow_up_question: null,
      suggested_answer_chips: [],
      answer_status: "clear",
      target_response_paths: [],
      internal_notes: "",
      interviewer_message: "",
      public_copy_allowed: false,
      user_intent: "answer",
    });
    const line = buildSegmentConfirmationStructuredCore(normalized, "evidence");
    expect(line).toMatch(/La evidencia disponible es/i);
    expect(line.toLowerCase()).not.toContain("experience");
    expect(line.toLowerCase()).not.toContain("metrics");
    expect(line.toLowerCase()).not.toContain("testimonials");
    expect(line.toLowerCase()).not.toContain("case_studies");
    expect(line).toContain("450");
  });
});

describe("evidence step completion pattern", () => {
  const traceEvidence: LimbicInterviewTraceV1 = {
    version: 1,
    pilot_id: "strategic_interview_v1",
    phase: "main",
    mini_step: "evidence",
    follow_up_used: false,
    turns: [],
  };

  it("advances evidence → complete/done in one jump", () => {
    const next = advanceMiniStepFrom(traceEvidence);
    expect(next.mini_step).toBe("complete");
    expect(next.phase).toBe("done");
  });

  it("complete/done trace satisfies isGuidedStrategicIntakeFirstCaptureComplete", () => {
    const done: LimbicInterviewTraceV1 = {
      ...traceEvidence,
      phase: "done",
      mini_step: "complete",
    };
    const responses = {
      strategic_base: { simple_description: "x".repeat(20) },
      [LIMBIC_INTERVIEW_TRACE_KEY]: done,
    };
    expect(isGuidedStrategicIntakeFirstCaptureComplete(responses)).toBe(true);
  });
});

describe("segmentConfirmAdvanceAckMessage", () => {
  it("returns short non-analytical copy", () => {
    const m = segmentConfirmAdvanceAckMessage("confirm");
    expect(m.length).toBeLessThan(40);
    expect(m.toLowerCase()).not.toContain("sistema");
    expect(m.toLowerCase()).not.toContain("emocional");
  });
});
