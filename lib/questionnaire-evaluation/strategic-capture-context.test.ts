import { describe, expect, it } from "vitest";
import { finalizeEvaluationPayload } from "@/lib/questionnaire-evaluation/clarification-questions-sanitize";
import type { QuestionnaireEvaluationPayload } from "@/lib/questionnaire-evaluation/schema";
import { LIMBIC_INTERVIEW_TRACE_KEY } from "@/lib/intake/orchestrator";
import {
  analyzeStrategicCaptureContext,
  applyGuidedStrategicCaptureGuards,
  clarificationEvidenceAffinity,
  sortClarificationQuestionsEvidenceLast,
} from "@/lib/questionnaire-evaluation/strategic-capture-context";

function doneGuidedTrace() {
  return {
    version: 1 as const,
    pilot_id: "strategic_interview_v1" as const,
    phase: "done" as const,
    mini_step: "complete" as const,
    follow_up_used: false,
    turns: [] as { at: string; role: "user" | "assistant"; summary: string }[],
  };
}

function minimalEval(
  questions: QuestionnaireEvaluationPayload["clarification_questions"],
): QuestionnaireEvaluationPayload {
  return {
    overall_quality_score: 65,
    dimension_scores: {
      strategic_clarity: 55,
      audience_definition: 55,
      evidence_and_claims: 55,
      emotional_narrative: 55,
      voice_and_tone: 55,
      limbic_signals_usability: 55,
    },
    critical_gaps: ["Brecha de contexto"],
    contradictions: [],
    missing_information: ["Detalle"],
    clarification_questions: questions,
    recommended_next_action: "ask_clarifications",
  };
}

describe("analyzeStrategicCaptureContext", () => {
  it("marks insufficient when the challenge narrative is effectively empty", () => {
    const responses: Record<string, unknown> = {
      [LIMBIC_INTERVIEW_TRACE_KEY]: doneGuidedTrace(),
      strategic_base: { simple_description: "   " },
      audience_base: {},
      evidence_base: { evidence_types: ["no_clear_evidence"] },
    };
    expect(analyzeStrategicCaptureContext(responses).tier).toBe("insufficient");
  });

  it("marks thin when challenge exists but key pillars are missing", () => {
    const responses: Record<string, unknown> = {
      [LIMBIC_INTERVIEW_TRACE_KEY]: doneGuidedTrace(),
      strategic_base: {
        simple_description: "Servicio local para reservas.",
        problem_description_optional: "",
        transformation_to: "",
      },
      audience_base: {},
      evidence_base: { evidence_types: ["no_clear_evidence"] },
    };
    expect(analyzeStrategicCaptureContext(responses).tier).toBe("thin");
  });
});

describe("applyGuidedStrategicCaptureGuards", () => {
  it("replaces questions with the foundation prompt when capture is insufficient", () => {
    const responses: Record<string, unknown> = {
      [LIMBIC_INTERVIEW_TRACE_KEY]: doneGuidedTrace(),
      strategic_base: {},
      audience_base: {},
      evidence_base: { evidence_types: ["no_clear_evidence"] },
    };
    const data = minimalEval([
      {
        id: "ev_first",
        referenced_user_answer: "Sin detalle aún.",
        why_it_matters: "Necesitamos evidencia.",
        question_text: "¿Qué evidencia concreta puedes aportar hoy?",
        allow_free_text: true,
      },
    ]);
    const out = applyGuidedStrategicCaptureGuards(data, responses);
    expect(out.suppress_numeric_quality_score).toBe(true);
    expect(out.overall_quality_score).toBe(0);
    expect(out.clarification_questions[0]?.id).toBe("guided_context_foundation_v1");
    expect(out.clarification_questions[0]?.question_text).toMatch(/Antes de evaluar evidencia/i);
  });

  it("sorts evidence-leaning questions after others when foundations are thin", () => {
    const responses: Record<string, unknown> = {
      [LIMBIC_INTERVIEW_TRACE_KEY]: doneGuidedTrace(),
      strategic_base: {
        simple_description: "Servicio local para coordinar reservas y horarios.",
      },
      audience_base: {},
      evidence_base: { evidence_types: ["no_clear_evidence"] },
    };
    const ctx = analyzeStrategicCaptureContext(responses);
    expect(ctx.tier).toBe("thin");
    const qs = [
      {
        id: "a",
        referenced_user_answer: "Algo breve.",
        why_it_matters: "Importa.",
        question_text: "¿Qué evidencia o casos reales puedes mencionar?",
        allow_free_text: true,
      },
      {
        id: "b",
        referenced_user_answer: "Algo breve.",
        why_it_matters: "Importa.",
        question_text: "¿Para quién es prioritario este mensaje hoy?",
        allow_free_text: true,
      },
    ];
    const sorted = sortClarificationQuestionsEvidenceLast(qs, ctx);
    expect(sorted[0]!.id).toBe("b");
    expect(sorted[1]!.id).toBe("a");
  });
});

describe("finalizeEvaluationPayload + guided first capture", () => {
  it("does not surface a numeric-looking score path for empty guided capture", () => {
    const responses: Record<string, unknown> = {
      [LIMBIC_INTERVIEW_TRACE_KEY]: doneGuidedTrace(),
      strategic_base: {},
      audience_base: {},
      evidence_base: { evidence_types: ["no_clear_evidence"] },
    };
    const out = finalizeEvaluationPayload(minimalEval([]), responses);
    expect(out.suppress_numeric_quality_score).toBe(true);
    expect(out.overall_quality_score).toBe(0);
    expect(out.clarification_questions[0]?.id).toBe("guided_context_foundation_v1");
  });
});
