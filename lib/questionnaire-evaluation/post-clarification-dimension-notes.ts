import type { QuestionnaireEvaluationPayload } from "@/lib/questionnaire-evaluation/schema";

const DIMENSION_LABEL_ES: Record<string, string> = {
  strategic_clarity: "Claridad estratégica",
  audience_definition: "Definición de audiencia",
  evidence_and_claims: "Evidencia y afirmaciones",
  emotional_narrative: "Narrativa emocional",
  voice_and_tone: "Voz y tono",
  limbic_signals_usability: "Señales límbicas / utilidad",
};

/**
 * Explicaciones breves en español cuando una dimensión sigue &lt; 70 tras las aclaraciones.
 */
export function buildPostClarificationDimensionNotes(
  before: QuestionnaireEvaluationPayload,
  after: QuestionnaireEvaluationPayload,
): string[] {
  const notes: string[] = [];

  for (const [key, afterScore] of Object.entries(after.dimension_scores)) {
    if (afterScore >= 70) continue;
    const prev = before.dimension_scores[key] ?? afterScore;
    const label = DIMENSION_LABEL_ES[key] ?? key;

    if (afterScore > prev) {
      notes.push(
        `${label} mejoró (${prev}→${afterScore}) gracias a tus aclaraciones, pero sigue en nivel medio (${afterScore}/100): conviene añadir más detalle observable (hechos concretos, prioridades explícitas o pruebas cualitativas) cuando puedas.`,
      );
    } else if (afterScore < prev) {
      notes.push(
        `${label} quedó en ${afterScore} (antes ${prev}). Revisa coherencia entre el cuestionario original y lo que acabas de precisar.`,
      );
    } else {
      notes.push(
        `${label} se mantiene en ${afterScore}: sigue siendo un punto débil frente al umbral de 70; suele deberse a falta de testimonios, casos, resultados observables o referencias concretas en esa área.`,
      );
    }
  }

  return notes;
}
