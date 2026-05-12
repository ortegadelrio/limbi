/**
 * Etiquetas legibles para UI a partir de `question_definitions.question_text`.
 * No exponer `question_key` crudo al usuario final.
 */

export type QuestionDefLike = {
  question_key: string;
  question_text: string;
};

/** Primera oración corta o recorte hasta ~100 caracteres como “etiqueta corta”. */
export function shortQuestionLabelFromText(questionText: string): string {
  const t = questionText.trim();
  if (!t) return "";
  const m = t.match(/^(.{10,120}?[.!?])(\s|$)/);
  if (m?.[1]) return m[1].trim();
  if (t.length <= 100) return t;
  return `${t.slice(0, 97).trim()}…`;
}

export function buildQuestionKeyDisplayLabelMap(defs: QuestionDefLike[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of defs) {
    const short = shortQuestionLabelFromText(d.question_text);
    map.set(d.question_key, short.length > 0 ? short : d.question_text.trim());
  }
  return map;
}

/** Etiqueta para UI: preferencia por label corto derivado; si no hay definición, fallback sin crudo snake_case visible. */
export function displayLabelForQuestionKey(
  questionKey: string,
  map: Map<string, string>,
  fallbackQuestionText?: string,
): string {
  const fromMap = map.get(questionKey);
  if (fromMap?.trim()) return fromMap.trim();
  const fromFallback = fallbackQuestionText?.trim();
  if (fromFallback) return shortQuestionLabelFromText(fromFallback) || fromFallback;
  return "Pregunta de la sección";
}
