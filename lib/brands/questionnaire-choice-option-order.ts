import type { QuestionOption } from "@/types/database";

/** Orden UX (Ticket C.1); los `value` coinciden con el seed de `question_definitions`. */
const AUDIENCE_GENDERS_ORDER = [
  "all_genders",
  "women",
  "men",
  "non_binary",
  "not_segmented",
] as const;

const AUDIENCE_COMMUNITIES_ORDER = [
  "none_specific",
  "afro",
  "indigenous",
  "migrants",
  "latinos_us",
  "lgbtq",
  "disability",
  "older_adults",
  "youth",
  "entrepreneurs",
  "parents_families",
  "students",
  "professionals",
  "other",
] as const;

/**
 * Reordena opciones de multi/single choice solo en UI (no cambia `value` ni seed).
 */
export function orderedOptionsForQuestionnaireUi(
  questionKey: string,
  options: QuestionOption[],
): QuestionOption[] {
  if (options.length === 0) return options;
  const order: readonly string[] | null =
    questionKey === "audience_genders"
      ? AUDIENCE_GENDERS_ORDER
      : questionKey === "audience_communities"
        ? AUDIENCE_COMMUNITIES_ORDER
        : null;
  if (!order) return options;

  const index = new Map(order.map((v, i) => [v, i]));
  return [...options].sort((a, b) => {
    const ia = index.get(a.value) ?? 999;
    const ib = index.get(b.value) ?? 999;
    if (ia !== ib) return ia - ib;
    return a.label.localeCompare(b.label, "es");
  });
}
