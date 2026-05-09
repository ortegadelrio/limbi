import { isGuidedStrategicIntakeFirstCaptureComplete } from "@/lib/intake/guided-intake-completion";
import { getClarificationQuestionCap } from "@/lib/questionnaire-evaluation/clarification-round-cap";
import type {
  ClarificationQuestion,
  QuestionnaireEvaluationPayload,
} from "@/lib/questionnaire-evaluation/schema";

export type GuidedCaptureContextTier = "insufficient" | "thin" | "adequate";

export type StrategicCaptureContextAnalysis = {
  tier: GuidedCaptureContextTier;
  hasChallengeDefinition: boolean;
  hasAudienceSignal: boolean;
  hasProblemSignal: boolean;
  hasBenefitSignal: boolean;
  hasEvidenceBeyondNone: boolean;
};

function readRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function strLen(v: unknown): number {
  return typeof v === "string" ? v.trim().length : 0;
}

function evidenceDetailsHaveText(eb: Record<string, unknown>): boolean {
  const det = eb.evidence_details;
  if (!det || typeof det !== "object" || Array.isArray(det)) return false;
  for (const x of Object.values(det as Record<string, unknown>)) {
    if (typeof x === "string" && x.trim().length >= 8) return true;
  }
  return false;
}

/**
 * Heuristic on stored questionnaire responses (no LLM): is there enough
 * strategic narrative to justify a numeric pre-Master quality score?
 */
