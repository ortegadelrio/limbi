import type { ValidatedBrandAnswerValue } from "@/lib/brand-answers/validate-answer-value";

/** Texto plano opcional para búsqueda / listados a partir del valor validado. */
export function answerTextFromValidatedValue(
  value: ValidatedBrandAnswerValue,
): string | null {
  if ("text" in value) {
    const t = value.text.trim();
    return t.length > 0 ? value.text : null;
  }
  if ("values" in value && Array.isArray(value.values)) {
    const parts = [...value.values];
    if ("other_text" in value && typeof value.other_text === "string") {
      const ot = value.other_text.trim();
      if (ot.length > 0) parts.push(`Otro: ${ot}`);
    }
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if ("value" in value) {
    const v = value.value;
    if (typeof v === "string") return v.trim() ? v : null;
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : null;
    if (typeof v === "boolean") return v ? "sí" : "no";
  }
  return null;
}
