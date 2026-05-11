/**
 * Normaliza el sitio web para marcas (y futuros campos similares).
 * Si no hay protocolo, antepone https:// antes de validar o guardar.
 */
export function normalizeWebsiteUrl(value: string): string {
  const t = value.trim();
  if (t.length === 0) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function isValidHttpUrl(normalized: string): boolean {
  if (!normalized) return false;
  try {
    const u = new URL(normalized);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return Boolean(u.hostname && u.hostname.length > 0);
  } catch {
    return false;
  }
}
