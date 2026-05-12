import type { BrandQuestionSectionGroup } from "@/lib/questions/get-brand-question-definitions";

/** Orden fijo del journey de marca (Ticket C). */
export const BRAND_QUESTIONNAIRE_SECTION_ORDER = [
  "identity",
  "offer",
  "value_proposition",
  "audiences",
  "differentiation",
  "voice_tone_messages",
  "evidence",
  "restrictions",
  "brand_limbic_base",
  "material_context",
] as const;

/**
 * Construye la lista de secciones para shell + navegación: inserta Oferta y Material,
 * y marca flags para bloques custom.
 */
export function buildBrandQuestionnaireShellSections(
  definitionGroups: BrandQuestionSectionGroup[],
): BrandQuestionSectionGroup[] {
  const byKey = new Map(
    definitionGroups.map((g) => [g.section_key, g] as const),
  );
  const out: BrandQuestionSectionGroup[] = [];

  for (const key of BRAND_QUESTIONNAIRE_SECTION_ORDER) {
    if (key === "offer") {
      out.push({
        section_key: "offer",
        questions: [],
        isOfferInventory: true,
        navCount: 0,
      });
      continue;
    }
    if (key === "material_context") {
      out.push({
        section_key: "material_context",
        questions: [],
        isMaterialContext: true,
        navCount: 0,
      });
      continue;
    }

    const g = byKey.get(key);
    if (!g?.questions.length) continue;

    const navCount = g.questions.length;
    if (key === "identity") {
      out.push({
        ...g,
        showOfferNaturePicker: true,
        navCount,
      });
    } else if (key === "audiences") {
      out.push({
        ...g,
        showTerritoriesBlock: true,
        navCount,
      });
    } else {
      out.push({ ...g, navCount });
    }
  }

  return out;
}
