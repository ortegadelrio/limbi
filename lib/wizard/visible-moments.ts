/**
 * Visible “moments” are a UI grouping only. Persistence still uses
 * `WIZARD_STEP_ORDER` / `WizardStepId` in `completed_steps` and the same
 * response paths as before.
 */

import {
  WIZARD_STEP_ORDER,
  type WizardStepId,
} from "@/lib/constants/wizard";

/** Stable ids for analytics / UI only — never write these to `completed_steps`. */
export const VISIBLE_MOMENT_IDS = [
  "moment_starting_point",
  "moment_context_challenge",
  "moment_offering_purpose",
  "moment_audience",
  "moment_tension",
  "moment_evidence_limits",
  "moment_limbic_pulse",
  "moment_voice_personality",
] as const;

export type VisibleMomentId = (typeof VISIBLE_MOMENT_IDS)[number];

export const VISIBLE_MOMENT_COUNT = VISIBLE_MOMENT_IDS.length;

/** Wizard step indices (into `WIZARD_STEP_ORDER`) grouped per visible moment. */
export const WIZARD_STEP_INDICES_BY_MOMENT: readonly (readonly number[])[] = [
  [0, 2], // project_identity, main_challenge (reordered vs legacy linear UI)
  [1], // challenge_type (+ challenge_context payload)
  [3, 4, 5],
  [6, 7, 8, 9],
  [10, 11],
  [12, 13],
  [14, 15, 16, 17, 18],
  [19, 20, 21],
] as const;

export const VISIBLE_MOMENT_TITLES: Record<VisibleMomentId, string> = {
  moment_starting_point: "Punto de partida",
  moment_context_challenge: "Contexto, antecedentes y reto real",
  moment_offering_purpose: "Lo que ofreces y para qué sirve",
  moment_audience: "A quién necesitas mover",
  moment_tension: "La tensión que hay que resolver",
  moment_evidence_limits: "Data, evidencia y límites de afirmación",
  moment_limbic_pulse: "Pulso límbico",
  moment_voice_personality: "Voz y personalidad",
};

/** Short line under the title (strategy-first copy). */
export const VISIBLE_MOMENT_PURPOSES: Record<VisibleMomentId, string> = {
  moment_starting_point:
    "Nombre del sistema y foco del reto de comunicación — el para qué empieza aquí.",
  moment_context_challenge:
    "Tipo de reto, narrativa y antecedentes que Limbi debe entender antes de estrategizar.",
  moment_offering_purpose:
    "Qué es lo que comunicas, qué problema aborda y qué transformación prometes.",
  moment_audience:
    "Protagonista: tu audiencia. Estado emocional hoy, deseado y la acción que buscas.",
  moment_tension:
    "Por qué importa ahora y la tensión interna a resolver — no es copy automático.",
  moment_evidence_limits:
    "Qué prueba existe, qué contexto pegas y hasta dónde podemos afirmar sin inventar.",
  moment_limbic_pulse:
    "Señales simbólicas y sensoriales — Limbi las interpreta, no las copia literal.",
  moment_voice_personality:
    "Personalidad de comunicación: deseada, evitada y comparaciones simbólicas.",
};

/** visibleMomentId → canonical wizard step ids (same order as `WIZARD_STEP_ORDER` references). */
export function wizardStepIdsForVisibleMoment(
  momentId: VisibleMomentId,
): readonly WizardStepId[] {
  const idx = VISIBLE_MOMENT_IDS.indexOf(momentId);
  if (idx < 0) return [];
  return WIZARD_STEP_INDICES_BY_MOMENT[idx].map((i) => WIZARD_STEP_ORDER[i]);
}

export function visibleMomentIdForWizardStepIndex(
  stepIndex: number,
): VisibleMomentId | null {
  for (let m = 0; m < WIZARD_STEP_INDICES_BY_MOMENT.length; m++) {
    if (WIZARD_STEP_INDICES_BY_MOMENT[m].includes(stepIndex)) {
      return VISIBLE_MOMENT_IDS[m];
    }
  }
  return null;
}

export function visibleMomentIndexForWizardStepIndex(
  stepIndex: number,
): number {
  for (let m = 0; m < WIZARD_STEP_INDICES_BY_MOMENT.length; m++) {
    if (WIZARD_STEP_INDICES_BY_MOMENT[m].includes(stepIndex)) return m;
  }
  return 0;
}

const MOMENT_REQUIRED_STEP_IDS: readonly (readonly WizardStepId[])[] =
  WIZARD_STEP_INDICES_BY_MOMENT.map((indices) =>
    indices.map((i) => WIZARD_STEP_ORDER[i]),
  );

/** First moment (0–7) that still misses a required wizard step id. */
export function firstIncompleteVisibleMomentIndex(
  completed: readonly string[],
): number {
  for (let m = 0; m < MOMENT_REQUIRED_STEP_IDS.length; m++) {
    for (const id of MOMENT_REQUIRED_STEP_IDS[m]) {
      if (!completed.includes(id)) return m;
    }
  }
  return VISIBLE_MOMENT_COUNT;
}

export function allQuestionnaireMomentsComplete(
  completed: readonly string[],
): boolean {
  return firstIncompleteVisibleMomentIndex(completed) >= VISIBLE_MOMENT_COUNT;
}

export function shouldShowReviewStep(
  completed: readonly string[],
): boolean {
  return (
    allQuestionnaireMomentsComplete(completed) &&
    !completed.includes("review_before_generation")
  );
}

function orderedUniqueWizardSteps(ids: Set<string>): string[] {
  return WIZARD_STEP_ORDER.filter((s) => ids.has(s));
}

function mergeCompletedStepWithExisting(
  existing: readonly string[],
  stepId: WizardStepId,
): string[] {
  const next = new Set(existing);
  next.add(stepId);
  return orderedUniqueWizardSteps(next);
}

/**
 * After saving one or more wizard steps in a single moment, merge their ids
 * into `completed_steps`. Replaces linear `completedPrefix` for grouped saves
 * while staying compatible with `firstIncompleteStep` / hydration.
 */
export function mergeCompletedStepsForWizardStepIndices(
  serverCompleted: readonly string[],
  stepIndices: readonly number[],
  options: { returnTo: string | null },
): string[] {
  const returnTo = options.returnTo;
  const editReturn = returnTo === "review" || returnTo === "project";
  const hadReviewBeforeGeneration = serverCompleted.includes(
    "review_before_generation",
  );

  let next = [...serverCompleted];
  const sorted = [...stepIndices].sort((a, b) => a - b);

  if (editReturn || hadReviewBeforeGeneration) {
    for (const idx of sorted) {
      const stepId = WIZARD_STEP_ORDER[idx];
      if (stepId) {
        next = mergeCompletedStepWithExisting(next, stepId);
      }
    }
    return next;
  }

  for (const idx of sorted) {
    const stepId = WIZARD_STEP_ORDER[idx];
    if (stepId) {
      next = mergeCompletedStepWithExisting(next, stepId);
    }
  }
  return next;
}
