import type {
  BrandOfferNature,
  QuestionDefinitionAppliesTo,
  QuestionDefinitionRow,
} from "@/types/database";

export type BrandQuestionSectionGroup = {
  section_key: string;
  questions: QuestionDefinitionRow[];
};

/** Filtra filas del catálogo según `offer_nature` (núcleo + `applies_to` coincidente). */
export function brandQuestionDefinitionsForOfferNature(
  rows: QuestionDefinitionRow[],
  offerNature: BrandOfferNature,
): QuestionDefinitionRow[] {
  return rows.filter((r) => appliesToOfferNature(r.applies_to, offerNature));
}

export function appliesToOfferNature(
  appliesTo: QuestionDefinitionAppliesTo,
  offerNature: BrandOfferNature,
): boolean {
  if (appliesTo == null) return true;
  const list = appliesTo.offer_natures;
  return Array.isArray(list) && list.includes(offerNature);
}

/**
 * Agrupa por `section_key` conservando el orden global de `display_order`
 * (primera aparición de una sección define su posición en la lista).
 */
export function groupBrandQuestionDefinitionsBySection(
  rows: QuestionDefinitionRow[],
): BrandQuestionSectionGroup[] {
  const sorted = [...rows].sort((a, b) => a.display_order - b.display_order);
  const sectionOrder: string[] = [];
  const bySection = new Map<string, QuestionDefinitionRow[]>();

  for (const row of sorted) {
    let list = bySection.get(row.section_key);
    if (!list) {
      list = [];
      bySection.set(row.section_key, list);
      sectionOrder.push(row.section_key);
    }
    list.push(row);
  }

  return sectionOrder.map((section_key) => ({
    section_key,
    questions: bySection.get(section_key) ?? [],
  }));
}
