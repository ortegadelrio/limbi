/**
 * Deep merge para objetos JSON planos usados en `responses`.
 * - Objetos planos: merge recursivo.
 * - Arrays: el valor del patch sustituye por completo (no merge de items).
 * - Primitivos, null, fechas, etc.: el patch sustituye.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function deepMergeResponses(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(patch)) {
    const pVal = patch[key];
    const bVal = out[key];
    if (Array.isArray(pVal)) {
      out[key] = pVal;
    } else if (isPlainObject(pVal) && isPlainObject(bVal)) {
      out[key] = deepMergeResponses(
        bVal as Record<string, unknown>,
        pVal as Record<string, unknown>,
      );
    } else {
      out[key] = pVal;
    }
  }
  return out;
}
