/**
 * Very short affirmation with no referent — not enough to treat as a committed answer
 * to an open strategic question (pattern-based).
 */
export function isBareAffirmationWithoutSubstance(userText: string): boolean {
  const t = userText.trim();
  if (t.length === 0 || t.length > 28) return false;
  return /^(s[ií]|ok|vale|confirmo|exacto|claro|listo)\s*[.!?¡¿,;:\s]*$/iu.test(t);
}
