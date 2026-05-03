import { describe, expect, it } from "vitest";
import {
  clipClarificationQuestionsToScoreCap,
  getClarificationQuestionCap,
} from "@/lib/questionnaire-evaluation/clarification-round-cap";
import { finalizeEvaluationPayload } from "@/lib/questionnaire-evaluation/clarification-questions-sanitize";
import type { QuestionnaireEvaluationPayload } from "@/lib/questionnaire-evaluation/schema";

function makePayload(
  score: number,
  nQuestions: number,
): QuestionnaireEvaluationPayload {
  const clarification_questions = Array.from({ length: nQuestions }, (_, i) => ({
    id: `q_${i}`,
    referenced_user_answer: "Padres y colegios priorizan la calma en aula.",
    why_it_matters: "Importa para la Lectura Límbica.",
    question_text: `En yoga para niños y colegios, ¿qué matiz ${i + 1} añadirías?`,
    allow_free_text: true,
  }));
  return {
    overall_quality_score: score,
    dimension_scores: {
      strategic_clarity: score,
      audience_definition: score,
      evidence_and_claims: score,
      emotional_narrative: score,
      voice_and_tone: score,
      limbic_signals_usability: score,
    },
    critical_gaps: ["Brecha de ejemplo"],
    contradictions: [],
    missing_information: ["Falta de ejemplo"],
    clarification_questions,
    recommended_next_action: "ask_clarifications",
  };
}

describe("clarification round cap", () => {
  it("caps by score band", () => {
    expect(getClarificationQuestionCap(82)).toBe(2);
    expect(getClarificationQuestionCap(70)).toBe(4);
    expect(getClarificationQuestionCap(55)).toBe(5);
  });

  it("finalizeEvaluationPayload never returns more than 5 questions", () => {
    const responses = {
      strategic_base: {
        simple_description: "Yoga para niños en colegios con padres.",
      },
    };
    const payload = makePayload(55, 8);
    const out = finalizeEvaluationPayload(payload, responses);
    expect(out.clarification_questions.length).toBeLessThanOrEqual(5);
  });

  it("clipClarificationQuestionsToScoreCap trims at 65–79 band", () => {
    const qs = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
    expect(clipClarificationQuestionsToScoreCap(qs, 70)).toHaveLength(4);
  });
});
