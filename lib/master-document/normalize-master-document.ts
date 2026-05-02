/**
 * Límites transversales de Limbi sobre uso literal de señales simbólicas.
 * No inventan datos del proyecto; solo fijan reglas de interpretación.
 */
export const DEFAULT_LIMBIC_LITERAL_USAGE_LIMITS: readonly string[] = [
  "No uses las señales simbólicas como objetos literales del contenido salvo que el contexto del proyecto lo justifique explícitamente.",
  "Interpreta colores, imágenes, atmósferas y sensaciones como señales de tono, energía, ritmo y campo emocional.",
  "No conviertas las imágenes o metáforas seleccionadas por el usuario en decoración textual obligatoria.",
  "Usa la base sensible como orientación narrativa, no como banco de palabras.",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Si `limbic_base` es un objeto pero `literal_usage_limits` falta, tiene tipo
 * incorrecto, está vacío o contiene strings vacíos, lo sustituye por
 * {@link DEFAULT_LIMBIC_LITERAL_USAGE_LIMITS}.
 */
export function ensureLimbicLiteralUsageLimits(
  parsed: Record<string, unknown>,
): { applied: boolean } {
  if (!isPlainObject(parsed.limbic_base)) {
    return { applied: false };
  }
  const lb = parsed.limbic_base as Record<string, unknown>;
  const lim = lb.literal_usage_limits;

  let needsDefault = false;
  if (!("literal_usage_limits" in lb)) {
    needsDefault = true;
  } else if (!Array.isArray(lim)) {
    needsDefault = true;
  } else if (lim.length === 0) {
    needsDefault = true;
  } else {
    const allValid = lim.every(
      (el) => typeof el === "string" && el.trim().length > 0,
    );
    if (!allValid) {
      needsDefault = true;
    }
  }

  if (!needsDefault) {
    return { applied: false };
  }

  lb.literal_usage_limits = [...DEFAULT_LIMBIC_LITERAL_USAGE_LIMITS];
  return { applied: true };
}

/**
 * Normalización segura antes de `validateMasterDocumentRecord`.
 * Solo completa reglas transversales del sistema (no datos del proyecto).
 */
export function normalizeMasterDocumentBeforeValidation(
  parsed: Record<string, unknown>,
): { limbic_literal_limits_applied: boolean } {
  const { applied } = ensureLimbicLiteralUsageLimits(parsed);
  return { limbic_literal_limits_applied: applied };
}
