import type { ValidatedBrandAnswerValue } from "@/lib/brand-answers/validate-answer-value";

/** Texto plano opcional para búsqueda / listados a partir del valor validado. */
export function answerTextFromValidatedValue(
  value: ValidatedBrandAnswerValue,
): string | null {
  if ("text" in value) {
    const t = value.text.trim();
    return t.length > 0 ? value.text : null;
  }
  if ("values" in value) {
    return value.values.length > 0 ? value.values.join(", ") : null;
  }
  if ("value" in value) {
    const v = value.value;
    if (typeof v === "string") return v.trim() ? v : null;
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : null;
    if (typeof v === "boolean") return v ? "sí" : "no";
  }
  return null;
}
