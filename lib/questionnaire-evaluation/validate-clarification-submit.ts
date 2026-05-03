import type {
  ClarificationAnswer,
  ClarificationQuestion,
} from "@/lib/questionnaire-evaluation/schema";

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
    const ft = (a.free_text ?? "").trim();
    const opts = q.options ?? [];
    if (opts.length > 0) {
      const validOpt = new Set(opts.map((o) => o.id));
      if (a.selected_option_id) {
        if (!validOpt.has(a.selected_option_id)) {
          return {
            ok: false,
            message: `Opción inválida para ${q.id}.`,
          };
        }
      } else if (q.allow_free_text !== false && ft.length > 0) {
        // ok — texto libre en lugar de opción
      } else {
        return {
          ok: false,
          message: `Selecciona una opción para: ${q.question_text}`,
        };
      }
    } else {
      if (q.allow_free_text === false) {
        return {
          ok: false,
          message: `La pregunta ${q.id} requiere respuesta.`,
        };
      }
      if (ft.length === 0) {
        return {
          ok: false,
          message: `Responde en texto la pregunta: ${q.question_text}`,
        };
      }
    }
  }

  return { ok: true };
}
