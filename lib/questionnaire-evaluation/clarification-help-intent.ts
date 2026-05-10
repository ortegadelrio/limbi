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

/** Matches advisory asks that may appear inside a longer draft (mixed answer). */
const EMBEDDED_HELP_PATTERNS: RegExp[] = [
  /\bsi\s+me\s+recomiendas\b/i,
  /\bme\s+recomiendas\b/i,
  /\bme\s+recomendar[ií]as\b/i,
  /\brecibo\s+sugerencias\b/i,
  /\babro\s+la\s+puerta\s+a\s+sugerencias\b/i,
  /\bqué\s+opinas\b/i,
  /\bque\s+opinas\b/i,
];

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
  /\bcómo\s+respondo\s+esto\b/i,
  /\bcomo\s+respondo\s+esto\b/i,
  /\bexplicame\b/i,
  /\bexplícame\b/i,
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

/**
 * True if the full draft (possibly several sentences) asks Limbi for advice
 * somewhere in the text — used to detect mixed “answer + meta” drafts.
 */
export function rawTextContainsHelpRequest(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return false;
  for (const re of [...HELP_PATTERNS, ...EMBEDDED_HELP_PATTERNS]) {
    if (re.test(t)) return true;
  }
  return false;
}

/**
 * Strips help-only or meta lines so advisory chat is never persisted as a
 * clarification answer. Keeps substantive lines (e.g. facts after a coach turn).
 */
export function sanitizeClarificationSubmitFreeText(raw: string): string {
  const t = raw.trim();
  if (t.length === 0) return "";
  const lines = raw.split(/\n/);
  const kept: string[] = [];
  for (const line of lines) {
    const s = line.trim();
    if (s.length === 0) continue;
    if (isClarificationHelpSeekingUserMessage(s)) continue;
    kept.push(s);
  }
  return kept.join("\n").trim();
}

const MIXED_SUBSTANTIVE_MIN_CHARS = 18;

/**
 * Substantive clarification text remains after stripping help-only lines, but
 * the raw draft still asks for advisory help somewhere.
 */
export function isMixedClarificationDraft(raw: string): boolean {
  const t = raw.trim();
  if (t.length === 0) return false;
  const cleaned = sanitizeClarificationSubmitFreeText(t);
  if (cleaned.length < MIXED_SUBSTANTIVE_MIN_CHARS) return false;
  return rawTextContainsHelpRequest(t);
}
