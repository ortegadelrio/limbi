/** Aviso visible al usuario cuando la Base de Marca activa cambió respecto a la sesión congelada. */
export const BRAND_BASE_UPDATED_SESSION_NOTICE_ES =
  "La Base de Marca fue actualizada. Desde ahora usaré esa nueva información como contexto, sin cambiar las ideas ni decisiones que ya trabajamos en esta sesión.";

export function assistantMessageAlreadyIncludesBrandBaseUpdateNotice(
  messages: readonly { role: string; content: string }[],
): boolean {
  return messages.some(
    (m) =>
      m.role === "assistant" &&
      m.content.includes(BRAND_BASE_UPDATED_SESSION_NOTICE_ES),
  );
}
