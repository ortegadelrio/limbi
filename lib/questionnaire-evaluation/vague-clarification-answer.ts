const VAGUE_TOKENS = new Set([
  "experiencia",
  "confianza",
  "calma",
  "calidad",
  "servicio",
  "no se",
  "no sé",
  "nose",
  "no lo se",
  "no lo sé",
  "depende",
  "todo",
  "varias",
  "algunas",
  "mucho",
  "poco",
]);

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9áéíóúüñ]/gi, ""))
    .filter(Boolean);
}

/**
 * Respuesta demasiado genérica para generar la Lectura con precisión (texto libre u opción + texto corto).
 */
export function isVagueClarificationAnswerText(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length === 0) return true;
  if (t.length < 12) {
    const words = normalizeWords(t);
    if (words.length <= 1 && words[0] && VAGUE_TOKENS.has(words[0])) return true;
    if (words.length <= 2 && words.every((w) => VAGUE_TOKENS.has(w) || w.length <= 4))
      return true;
  }
  const wf = wordsFromPhrase(t);
  if (
    wf.length > 0 &&
    wf.every((w) => VAGUE_TOKENS.has(w)) &&
    t.length < 40
  ) {
    return true;
  }
  return false;
}

function wordsFromPhrase(t: string): string[] {
  return normalizeWords(t);
}
