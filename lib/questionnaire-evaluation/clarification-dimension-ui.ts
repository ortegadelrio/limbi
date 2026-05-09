import type { ClarificationChipQuestionKind } from "@/lib/questionnaire-evaluation/clarification-chip-sanitize";

/** User-facing section line above each clarification question. */
export function clarificationDimensionHeadline(kind: ClarificationChipQuestionKind): string {
  switch (kind) {
    case "evidence":
      return "Estamos afinando: Evidencia";
    case "audience":
      return "Estamos afinando: Audiencia";
    case "differentiation_product":
      return "Estamos afinando: Diferencial";
    case "tone":
      return "Estamos afinando: Tono";
    case "challenge_friction":
      return "Estamos afinando: Reto";
    case "transformation_experience":
    case "transformation_wellness":
      return "Estamos afinando: Beneficio";
    default:
      return "Estamos afinando: Narrativa estratégica";
  }
}

/** Short guidance under the headline when the gap is about evidence. */
export const CLARIFICATION_EVIDENCE_GUIDANCE_ES =
  "Necesito pruebas que sostengan lo que quieres afirmar: trayectoria, casos, cifras, testimonios, clientes, aliados o resultados.";

export type ProvisionalQualityLevel = "bajo" | "medio" | "alto";

export function provisionalQualityLevelFromScore(score: number): ProvisionalQualityLevel {
  if (score < 45) return "bajo";
  if (score < 75) return "medio";
  return "alto";
}

export function provisionalQualityLevelLabelEs(level: ProvisionalQualityLevel): string {
  switch (level) {
    case "bajo":
      return "Bajo";
    case "medio":
      return "Medio";
    case "alto":
      return "Alto";
  }
}
