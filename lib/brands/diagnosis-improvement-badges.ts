import type { BrandEvaluationRow } from "@/types/database";

export type ImprovementBadgeRow = {
  section_key: string;
  approved_at: string | null;
};

/**
 * Secciones con mejora aprobada activa cuya `approved_at` es estrictamente posterior
 * al momento del diagnóstico activo (`updated_at`, o `created_at` si hiciera falta).
 */
export function sectionKeysWithApprovedImprovementAfterEvaluation(
  evaluation: BrandEvaluationRow | null,
  improvements: ImprovementBadgeRow[],
): string[] {
  if (!evaluation) return [];
  const diagnosisInstant = evaluation.updated_at ?? evaluation.created_at;
  if (!diagnosisInstant) return [];
  const out = new Set<string>();
  for (const im of improvements) {
    const at = im.approved_at;
    if (at && at > diagnosisInstant) {
      out.add(im.section_key);
    }
  }
  return [...out];
}
