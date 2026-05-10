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
        `${label} subió de ${prev} a ${afterScore}: tus aclaraciones aportaron matices útiles. Sigue por debajo de 70, así que Limbi seguirá marcando cautela ahí hasta que haya más hechos observables (prioridades, casos o pruebas concretas).`,
      );
    } else if (afterScore < prev) {
      notes.push(
        `${label} pasó de ${prev} a ${afterScore}: a veces la evaluación se vuelve más exigente al cruzar el cuestionario con lo que acabas de precisar, o esta dimensión quedó más expuesta. Vale la pena volver a esa zona con ejemplos o decisiones explícitas en una siguiente ronda si quieres subir la base.`,
      );
    } else {
      notes.push(
        `${label} se quedó en ${afterScore}: sigue siendo un punto sensible frente al umbral de 70; suele deberse a poca evidencia observable, audiencia poco priorizada o beneficio aún genérico en esa área.`,
      );
    }
  }

  return notes;
}