export function analyzeStrategicCaptureContext(
  responses: Record<string, unknown>,
): StrategicCaptureContextAnalysis {
  const sb = readRecord(responses.strategic_base);
  const cc = readRecord(responses.challenge_context);
  const ab = readRecord(responses.audience_base);
  const eb = readRecord(responses.evidence_base);

  const challengeLen = Math.max(
    strLen(sb.simple_description),
    strLen(cc.challenge_explanation),
    strLen((responses as { main_challenge?: unknown }).main_challenge),
  );

  const hasChallengeDefinition = challengeLen >= 20;

  const hasAudienceSignal =
    strLen(ab.audience_description_optional) >= 10 ||
    (strLen(ab.audience_type) > 0 && challengeLen >= 28);

  const hasProblemSignal = strLen(sb.problem_description_optional) >= 12;
  const hasBenefitSignal = strLen(sb.transformation_to) >= 12;

  const types = Array.isArray(eb.evidence_types)
    ? (eb.evidence_types as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const hasEvidenceBeyondNone =
    types.some((t) => t.trim() && t !== "no_clear_evidence") || evidenceDetailsHaveText(eb);

  if (!hasChallengeDefinition) {
    return {
      tier: "insufficient",
      hasChallengeDefinition,
      hasAudienceSignal,
      hasProblemSignal,
      hasBenefitSignal,
      hasEvidenceBeyondNone,
    };
  }

  const pillarsFilled = [
    hasAudienceSignal,
    hasProblemSignal,
    hasBenefitSignal,
  ].filter(Boolean).length;

  const thinByPillars = pillarsFilled < 2;
  const thinByNarrative = challengeLen < 36 && pillarsFilled < 3;

  if (thinByPillars || thinByNarrative) {
    return {
      tier: "thin",
      hasChallengeDefinition,
      hasAudienceSignal,
      hasProblemSignal,
      hasBenefitSignal,
      hasEvidenceBeyondNone,
    };
  }

  return {
    tier: "adequate",
    hasChallengeDefinition,
    hasAudienceSignal,
    hasProblemSignal,
    hasBenefitSignal,
    hasEvidenceBeyondNone,
  };
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Higher = more focused on evidence/proof. */
export function clarificationEvidenceAffinity(q: ClarificationQuestion): number {
  const blob = fold(
    [q.question_text, q.limbi_detection ?? "", q.why_it_matters, q.referenced_user_answer].join(
      " ",
    ),
  );
  let score = 0;
  if (
    /\b(evidencias?|pruebas?|testimonios?|datos|casos?|encuestas?|cifras?|referencias?)\b/.test(
      blob,
    )
  ) {
    score += 2;
  }
  if (/\b(no_clear_evidence|evidence_types)\b/.test(blob)) score += 1;
  return score;
}

/**
 * Order clarification questions for post-capture deepening:
 * - If audience/problem/benefit signals are thin, surface those before evidence-style questions.
 * - If foundations are already present but evidence is still weak, evidence-style questions may go first.
 */
export function sortClarificationQuestionsEvidenceAware(
  questions: ClarificationQuestion[],
  ctx: StrategicCaptureContextAnalysis,
): ClarificationQuestion[] {
  const needsFoundationWork =
    !ctx.hasAudienceSignal || !ctx.hasProblemSignal || !ctx.hasBenefitSignal;

  if (needsFoundationWork) {
    return [...questions].sort((a, b) => {
      const da = clarificationEvidenceAffinity(a);
      const db = clarificationEvidenceAffinity(b);
      if (da !== db) return da - db;
      return 0;
    });
  }

  if (!ctx.hasEvidenceBeyondNone) {
    return [...questions].sort((a, b) => {
      const da = clarificationEvidenceAffinity(a);
      const db = clarificationEvidenceAffinity(b);
      if (da !== db) return db - da;
      return 0;
    });
  }

  return [...questions];
}

/** @deprecated Use sortClarificationQuestionsEvidenceAware */
export function sortClarificationQuestionsEvidenceLast(
  questions: ClarificationQuestion[],
  ctx: StrategicCaptureContextAnalysis,
): ClarificationQuestion[] {
  return sortClarificationQuestionsEvidenceAware(questions, ctx);
}

export function buildFoundationClarificationQuestion(): ClarificationQuestion {
  return {
    id: "guided_context_foundation_v1",
    limbi_detection:
      "Antes de precisar evidencia o matices finos, conviene alinear el reto con lo que ya quedó registrado.",
    referenced_user_answer:
      "La captura aún no describe con suficiente detalle el núcleo del reto, para quién va dirigido o qué fricción central resuelve.",
    why_it_matters:
      "Sin esa base, priorizar evidencia sería especulativo y debilitaría la Lectura Límbica.",
    question_text:
      "Antes de evaluar evidencia, necesito entender mejor el reto: ¿qué estás construyendo o comunicando, para quién y qué problema busca resolver?",
    allow_free_text: true,
  };
}

function clipToCap<T extends { id: string }>(questions: T[], cap: number): T[] {
  return questions.slice(0, Math.min(Math.max(cap, 0), 5));
}

export function getGuidedIntakeRoundQuestionCap(evaluation: QuestionnaireEvaluationPayload): number {
  if (evaluation.suppress_numeric_quality_score === true) {
    if (evaluation.guided_capture_context_tier === "insufficient") return 1;
    if (evaluation.guided_capture_context_tier === "thin") return 3;
    return 3;
  }
  return getClarificationQuestionCap(evaluation.overall_quality_score);
}

/**
 * Guided first-capture only: suppress misleading numeric scores and reshape
 * clarification questions when the stored base is too thin.
 */
export function applyGuidedStrategicCaptureGuards(
  data: QuestionnaireEvaluationPayload,
  responses: Record<string, unknown>,
): QuestionnaireEvaluationPayload {
  if (!isGuidedStrategicIntakeFirstCaptureComplete(responses)) {
    return { ...data };
  }

  const ctx = analyzeStrategicCaptureContext(responses);
  if (ctx.tier === "adequate") {
    if (!isGuidedStrategicIntakeFirstCaptureComplete(responses)) {
      return { ...data };
    }
    return {
      ...data,
      clarification_questions: sortClarificationQuestionsEvidenceAware(
        [...data.clarification_questions],
        ctx,
      ),
    };
  }

  if (ctx.tier === "insufficient") {
    return {
      ...data,
      overall_quality_score: 0,
      recommended_next_action: "ask_clarifications",
      clarification_questions: [buildFoundationClarificationQuestion()],
      suppress_numeric_quality_score: true,
      guided_capture_context_tier: "insufficient",
    };
  }

  const sorted = sortClarificationQuestionsEvidenceAware(
    [...data.clarification_questions],
    ctx,
  );

  return {
    ...data,
    overall_quality_score: 0,
    clarification_questions: sorted,
    suppress_numeric_quality_score: true,
    guided_capture_context_tier: "thin",
  };
}

export function clipClarificationQuestionsToRoundCap<T extends { id: string }>(
  questions: T[],
  evaluation: QuestionnaireEvaluationPayload,
): T[] {
  return clipToCap(questions, getGuidedIntakeRoundQuestionCap(evaluation));
}
