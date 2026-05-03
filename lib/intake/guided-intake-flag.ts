/**
 * Phase 1 pilot: Entrevista Límbica Guiada (solo módulo oferta).
 * `NEXT_PUBLIC_*` is available on client and server (inlined at build for client).
 */
export function isGuidedIntakePilotEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_LIMBI_GUIDED_INTAKE_ENABLED?.trim() === "true"
  );
}

/** URL flag to open the pilot (`?guided=1`). Requires env flag true. */
export function shouldShowGuidedIntakePilotFromSearchParams(
  guidedParam: string | null,
): boolean {
  if (!isGuidedIntakePilotEnabled()) return false;
  const g = guidedParam?.trim();
  return g === "1" || g === "true";
}
