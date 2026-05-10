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

export type ClarificationBaseBand =
  | "insufficient"
  | "initial"
  | "building"
  | "solid"
  | "strong";

/**
 * Qualitative band for post-diagnosis UI: pulls toward weak pillars so a
 * shallow profile is not labeled “Medio” only from the headline score.
 */
export function clarificationBaseBandFromScore(
  overall: number,
  dimensionScores?: Record<string, number> | null,
): ClarificationBaseBand {
  let adjusted = overall;
  if (dimensionScores && Object.keys(dimensionScores).length > 0) {
    const keys = [
      "audience_definition",
      "evidence_and_claims",
      "strategic_clarity",
    ] as const;
    const vals = keys
      .map((k) => dimensionScores[k])
      .filter((n): n is number => typeof n === "number");
    if (vals.length > 0) {
      const weak = Math.min(...vals);
      adjusted = Math.min(overall, Math.round(weak + (overall - weak) * 0.35));
    }
  }
  if (adjusted < 32) return "insufficient";
  if (adjusted < 48) return "initial";
  if (adjusted < 66) return "building";
  if (adjusted < 82) return "solid";
  return "strong";
}

export function clarificationBaseBandLabelEs(band: ClarificationBaseBand): string {
  switch (band) {
    case "insufficient":
      return "Base insuficiente";
    case "initial":
      return "Base inicial";
    case "building":
      return "Base en construcción";
    case "solid":
      return "Base sólida";
    case "strong":
      return "Base muy fuerte";
  }
}
