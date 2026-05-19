/** Claves de diagnóstico/base → sección del cuestionario (`?section=`). */
const DIAGNOSIS_SECTION_TO_QUESTIONNAIRE: Record<string, string> = {
  differentiators: "differentiation",
  voice_tone: "voice_tone_messages",
  audience: "audiences",
  proof: "evidence",
  credibility: "evidence",
};

export function questionnaireSectionKeyFromDiagnosisSection(
  diagnosisSectionKey: string,
): string {
  return DIAGNOSIS_SECTION_TO_QUESTIONNAIRE[diagnosisSectionKey] ?? diagnosisSectionKey;
}

export function brandQuestionnaireSectionHref(
  brandId: string,
  diagnosisSectionKey: string,
): string {
  const sectionKey = questionnaireSectionKeyFromDiagnosisSection(diagnosisSectionKey);
  return `/brands/${brandId}/questionnaire?section=${encodeURIComponent(sectionKey)}`;
}

export function brandQuestionnaireHref(brandId: string): string {
  return `/brands/${brandId}/questionnaire`;
}

export const BRAND_DIAGNOSIS_QUESTIONNAIRE_GUIDANCE_ES =
  "El diagnóstico te muestra qué secciones pueden mejorar. Para hacer cambios, vuelve al cuestionario: allí puedes editar respuestas y usar «Mejorar con Limbi» en los campos de texto.";
