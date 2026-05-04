import { describe, expect, it } from "vitest";
import {
  appendTurn,
  initialTrace,
  type LimbicInterviewTraceV1,
} from "@/lib/intake/orchestrator";
import {
  buildClarificationSyntheticExtraction,
  buildClarificationTurnContent,
  detectDeterministicClarificationIntent,
  detectEvidenceUncertaintyWithoutMetaQuestion,
  traceForLlmProcessing,
} from "@/lib/intake/guided-intake-clarification";
import { parseIntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { applyStrategicInterviewExtraction } from "@/lib/intake/strategic-interview-apply";

describe("detectEvidenceUncertaintyWithoutMetaQuestion", () => {
  it("detects missing clarity without triggering on meta-questions about evidencia", () => {
    expect(detectEvidenceUncertaintyWithoutMetaQuestion("No tengo claridad")).toBe(true);
    expect(detectEvidenceUncertaintyWithoutMetaQuestion("No estoy seguro")).toBe(true);
    expect(
      detectEvidenceUncertaintyWithoutMetaQuestion("¿Qué es evidencia en este paso?"),
    ).toBe(false);
    expect(detectEvidenceUncertaintyWithoutMetaQuestion("¿A qué te refieres con evidencia?")).toBe(
      false,
    );
    expect(
      detectEvidenceUncertaintyWithoutMetaQuestion(
        "Me gustaría definir quién es la audiencia, ¿qué me recomiendas?",
      ),
    ).toBe(false);
  });
});

describe("detectDeterministicClarificationIntent", () => {
  it("detects meta-questions about the prompt", () => {
    expect(detectDeterministicClarificationIntent("¿A qué te refieres con evidencia?")).toBe(
      true,
    );
    expect(detectDeterministicClarificationIntent("No entiendo la pregunta")).toBe(true);
    expect(detectDeterministicClarificationIntent("¿Qué tipo de dato sirve?")).toBe(true);
  });

  it("does not flag substantive answers", () => {
    expect(
      detectDeterministicClarificationIntent(
        "Tenemos testimonios de clientes y tres años operando con protocolos claros.",
      ),
    ).toBe(false);
  });
});

describe("buildClarificationTurnContent (evidence)", () => {
  it("uses the required evidence explanation and reformulated question", () => {
    const c = buildClarificationTurnContent({
      miniStep: "evidence",
      challengeType: "service",
      otherChallenge: false,
    });
    expect(c.interviewer_message).toMatch(/cifra|resultado|testimonio/i);
    expect(c.interviewer_message).toMatch(/Limbi no invente/i);
    expect(c.next_question).toMatch(/¿Tienes alguna evidencia/i);
    expect(c.suggested_chips.length).toBeGreaterThanOrEqual(6);
    expect(c.suggested_chips).toContain("Testimonios");
    expect(c.suggested_chips).toContain("No tengo evidencia todavía");
  });
});

describe("clarification extraction does not mutate responses", () => {
  it("leaves audience_base unchanged for an audience-step clarification", () => {
    const base: Record<string, unknown> = {
      strategic_base: {
        simple_description: "x".repeat(20),
        offering_type: "service",
        problem_category: "lack_clarity",
        problem_description_optional: "y".repeat(12),
        transformation_type: "understand_better",
        transformation_to: "z".repeat(14),
      },
      audience_base: { audience_type: "b2b" },
      evidence_base: {},
    };
    const content = buildClarificationTurnContent({
      miniStep: "audience",
      challengeType: "service",
      otherChallenge: false,
    });
    const ex = buildClarificationSyntheticExtraction(content);
    const { mergedResponses } = applyStrategicInterviewExtraction(base, ex);
    expect(mergedResponses.audience_base).toEqual(base.audience_base);
  });

  it("leaves evidence_base unchanged when applying synthetic clarification extraction", () => {
    const base: Record<string, unknown> = {
      strategic_base: {
        simple_description: "x".repeat(20),
        offering_type: "service",
        problem_category: "lack_clarity",
        problem_description_optional: "y".repeat(12),
        transformation_type: "understand_better",
        transformation_to: "z".repeat(14),
      },
      audience_base: { audience_type: "b2b" },
      evidence_base: {
        evidence_types: ["results"],
        evidence_details: { results: "20% más ventas en 2024" },
      },
    };
    const content = buildClarificationTurnContent({
      miniStep: "evidence",
      challengeType: "service",
      otherChallenge: false,
    });
    const ex = buildClarificationSyntheticExtraction(content);
    const { mergedResponses } = applyStrategicInterviewExtraction(base, ex);
    expect(mergedResponses.evidence_base).toEqual(base.evidence_base);
    expect(ex.user_intent).toBe("clarification_question");
  });
});

describe("trace after clarification", () => {
  it("keeps mini_step as evidence and sets clarifying_question phase", () => {
    const start: LimbicInterviewTraceV1 = {
      ...initialTrace(),
      mini_step: "evidence",
      phase: "main",
      turns: [],
    };
    const content = buildClarificationTurnContent({
      miniStep: "evidence",
      challengeType: "service",
      otherChallenge: false,
    });
    const ex = buildClarificationSyntheticExtraction(content);
    let next = appendTurn(
      { ...start, phase: "clarifying_question" },
      "user",
      "¿Qué es evidencia?",
    );
    next = appendTurn(next, "assistant", ex.interviewer_message.slice(0, 500));
    expect(next.mini_step).toBe("evidence");
    expect(next.phase).toBe("clarifying_question");
  });
});

describe("traceForLlmProcessing", () => {
  it("maps strategy_validation phase to main for LLM bookkeeping", () => {
    const t: LimbicInterviewTraceV1 = {
      ...initialTrace(),
      mini_step: "evidence",
      phase: "strategy_validation",
      turns: [],
    };
    expect(traceForLlmProcessing(t).phase).toBe("main");
  });
});

describe("parseIntakeExtractionOutput user_intent", () => {
  it("defaults invalid user_intent to answer", () => {
    const r = parseIntakeExtractionOutput({
      needs_follow_up: false,
      follow_up_question: null,
      answer_status: "clear",
      public_copy_allowed: false,
      user_intent: "nope",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.user_intent).toBe("answer");
  });

  it("accepts clarification_question", () => {
    const r = parseIntakeExtractionOutput({
      needs_follow_up: false,
      follow_up_question: null,
      answer_status: "missing_choice",
      public_copy_allowed: false,
      user_intent: "clarification_question",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.user_intent).toBe("clarification_question");
  });
});
