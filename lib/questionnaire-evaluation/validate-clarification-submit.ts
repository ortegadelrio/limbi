import {
  isUniversalClarificationSkipOptionId,
} from "@/lib/questionnaire-evaluation/clarification-skip-constants";
import type {
  ClarificationAnswer,
  ClarificationQuestion,
} from "@/lib/questionnaire-evaluation/schema";

function answerIsComplete(
  q: ClarificationQuestion,
  a: ClarificationAnswer,
): boolean {
  const ft = (a.free_text ?? "").trim();
  if (ft.length > 0) return true;

  if (a.selected_option_id && isUniversalClarificationSkipOptionId(a.selected_option_id)) {
    return true;
  }

  if (
    a.answer_status === "not_available_yet" ||
    a.answer_status === "continue_with_base" ||
    a.answer_status === "improve_later"
  ) {
    return true;
  }

  const opts = q.options ?? [];
  if (opts.length > 0 && a.selected_option_id) {
    const validOpt = new Set(opts.map((o) => o.id));
    if (validOpt.has(a.selected_option_id)) return true;
  }

  return false;
}

export function validateClarificationAnswersAgainstQuestions(
  questions: ClarificationQuestion[],
  answers: ClarificationAnswer[],
): { ok: true } | { ok: false; message: string } {
  const expected = new Set(questions.map((q) => q.id));
  const got = new Set(answers.map((a) => a.question_id));
  if (expected.size !== got.size) {
    return {
      ok: false,
      message: "El número de respuestas no coincide con las preguntas.",
    };
  }
  for (const id of expected) {
    if (!got.has(id)) {
      return {
        ok: false,
        message: `Falta respuesta para la pregunta: ${id}.`,
      };
    }
  }

  const byId = new Map(questions.map((q) => [q.id, q] as const));

  for (const a of answers) {
    const q = byId.get(a.question_id);
    if (!q) {
      return { ok: false, message: `Pregunta desconocida: ${a.question_id}.` };
    }

    if (!answerIsComplete(q, a)) {
      return {
        ok: false,
        message: `Completa esta pregunta (texto, una opción o una opción de omisión): ${q.question_text}`,
      };
    }

    if (a.answer_status && a.answer_status !== "normal") {
      continue;
    }

    const ft = (a.free_text ?? "").trim();
    const opts = q.options ?? [];

    if (a.selected_option_id && isUniversalClarificationSkipOptionId(a.selected_option_id)) {
      continue;
    }

    if (opts.length > 0 && a.selected_option_id) {
      const validOpt = new Set(opts.map((o) => o.id));
      if (!validOpt.has(a.selected_option_id)) {
        return {
          ok: false,
          message: `Opción inválida para ${q.id}.`,
        };
      }
    } else if (opts.length > 0 && !a.selected_option_id) {
      if (q.allow_free_text !== false && ft.length > 0) {
        continue;
      }
      return {
        ok: false,
        message: `Selecciona una opción o escribe una respuesta para: ${q.question_text}`,
      };
    } else {
      if (q.allow_free_text === false && ft.length === 0 && !a.answer_status) {
        return {
          ok: false,
          message: `La pregunta ${q.id} requiere respuesta.`,
        };
      }
    }
  }

  return { ok: true };
}
