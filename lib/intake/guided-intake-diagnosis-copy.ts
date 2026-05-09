/** Copy for connecting guided intake first capture to questionnaire evaluation. */
export const GUIDED_INTAKE_DIAGNOSIS_PRIMARY_CTA_ES = "Hacer diagnóstico inicial";
export const GUIDED_INTAKE_DIAGNOSIS_SECONDARY_CTA_ES =
  "Revisar calidad de la información";

export function guidedIntakeEvaluateQuestionnaireUrl(projectId: string): string {
  return `/api/projects/${projectId}/evaluate-questionnaire`;
}

export function guidedIntakeQuestionnaireClarifyPath(projectId: string): string {
  return `/projects/${projectId}/questionnaire-clarify`;
}
