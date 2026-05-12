import { z } from "zod";

export const BRAND_DIAGNOSIS_PROMPT_VERSION = "brand-diagnosis-v1.3";

export const brandDiagnosisQualityLevelSchema = z.enum([
  "critical",
  "weak",
  "acceptable",
  "strong",
  "excellent",
]);

export const brandDiagnosisNextActionSchema = z.enum([
  "improve_required",
  "improve_recommended",
  "ready_for_consolidation",
]);

export const brandDiagnosisSectionPrioritySchema = z.enum(["high", "medium", "low"]);

const shortStringList = z.array(z.string().max(800)).max(12);

export const brandDiagnosisSectionScoreSchema = z.object({
  section_key: z.string().min(1).max(120),
  section_label: z.string().min(1).max(200),
  score: z.number().int().min(0).max(100),
  quality_level: brandDiagnosisQualityLevelSchema,
  diagnosis: z.string().min(1).max(6000),
  strengths: shortStringList,
  gaps: shortStringList,
  contradictions: shortStringList,
  risks: shortStringList,
  recommendations: shortStringList,
  priority: brandDiagnosisSectionPrioritySchema,
  can_generate_base: z.boolean(),
  should_improve_before_consolidation: z.boolean(),
});

export const brandDiagnosisCriticalGapSchema = z.object({
  section_key: z.string().min(1).max(120),
  gap: z.string().min(1).max(2000),
  why_it_matters: z.string().min(1).max(2000),
});

export const brandDiagnosisContradictionSchema = z.object({
  section_key: z.string().min(1).max(120),
  description: z.string().min(1).max(3000),
  suggested_resolution: z.string().min(1).max(2000),
});

export const brandDiagnosisImprovementItemSchema = z.object({
  section_key: z.string().min(1).max(120),
  priority: brandDiagnosisSectionPrioritySchema,
  recommended_focus: z.string().min(1).max(2000),
});

export const brandDiagnosisRawOutputSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  quality_level: brandDiagnosisQualityLevelSchema,
  strategic_reading: z.string().min(1).max(12000),
  section_scores: z.array(brandDiagnosisSectionScoreSchema).max(40),
  critical_gaps: z.array(brandDiagnosisCriticalGapSchema).max(20),
  contradictions: z.array(brandDiagnosisContradictionSchema).max(20),
  improvement_plan: z.array(brandDiagnosisImprovementItemSchema).max(25),
  next_recommended_action: brandDiagnosisNextActionSchema,
});

export type BrandDiagnosisSectionScoreParsed = z.infer<
  typeof brandDiagnosisSectionScoreSchema
>;
export type BrandDiagnosisRawOutputParsed = z.infer<typeof brandDiagnosisRawOutputSchema>;

/** Deriva quality_level desde score (fuente de verdad servidor). */
export function brandDiagnosisQualityLevelFromScore(score: number): z.infer<
  typeof brandDiagnosisQualityLevelSchema
> {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s <= 39) return "critical";
  if (s <= 59) return "weak";
  if (s <= 74) return "acceptable";
  if (s <= 89) return "strong";
  return "excellent";
}

/** Aplica niveles de calidad desde scores (sobrescribe lo devuelto por la IA). */
export function applyServerDiagnosisQualityLevels(
  parsed: BrandDiagnosisRawOutputParsed,
): BrandDiagnosisRawOutputParsed {
  const hasBlockingContradiction = parsed.contradictions.length > 0;
  const hasCriticalGap = parsed.critical_gaps.length > 0;
  let nextAction = parsed.next_recommended_action;

  if (parsed.overall_score >= 80 && !hasBlockingContradiction && !hasCriticalGap) {
    nextAction = "ready_for_consolidation";
  } else if (parsed.overall_score >= 70 && nextAction === "improve_required") {
    nextAction = "improve_recommended";
  } else if (parsed.overall_score >= 60 && nextAction === "improve_required" && !hasCriticalGap) {
    nextAction = "improve_recommended";
  }
  const strategicReading =
    parsed.overall_score >= 70
      ? softenBlockingStrategicReading(parsed.strategic_reading)
      : parsed.strategic_reading;

  return {
    ...parsed,
    quality_level: brandDiagnosisQualityLevelFromScore(parsed.overall_score),
    strategic_reading: strategicReading,
    next_recommended_action: nextAction,
    section_scores: parsed.section_scores.map((row) => ({
      ...row,
      quality_level: brandDiagnosisQualityLevelFromScore(row.score),
      can_generate_base:
        row.score >= 70 && row.contradictions.length === 0 ? true : row.can_generate_base,
      should_improve_before_consolidation:
        row.score >= 70 && row.contradictions.length === 0
          ? false
          : row.should_improve_before_consolidation,
    })),
  };
}

