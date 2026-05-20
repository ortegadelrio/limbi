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
  /\bobligaci[oó]n\b/i,
  /\bel\s+sistema\b/i,
  /\binterno\b/i,
  /\bfallback\b/i,
  /\bintent\b/i,
  /\bmodelo\s+de\s+pensamiento\b/i,
  /\bexplica\s+el\s+efecto\s+deseado\b/i,
  /\bavanzar[ií]a\s+en\s+prosa\b/i,
  /\bsigo\s+anclado\b/i,
];

export function assistantMessageHasVisibleLeaks(message: string): boolean {
  const t = message.trim();
  if (!t) return true;
  return ASSISTANT_VISIBLE_FORBIDDEN_PATTERNS.some((p) => p.test(t));
}

export function findVisibleLeakIssues(message: string): string[] {
  const issues: string[] = [];
  for (const p of ASSISTANT_VISIBLE_FORBIDDEN_PATTERNS) {
    if (p.test(message)) {
      issues.push(`Lenguaje interno/meta visible: ${p.source}`);
    }
  }
  return issues;
}
