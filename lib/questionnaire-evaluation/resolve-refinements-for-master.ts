import type {
  QuestionnaireClarificationRow,
  QuestionnaireEvaluationRow,
} from "@/lib/questionnaire-evaluation/supabase-questionnaire";

export type ResolvedRefinementBundle = {
  evaluation: unknown;
  clarifications: unknown;
  /** Presente solo cuando el bundle proviene de tablas nuevas (para enlazar maestro). */
  linkTarget: { evaluationId: string } | null;
};

/**
 * Prefiere filas en `questionnaire_*`; si no hay bundle válido, usa columnas legacy en `project_responses`.
 */
export function resolvePostQuestionnaireRefinementBundle(params: {
  currentResponsesHash: string;
  newTableEvaluation: QuestionnaireEvaluationRow | null;
  newTableClarification: QuestionnaireClarificationRow | null;
  legacyEvaluation: unknown;
  legacyClarifications: unknown;
  legacySourceHash: string | null;
}): ResolvedRefinementBundle {
  const {
    currentResponsesHash,
    newTableEvaluation,
    newTableClarification,
    legacyEvaluation,
    legacyClarifications,
    legacySourceHash,
  } = params;

  if (
    newTableEvaluation &&
    newTableEvaluation.source_responses_hash === currentResponsesHash &&
    newTableClarification &&
    Array.isArray(newTableClarification.answers) &&
    newTableClarification.answers.length > 0
  ) {
    return {
      evaluation: newTableEvaluation.payload,
      clarifications: {
        submitted_at: newTableClarification.submitted_at,
        answers: newTableClarification.answers,
      },
      linkTarget: { evaluationId: newTableEvaluation.id },
    };
  }

  if (
    legacySourceHash === currentResponsesHash &&
    legacyEvaluation &&
    typeof legacyClarifications === "object" &&
    legacyClarifications !== null &&
    !Array.isArray(legacyClarifications)
  ) {
    const lc = legacyClarifications as Record<string, unknown>;
    if (Array.isArray(lc.answers) && lc.answers.length > 0) {
      return {
        evaluation: legacyEvaluation,
        clarifications: legacyClarifications,
        linkTarget: null,
      };
    }
  }

  return { evaluation: null, clarifications: null, linkTarget: null };
}