function softenBlockingStrategicReading(text: string): string {
  const hasBlockingLanguage =
    /impide(?:n)?\s+(?:una\s+)?consolidaci[oó]n/i.test(text) ||
    /no\s+est[aá]\s+lista/i.test(text) ||
    /base\s+m[ií]nima/i.test(text) ||
    /deficiencias\s+que\s+impiden/i.test(text) ||
    /informaci[oó]n\s+insuficiente/i.test(text) ||
    /no\s+hay\s+suficiente\s+informaci[oó]n/i.test(text);

  if (!hasBlockingLanguage) return text;

  return [
    "La marca cuenta con una base suficiente para avanzar hacia la consolidación.",
    "La información disponible permite construir una primera lectura estratégica, aunque conviene fortalecer algunos puntos para ganar precisión, evidencia y mayor capacidad de decisión.",
    "Las recomendaciones deben leerse como oportunidades de refinamiento y fortalecimiento, no como un bloqueo para seguir construyendo.",
  ].join(" ");
}

/**
 * Valida salida IA: Zod + cobertura exacta de secciones estratégicas y sin material_context.
 */
export function validateBrandDiagnosisAgainstCatalog(
  parsed: BrandDiagnosisRawOutputParsed,
  expectedStrategicSectionKeys: string[],
): { ok: true } | { ok: false; message: string } {
  if (expectedStrategicSectionKeys.length === 0) {
    return { ok: false, message: "No hay secciones estratégicas en el catálogo." };
  }

  const expected = new Set(expectedStrategicSectionKeys);
  if (expected.has("material_context")) {
    return { ok: false, message: "material_context no debe evaluarse en diagnóstico." };
  }

  const got = parsed.section_scores.map((s) => s.section_key);
  const gotSet = new Set(got);
  if (got.length !== gotSet.size) {
    return { ok: false, message: "section_scores contiene section_key duplicado." };
  }
  if (got.length !== expectedStrategicSectionKeys.length) {
    return {
      ok: false,
      message: `section_scores debe tener exactamente ${expectedStrategicSectionKeys.length} secciones; recibido ${got.length}.`,
    };
  }

  for (const key of got) {
    if (!expected.has(key)) {
      return { ok: false, message: `section_key no permitido o no estratégico: ${key}` };
    }
    if (key === "material_context") {
      return { ok: false, message: "material_context no está permitido en section_scores." };
    }
  }

  for (const key of expectedStrategicSectionKeys) {
    if (!gotSet.has(key)) {
      return { ok: false, message: `Falta diagnóstico para la sección: ${key}` };
    }
  }

  for (const row of parsed.critical_gaps) {
    if (!expected.has(row.section_key) && row.section_key !== "cross_section") {
      /* allow cross_section? User didn't ask - stick to catalog only */
    }
    if (!expected.has(row.section_key)) {
      return {
        ok: false,
        message: `critical_gaps.section_key inválido: ${row.section_key}`,
      };
    }
  }

  for (const row of parsed.contradictions) {
    if (!expected.has(row.section_key)) {
      return {
        ok: false,
        message: `contradictions.section_key inválido: ${row.section_key}`,
      };
    }
  }

  for (const row of parsed.improvement_plan) {
    if (!expected.has(row.section_key)) {
      return {
        ok: false,
        message: `improvement_plan.section_key inválido: ${row.section_key}`,
      };
    }
  }

  return { ok: true };
}
