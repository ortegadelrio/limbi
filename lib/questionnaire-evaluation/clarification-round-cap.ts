/**
 * Límite de preguntas de aclaración por ronda según la puntuación global del cuestionario.
 * Nunca más de 5 en una sola ronda.
 */
export function getClarificationQuestionCap(overallScore: number): number {
  if (overallScore >= 80) return 2;
  if (overallScore >= 65) return 4;
  return 5;
}

export function clipClarificationQuestionsToScoreCap<T extends { id: string }>(
  questions: T[],
  overallScore: number,
): T[] {
  const cap = getClarificationQuestionCap(overallScore);
  return questions.slice(0, Math.min(cap, 5));
}
