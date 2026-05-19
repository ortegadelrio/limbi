import type { BrandResponseAnswerType } from "@/types/database";

/** Tipos de pregunta con mejora asistida campo a campo (texto libre). */
export const BRAND_FIELD_IMPROVE_ANSWER_TYPES = new Set<BrandResponseAnswerType>([
  "text",
  "textarea",
  "url",
]);

export function canShowLimbiFieldImprove(args: {
  hasActiveDiagnosis: boolean;
  answerType: BrandResponseAnswerType | string;
  sectionKey: string;
}): boolean {
  if (!args.hasActiveDiagnosis) return false;
  if (args.sectionKey === "material_context") return false;
  return BRAND_FIELD_IMPROVE_ANSWER_TYPES.has(args.answerType as BrandResponseAnswerType);
}

export const BRAND_FIELD_IMPROVE_BEFORE_DIAGNOSIS_HINT_ES =
  "Cuando completes el cuestionario y Limbi genere el primer diagnóstico, podrás usar «Mejorar con Limbi» en cada respuesta con contexto de toda la marca.";
