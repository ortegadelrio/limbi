import { describe, expect, it } from "vitest";
import {
  CLARIFICATION_SKIP_CONTINUE_BASE_ID,
  CLARIFICATION_SKIP_NOT_AVAILABLE_ID,
} from "@/lib/questionnaire-evaluation/clarification-skip-constants";
import type {
  ClarificationAnswer,
  ClarificationQuestion,
} from "@/lib/questionnaire-evaluation/schema";
import { validateClarificationAnswersAgainstQuestions } from "@/lib/questionnaire-evaluation/validate-clarification-submit";

function qWithSkips(
  id: string,
  extra: Partial<ClarificationQuestion> = {},
): ClarificationQuestion {
  return {
    id,
    referenced_user_answer: "Contexto usuario.",
    why_it_matters: "Importa.",
    question_text: "¿Qué evidencia real puedes usar hoy?",
    options: [
      { id: "chip_ev_years", label: "Años de experiencia" },
      { id: CLARIFICATION_SKIP_NOT_AVAILABLE_ID, label: "No tengo esta información todavía" },
      { id: CLARIFICATION_SKIP_CONTINUE_BASE_ID, label: "Continuar con esta base" },
    ],
    allow_free_text: true,
    ...extra,
  };
}

describe("validateClarificationAnswersAgainstQuestions", () => {
  it("accepts universal skip without free text", () => {
    const questions = [qWithSkips("q1")];
    const answers: ClarificationAnswer[] = [
      {
        question_id: "q1",
        selected_option_id: CLARIFICATION_SKIP_NOT_AVAILABLE_ID,
        answer_status: "not_available_yet",
        should_update_master: true,
        confidence_level: "low",
        strategic_topic: "¿Qué evidencia real puedes usar hoy?",
        target_master_fields: ["evidence_base"],
        claim_limits: "Evitar afirmaciones contundentes.",
      },
    ];
    expect(validateClarificationAnswersAgainstQuestions(questions, answers)).toEqual({
      ok: true,
    });
  });

  it("accepts chip selection without text", () => {
    const questions = [qWithSkips("q1")];
    const answers: ClarificationAnswer[] = [
      { question_id: "q1", selected_option_id: "chip_ev_years" },
    ];
    expect(validateClarificationAnswersAgainstQuestions(questions, answers)).toEqual({
      ok: true,
    });
  });
});
