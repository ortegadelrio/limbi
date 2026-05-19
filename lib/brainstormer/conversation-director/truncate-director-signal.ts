/** Límite Zod en known_from_brand_base / missing_information (dejar margen). */
export const DIRECTOR_SIGNAL_MAX_CHARS = 480;

/**
 * Trunca una señal para el Conversation Director sin romper validación Zod.
 */
export function truncateDirectorSignal(
  value: string,
  max: number = DIRECTOR_SIGNAL_MAX_CHARS,
): string {
  const clean = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

export function truncateDirectorSignalList(
  values: readonly string[],
  max: number = DIRECTOR_SIGNAL_MAX_CHARS,
): string[] {
  return values.map((v) => truncateDirectorSignal(v, max));
}
