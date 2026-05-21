/**
 * Filtra lenguaje interno/meta que no debe mostrarse al usuario.
 */

/** Patrones prohibidos en assistant_message visible. */
export const ASSISTANT_VISIBLE_FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bdesde\s+comercial\b/i,
  /\bdesde\s+disruptor\b/i,
  /\bdesde\s+planner\b/i,
  /\bdesde\s+emp[aá]tico\b/i,
  /\bdesde\s+conceptual\b/i,
  /\bdesde\s+limbi\b/i,
  /\btomar[ií]a\s+postura\b/i,
  /\btomar\s+postura\b/i,
  /\bla\s+respuesta\s+debe\b/i,
  /\bdebe\s+incluir\b/i,
  /\bdebe\s+responder\b/i,
  /\bobligaci[oó]n\b/i,
  /\bel\s+sistema\s+debe\b/i,
  /\bel\s+sistema\b/i,
  /\binterno\b/i,
  /\bfallback\b/i,
  /\bintent\b/i,
  /\bmodelo\s+activo\b/i,
  /\bmodelo\s+de\s+pensamiento\b/i,
  /\bquality\s+gate\b/i,
  /\bprompt\b/i,
  /\bvalidaci[oó]n\b/i,
  /\brepair\b/i,
  /\bSUSTITUYE\b/,
  /\bREEMPLAZA\b/,
  /\binstrucci[oó]n\b/i,
  /\bmi\s+recomendaci[oó]n\s+es\s+una\s+direcci[oó]n\s+clara\b/i,
  /\balineada\s+al\s+pedido\s+del\s+usuario\b/i,
  /\bsin\s+clich[eé]s\b/i,
  /\ben\s+prosa\b/i,
  /\brespuesta\s+en\s+prosa\b/i,
  /\banclada\s+en\b/i,
  /\bsigue\s+anclada\s+en\b/i,
  /\bexplica\s+el\s+efecto\s+deseado\b/i,
  /\bavanzar[ií]a\s+en\s+prosa\b/i,
  /\bsigo\s+anclado\b/i,
  /\bdirecci[oó]n\s+clara\s+en\s+prosa\b/i,
  /\bcontinuar\s+conversaci[oó]n\s+estrat[eé]gica\b/i,
  /\byo\s+seguir[ií]a\s+con\s+«[^»]*(entiendo|perdido|no\s+me\s+queda)/i,
  /\bseguir[ií]a\s+con\s+«[^»]*(entiendo|perdido|sigo\s+sin)/i,
  /\bcomo\s+eje:\s*(no\s+entiendo|sigo\s+sin|me\s+perdi)/i,
  /\bparaguas:\s*(no\s+entiendo|sigo\s+sin|me\s+perdi)/i,
  /\beje:\s*[^.]{0,40}(entiendo|perdido)/i,
];

/** Último recurso — siempre pasable como mensaje visible. */
export const ABSOLUTE_SAFE_USER_FACING_MESSAGE =
  "Tienes razón, no fue claro. Antes de piezas o acciones, cerraría el paraguas conceptual: una idea que explique por qué alguien debería prestarle atención a la marca. ¿Te sirve si propongo una dirección concreta ahora?";

export function assistantMessageHasVisibleLeaks(message: string): boolean {
  const t = message.trim();
  if (!t || t.length < 12) return true;
  return ASSISTANT_VISIBLE_FORBIDDEN_PATTERNS.some((p) => p.test(t));
}

export function findVisibleLeakIssues(message: string): string[] {
  const issues: string[] = [];
  for (const p of ASSISTANT_VISIBLE_FORBIDDEN_PATTERNS) {
    if (p.test(message)) {
      issues.push(`Lenguaje interno/meta visible: ${p.source}`);
    }
  }
  if (message.trim().length < 12) {
    issues.push("Respuesta demasiado corta o vacía para mostrar al usuario.");
  }
  return issues;
}

export function isUserFacingAssistantMessage(message: string): boolean {
  return findVisibleLeakIssues(message).length === 0;
}

export type EnsureUserFacingAssistantMessageArgs = {
  message: string;
  buildSafeFallback: () => string;
};

export type EnsureUserFacingAssistantMessageResult = {
  message: string;
  replaced: boolean;
  issues: string[];
  usedAbsoluteSafe: boolean;
};

/**
 * Validación final obligatoria antes de persistir assistant_message.
 * Si la salida parece instrucción interna o placeholder, sustituye por fallback seguro.
 */
export function ensureUserFacingAssistantMessage(
  args: EnsureUserFacingAssistantMessageArgs,
): EnsureUserFacingAssistantMessageResult {
  const trimmed = args.message.trim();
  const issues = findVisibleLeakIssues(trimmed);
  if (issues.length === 0) {
    return { message: trimmed, replaced: false, issues: [], usedAbsoluteSafe: false };
  }

  const fallback = args.buildSafeFallback().trim();
  const fallbackIssues = findVisibleLeakIssues(fallback);
  if (fallbackIssues.length === 0) {
    return {
      message: fallback,
      replaced: true,
      issues,
      usedAbsoluteSafe: false,
    };
  }

  return {
    message: ABSOLUTE_SAFE_USER_FACING_MESSAGE,
    replaced: true,
    issues: [...issues, ...fallbackIssues],
    usedAbsoluteSafe: true,
  };
}
