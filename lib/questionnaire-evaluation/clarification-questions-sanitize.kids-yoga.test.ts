import { describe, expect, it } from "vitest";
import type { ClarificationQuestion } from "@/lib/questionnaire-evaluation/schema";
import {
  ensureClarificationQuestionsMinimum,
  sanitizeClarificationQuestionsForEvaluation,
} from "@/lib/questionnaire-evaluation/clarification-questions-sanitize";

/**
 * Respuestas fijas: yoga para niños, decisión de adultos/padres y colegios (sin emprendimiento).
 */
const kidsYogaParentsSchoolsResponses: Record<string, unknown> = {
  strategic_base: {
    simple_description:
      "Talleres de yoga para niños en colegios; las familias y padres firman la autorización y confían en la calma en aula.",
  },
  challenge_context: {
    challenge_explanation:
      "El mensaje lo leen adultos que no practican yoga; necesitamos claridad sin prometer milagros.",
  },
  audience_base: {
    audience_description_optional:
      "Priorizamos padres, tutores y coordinación pedagógica del colegio; a veces también profesores de educación física.",
  },
};

describe("sanitizeClarificationQuestionsForEvaluation (yoga niños / padres / colegios)", () => {
  // Nota: el pliegue de contexto añade todas las etiquetas del cuestionario; "Emprendedores"
  // aparece ahí siempre, así que aquí usamos "inversores" para comprobar el filtro de audiencias.
  it("humaniza slugs internos y elimina preguntas con audiencias no sustentadas (p. ej. inversores)", () => {
    const incoming: ClarificationQuestion[] = [
      {
        id: "q_slug_bundle",
        limbi_detection: "Brecha en evidencia y tono emocional.",
        referenced_user_answer: "no_clear_evidence",
        why_it_matters:
          "Combinas decide_confidently con un tono distrustful que choca con padres que buscan calma.",
        question_text:
          "En tu propuesta de yoga para niños con padres y colegios, ¿qué evidencia real puedes usar hoy sin inventar cifras?",
        options: [
          { id: "opt_a", label: "distrustful" },
          { id: "opt_b", label: "Seguir con testimonios de familias" },
        ],
        allow_free_text: true,
      },
      {
        id: "q_unsupported_audience",
        limbi_detection: "Audiencia ambigua.",
        referenced_user_answer: "Indicaste que quieres escalar rápido.",
        why_it_matters: "Sin foco, el mensaje se diluye.",
        question_text:
          "¿Qué métricas de tracción muestras a inversores angel en tu ronda seed?",
        allow_free_text: true,
      },
    ];

    const out = sanitizeClarificationQuestionsForEvaluation(
      incoming,
      kidsYogaParentsSchoolsResponses,
    );

    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("q_slug_bundle");

    const serialized = JSON.stringify(out[0]);
    expect(serialized).not.toMatch(/no_clear_evidence/);
    expect(serialized).not.toMatch(/decide_confidently/);
    expect(serialized).not.toMatch(/distrustful/);

    expect(out[0].referenced_user_answer).toContain("Todavía");
    expect(out[0].why_it_matters).toMatch(/Decidir con confianza/);
    expect(out[0].why_it_matters).toMatch(/Desconfiada/i);
    expect(out[0].options?.[0].label).toMatch(/Desconfiada/i);

    expect(out[0].question_text.toLowerCase()).toContain("yoga");
    expect(out[0].question_text.toLowerCase()).toMatch(/padres|colegios/);
  });

  it("genera la pregunta mínima segura en español y anclada al contexto si todo se filtra", () => {
    const onlyInvalid: ClarificationQuestion[] = [
      {
        id: "q_inversores",
        referenced_user_answer: "Texto genérico.",
        why_it_matters: "Importa.",
        question_text:
          "Para tu deck ante inversores, ¿qué ARR proyectas a 18 meses?",
        allow_free_text: true,
      },
      {
        id: "q_generica_evidencia",
        referenced_user_answer: "Otro fragmento.",
        why_it_matters: "Necesitamos pruebas.",
        question_text:
          "¿Puedes describir algún ejemplo que muestre tu éxito pasado o casos de estudio?",
        allow_free_text: true,
      },
    ];

    const cleaned = sanitizeClarificationQuestionsForEvaluation(
      onlyInvalid,
      kidsYogaParentsSchoolsResponses,
    );
    expect(cleaned).toHaveLength(0);

    const fallback = ensureClarificationQuestionsMinimum(
      cleaned,
      kidsYogaParentsSchoolsResponses,
    );
    expect(fallback).toHaveLength(1);
    expect(fallback[0].id).toBe("limbi_safe_context_anchor");

    const anchor = fallback[0].referenced_user_answer.toLowerCase();
    expect(anchor).toMatch(/yoga/);
    expect(anchor).toMatch(/niños/);
    expect(anchor).toMatch(/padres/);
    expect(anchor).toMatch(/colegios/);

    expect(fallback[0].question_text).toMatch(/^¿Qué matizarías/);
    expect(fallback[0].question_text).toMatch(
      /\b(la audiencia|evidencia|propuesta|generar)\b/i,
    );
    expect(fallback[0].limbi_detection).toMatch(/Limbi ajustó/i);
    expect(fallback[0].why_it_matters).toMatch(/Lectura Límbica/);

    const bundle = JSON.stringify(fallback[0]);
    expect(bundle).not.toMatch(/no_clear_evidence|decide_confidently|distrustful/);
    expect(bundle).not.toMatch(/inversores?|unicornio|venture\s*capital/i);
  });
});
