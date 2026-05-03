/**
 * Contexto que se inyecta en el prompt del Documento Maestro (no modifica `responses` en BD).
 */
export function buildPostQuestionnaireStrategicRefinements(
  evaluation: unknown,
  clarifications: unknown,
): Record<string, unknown> | null {
  if (
    !clarifications ||
    typeof clarifications !== "object" ||
    Array.isArray(clarifications)
  ) {
    return null;
  }
  const c = clarifications as Record<string, unknown>;
  if (!Array.isArray(c.answers) || c.answers.length === 0) {
    return null;
  }

  let preEvaluationSnapshot: Record<string, unknown> | null = null;
  if (
    evaluation &&
    typeof evaluation === "object" &&
    !Array.isArray(evaluation)
  ) {
    const e = evaluation as Record<string, unknown>;
    preEvaluationSnapshot = {
      overall_quality_score: e.overall_quality_score ?? null,
      recommended_next_action: e.recommended_next_action ?? null,
      critical_gaps: e.critical_gaps ?? [],
      missing_information: e.missing_information ?? [],
      contradictions: e.contradictions ?? [],
    };
  }

  return {
    source: "post_questionnaire_clarification_flow",
    clarification_submitted_at:
      typeof c.submitted_at === "string" ? c.submitted_at : null,
    clarification_answers: c.answers,
    pre_evaluation_snapshot: preEvaluationSnapshot,
  };
}
