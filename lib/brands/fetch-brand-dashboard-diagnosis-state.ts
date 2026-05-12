import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchActiveBrandDiagnosisIsStale } from "@/lib/brands/brand-diagnosis-staleness";
import type { BrandDiagnosisNextRecommendedAction, BrandEvaluationRow } from "@/types/database";

export type BrandDashboardDiagnosisState = {
  pendingFactsCount: number;
  hasActiveDiagnosis: boolean;
  activeDiagnosis: Pick<BrandEvaluationRow, "id" | "created_at"> | null;
  diagnosisIsStale: boolean;
  /** Solo con diagnóstico activo succeeded; para copy del journey (consolidar). */
  nextRecommendedAction: BrandDiagnosisNextRecommendedAction | null;
  criticalGapsCount: number;
};

/**
 * Señales compartidas entre el dashboard de marca y el listado de marcas:
 * hallazgos pendientes, diagnóstico activo y obsolescencia (misma lógica que la página de marca).
 */
export async function fetchBrandDashboardDiagnosisState(
  supabase: SupabaseClient,
  brandId: string,
): Promise<BrandDashboardDiagnosisState> {
  const { count: pendingFactsCount } = await supabase
    .from("brand_source_facts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("status", "pending_review");

  const { data: activeRow } = await supabase
    .from("brand_evaluations")
    .select("id, created_at, next_recommended_action, critical_gaps")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .eq("status", "succeeded")
    .maybeSingle();

  const pendingFacts = pendingFactsCount ?? 0;
  const activeDiagnosis = activeRow
    ? { id: activeRow.id, created_at: activeRow.created_at }
    : null;

  if (!activeDiagnosis) {
    return {
      pendingFactsCount: pendingFacts,
      hasActiveDiagnosis: false,
      activeDiagnosis: null,
      diagnosisIsStale: false,
      nextRecommendedAction: null,
      criticalGapsCount: 0,
    };
  }

  const gaps = activeRow?.critical_gaps;
  const criticalGapsCount = Array.isArray(gaps) ? gaps.length : 0;
  const nextRecommendedAction =
    (activeRow?.next_recommended_action as BrandDiagnosisNextRecommendedAction | null) ?? null;

  const diagnosisIsStale = await fetchActiveBrandDiagnosisIsStale(
    supabase,
    brandId,
    activeDiagnosis,
  );

  return {
    pendingFactsCount: pendingFacts,
    hasActiveDiagnosis: true,
    activeDiagnosis,
    diagnosisIsStale,
    nextRecommendedAction,
    criticalGapsCount,
  };
}
