/**
 * Lightweight checks for generic chatbot phrasing in interviewer-facing copy.
 * Used in tests and optional CI guards; the model is steered primarily via prompts.
 */
export const GENERIC_LIMBI_PHRASE_PATTERNS: RegExp[] = [
  /\bsuena muy útil\b/i,
  /\bes genial\b/i,
  /\bqué interesante\b/i,
  /\bme encanta\b/i,
  /\b¿te gustaría profundizar/i,
  /\b¿hay algún aspecto específico/i,
  /\b¿hay algo más que quieras agregar\b/i,
  /\bcuéntame más\b/i,
];

export function interviewerCopyContainsGenericPhrases(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return GENERIC_LIMBI_PHRASE_PATTERNS.some((re) => re.test(t));
}
