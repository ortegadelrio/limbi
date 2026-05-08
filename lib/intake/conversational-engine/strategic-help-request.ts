/**
 * User seeks strategic help, framing, or how-to answer — not a substantive field answer.
 * Spanish-first, pattern-based (no domain-specific nouns).
 */
const STRATEGIC_HELP_OR_HOW_RES: RegExp[] = [
  /\bno s[eé] c[oó]mo\b/i,
  /\bno se como\b/i,
  /\bno s[eé] (hacerlo|contestar|responder|definirlo|plantearlo)\b/i,
  /\bno se (hacerlo|contestar|responder|definirlo|plantearlo)\b/i,
  /\bay[uú]dame\b/i,
  /\bque me ayudes\b/i,
  /\bquiero que me ayud/i,
  /\bnecesito (tu )?ayuda\b/i,
  /\bay[uú]dame a definir\b/i,
  /\bno s[eé] qu[eé] responder\b/i,
  /\bno se que responder\b/i,
  /\b¿?a qui[eé]n deber[ií]a\b/i,
  /\b¿?cu[aá]l ser[ií]a mejor\b/i,
  /\b¿?qu[eé] har[ií]as t[uú]\b/i,
  /\bno lo s[eé] hacer\b/i,
  /\borienta(r|me)\b/i,
  /\bgu[ií]ame\b/i,
];

export function detectStrategicHelpOrHowToRequest(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 5) return false;
  return STRATEGIC_HELP_OR_HOW_RES.some((re) => re.test(t));
}
