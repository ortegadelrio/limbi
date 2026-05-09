/**
 * Detects when the user is asking for strategic help during post-capture
 * clarification instead of answering the question.
 */

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

const HELP_PATTERNS: RegExp[] = [
  /\bno\s+entiendo\b/i,
  /\bque\s+me\s+recomiendas\b/i,
  /\bqué\s+me\s+recomiendas\b/i,
  /\bque\s+podria\s+poner\b/i,
  /\bqué\s+podría\s+poner\b/i,
  /\bque\s+podria\s+decir\b/i,
  /\bqué\s+podría\s+decir\b/i,
  /\bdame\s+ejemplos?\b/i,
  /\bun\s+ejemplo\b/i,
  /\bayudame\b/i,
  /\bayúdame\b/i,
  /\bayuda\b/i,
  /\bno\s+se\s+que\s+responder\b/i,
  /\bno\s+sé\s+qué\s+responder\b/i,
  /\bno\s+se\s+que\s+contestar\b/i,
  /\bno\s+sé\s+qué\s+contestar\b/i,
  /\bno\s+se\s+que\s+poner\b/i,
  /\bno\s+sé\s+qué\s+poner\b/i,
  /\bcomo\s+respondo\b/i,
  /\bcómo\s+respondo\b/i,
  /\bque\s+hago\b/i,
  /\bqué\s+hago\b/i,
];

/**
 * True when the free-text line is clearly a meta-question / help ask, not an
 * attempt to answer the clarification prompt.
 */
export function isClarificationHelpSeekingUserMessage(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return false;
  const f = fold(t);
  if (f.length < 4) return false;
  for (const re of HELP_PATTERNS) {
    if (re.test(t)) return true;
  }
  return false;
}
