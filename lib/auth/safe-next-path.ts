/**
 * Evita open redirects: solo rutas relativas internas.
 */
export function safeInternalPath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next;
}
