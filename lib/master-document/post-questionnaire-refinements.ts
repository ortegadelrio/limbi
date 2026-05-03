import { detectProjectChipCategory } from "@/lib/questionnaire-evaluation/clarification-chip-sanitize";

const ALCOHOL_RESPONSIBLE_NOTE_ES =
  "Comunicación responsable sobre bebidas alcohólicas: no dirigirse a menores; no implicar que el alcohol mejora la salud, el estatus, el rendimiento o el bienestar emocional; no fomentar el consumo excesivo; centrar afirmaciones en sabor, oficio, experiencia, ocasión y disfrute responsable.";

/**
 * Contexto que se inyecta en el prompt del Documento Maestro (no modifica `responses` en BD).
 */
export function buildPostQuestionnaireStrategicRefinements(
  evaluation: unknown,
  clarifications: unknown,
  wizardResponses?: Record<string, unknown> | null,
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

  const postRound =
    c.post_round_evaluation && typeof c.post_round_evaluation === "object"
      ? (c.post_round_evaluation as Record<string, unknown>)
      : null;

  const dimensionNotes = Array.isArray(c.dimension_improvement_notes)
    ? c.dimension_improvement_notes.filter((x) => typeof x === "string")
    : [];

  const limbic_generation_caution =
    typeof c.client_generation_caution === "string" &&
    c.client_generation_caution.trim().length > 0
      ? c.client_generation_caution.trim()
      : null;

  const answersArr = Array.isArray(c.answers) ? c.answers : [];
  const not_available_yet_items = answersArr.filter(
    (x) =>
      x &&
      typeof x === "object" &&
      !Array.isArray(x) &&
      (x as Record<string, unknown>).answer_status === "not_available_yet",
  );

  let alcohol_responsible_communication_note: string | null = null;
  if (wizardResponses && typeof wizardResponses === "object") {
    const cat = detectProjectChipCategory(wizardResponses);
    if (cat === "alcohol_communication" || cat === "cocktails_beverage") {
      alcohol_responsible_communication_note = ALCOHOL_RESPONSIBLE_NOTE_ES;
    }
  }

  return {
    source: "post_questionnaire_clarification_flow",
    clarification_submitted_at:
      typeof c.submitted_at === "string" ? c.submitted_at : null,
    clarification_answers: c.answers,
    pre_evaluation_snapshot: preEvaluationSnapshot,
    score_before_clarifications:
      typeof c.score_before_clarifications === "number"
        ? c.score_before_clarifications
        : null,
    score_after_clarifications:
      typeof c.score_after_clarifications === "number"
        ? c.score_after_clarifications
        : null,
    post_clarification_evaluation_snapshot: postRound,
    dimension_improvement_notes: dimensionNotes,
    limbic_generation_caution,
    clarification_not_available_yet_items: not_available_yet_items,
    alcohol_responsible_communication_note,
  };
}
