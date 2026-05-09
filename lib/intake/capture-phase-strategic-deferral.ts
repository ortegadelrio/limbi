/**
 * Guided Intake V1 — capture first, diagnose later.
 * Shown on `main` phase when the user asks for real-time strategy (recommendations,
 * validation, doubt, or open “how should I answer”) instead of substantive field data.
 */

export const CAPTURE_PHASE_STRATEGIC_DEFERRAL_CORE_ES =
  "Todavía no es el momento de recomendar. Primero necesito recoger la información completa y luego te haré un diagnóstico con mis recomendaciones. Por ahora dime qué actores, datos o ideas tienes identificados.";

export const CAPTURE_PHASE_STRATEGIC_DEFERRAL_EXAMPLES_ES =
  "Por ejemplo, puedes mencionar quién compra, quién usa, quién autoriza, quién recomienda o quién puede bloquear la decisión.";

export function buildCapturePhaseStrategicDeferralInterviewerMessage(): string {
  return `${CAPTURE_PHASE_STRATEGIC_DEFERRAL_CORE_ES}\n\n${CAPTURE_PHASE_STRATEGIC_DEFERRAL_EXAMPLES_ES}`.trim();
}
