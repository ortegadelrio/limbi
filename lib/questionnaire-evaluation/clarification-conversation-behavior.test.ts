import { describe, expect, it } from "vitest";
import { getContextualUniversalSkipOptions } from "@/lib/questionnaire-evaluation/clarification-chip-sanitize";
import { CLARIFICATION_SKIP_NOT_AVAILABLE_ID } from "@/lib/questionnaire-evaluation/clarification-skip-constants";
import {
  isClarificationHelpSeekingUserMessage,
  sanitizeClarificationSubmitFreeText,
} from "@/lib/questionnaire-evaluation/clarification-help-intent";
import { clipClarificationQuestionsToRoundCap } from "@/lib/questionnaire-evaluation/strategic-capture-context";
import type { QuestionnaireEvaluationPayload } from "@/lib/questionnaire-evaluation/schema";

describe("clarification help / coach detection", () => {
  it.each([
    ["No entiendo"],
    ["Qué me recomiendas"],
    ["Dame ejemplos"],
    ["Explícame"],
    ["Cómo respondo esto"],
  ])("%s triggers help intent", (line) => {
    expect(isClarificationHelpSeekingUserMessage(line)).toBe(true);
  });
});

describe("sanitizeClarificationSubmitFreeText (never persist meta as answer)", () => {
  it("returns empty for help-only lines so they are not saved as free_text", () => {
    expect(sanitizeClarificationSubmitFreeText("No entiendo")).toBe("");
    expect(sanitizeClarificationSubmitFreeText("  Ayúdame  ")).toBe("");
  });

  it("keeps substantive lines and drops help-only lines in a mix", () => {
    expect(
      sanitizeClarificationSubmitFreeText(
        "Llevamos 8 años con colegios en la zona.\nNo entiendo",
      ),
    ).toBe("Llevamos 8 años con colegios en la zona.");
  });

  it("keeps substantive answers intact for persistence after a coach turn", () => {
    expect(
      sanitizeClarificationSubmitFreeText(
        "Colegios A y B en convenio desde 2022; testimonio verbal de la directora.",
      ),
    ).toBe("Colegios A y B en convenio desde 2022; testimonio verbal de la directora.");
  });
});

describe("contextual universal skip labels", () => {
  it("uses evidence-specific copy, not generic information wording", () => {
    const opts = getContextualUniversalSkipOptions("evidence");
    expect(opts.find((o) => o.id === CLARIFICATION_SKIP_NOT_AVAILABLE_ID)?.label).toBe(
      "No tengo evidencia todavía",
    );
    expect(
      opts.some((o) => o.label.includes("No tengo esta información todavía")),
    ).toBe(false);
  });

  it("uses audience-specific copy", () => {
    const opts = getContextualUniversalSkipOptions("audience");
    expect(opts[0]?.label).toBe("No tengo claridad sobre la audiencia");
    expect(opts[1]?.label).toBe("Continuar sin definir prioridad");
    expect(opts[2]?.label).toBe("La puedo precisar después");
  });

  it("uses benefit-specific copy for transformation questions", () => {
    const opts = getContextualUniversalSkipOptions("transformation_experience");
    expect(opts[0]?.label).toBe("No tengo claro el beneficio");
    expect(opts[1]?.label).toBe("Continuar con este beneficio");
    expect(opts[2]?.label).toBe("Lo mejoraré después");
  });
});

describe("follow-up rounds after re-evaluation", () => {
  it("server pipeline can clip a new batch of clarification questions for another round (no hard global UI cap)", () => {
    const evaluation: QuestionnaireEvaluationPayload = {
      overall_quality_score: 55,
      dimension_scores: {
        strategic_clarity: 50,
        audience_definition: 50,
        evidence_and_claims: 50,
        emotional_narrative: 50,
        voice_and_tone: 50,
        limbic_signals_usability: 50,
      },
      critical_gaps: ["x"],
      contradictions: [],
      missing_information: ["y"],
      clarification_questions: Array.from({ length: 6 }, (_, i) => ({
        id: `q${i}`,
        referenced_user_answer: "ctx",
        why_it_matters: "m",
        question_text: `¿Pregunta ${i}?`,
        allow_free_text: true,
      })),
      recommended_next_action: "ask_clarifications",
    };
    const clipped = clipClarificationQuestionsToRoundCap(
      evaluation.clarification_questions,
      evaluation,
    );
    expect(clipped.length).toBeGreaterThan(0);
    expect(clipped.length).toBeLessThanOrEqual(evaluation.clarification_questions.length);
  });
});
