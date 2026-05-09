import type { StrategicInterviewPilotSummary } from "@/lib/intake/strategic-interview-summary";

/**
 * Dev/test-only: jump Guided Intake to the first-capture completion UI without
 * finishing the interview. Never active when `NODE_ENV === "production"`.
 */
export function isGuidedIntakeDebugCompleteShortcutCore(params: {
  nodeEnv: string | undefined;
  guidedPilotEnabled: boolean;
  guidedParam: string | null;
  debugCompleteParam: string | null;
}): boolean {
  if (params.nodeEnv === "production") return false;
  if (!params.guidedPilotEnabled) return false;
  const g = params.guidedParam?.trim();
  if (g !== "1" && g !== "true") return false;
  const d = params.debugCompleteParam?.trim();
  return d === "1" || d === "true";
}

export function isGuidedIntakeDebugCompleteShortcut(params: {
  guidedPilotEnabled: boolean;
  guidedParam: string | null;
  debugCompleteParam: string | null;
}): boolean {
  return isGuidedIntakeDebugCompleteShortcutCore({
    nodeEnv: process.env.NODE_ENV,
    guidedPilotEnabled: params.guidedPilotEnabled,
    guidedParam: params.guidedParam,
    debugCompleteParam: params.debugCompleteParam,
  });
}

/** Minimal summary that matches the diagnostic preview detector and shows the completion card. */
export function guidedIntakeDebugCompletionSummaryFixture(): StrategicInterviewPilotSummary {
  return {
    title: "Completamos la primera captura del reto.",
    body:
      "Vista previa diagnóstica.\n\n1. Lo que entendí\n\n(Vista de prueba en entorno no productivo; el diagnóstico usará los datos guardados del proyecto.)",
    weakLine: null,
  };
}
