import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchStructuralQuestionnaireStaleness,
  isBrandDiagnosisStale,
} from "@/lib/brands/brand-diagnosis-staleness";
import type { BrandEvaluationRow } from "@/types/database";

export type BrandDashboardDiagnosisState = {
  pendingFactsCount: number;
  hasActiveDiagnosis: boolean;
  activeDiagnosis: Pick<BrandEvaluationRow, "id" | "created_at"> | null;
  diagnosisIsStale: boolean;
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
    .select("id, created_at")
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
    };
  }

  const [
    responseStaleness,
    sourceFactStaleness,
    improvementStaleness,
    structuralStaleness,
  ] = await Promise.all([
    supabase
      .from("brand_responses")
      .select("updated_at")
      .eq("brand_id", brandId)
      .gt("updated_at", activeDiagnosis.created_at),
    supabase
      .from("brand_source_facts")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .gt("updated_at", activeDiagnosis.created_at),
    supabase
      .from("brand_section_improvements")
      .select("approved_at")
      .eq("brand_id", brandId)
      .eq("status", "approved")
      .eq("is_active", true)
      .gt("approved_at", activeDiagnosis.created_at),
    fetchStructuralQuestionnaireStaleness(
      supabase,
      brandId,
      activeDiagnosis.created_at,
    ),
  ]);

  const diagnosisIsStale = isBrandDiagnosisStale({
    evaluation: activeDiagnosis,
    responseRows: responseStaleness.data ?? [],
    hasSourceFactsUpdatedAfterEvaluation: (sourceFactStaleness.count ?? 0) > 0,
    improvementRows: improvementStaleness.data ?? [],
    offerProfileUpdatedAt: structuralStaleness.offerProfileUpdatedAt ?? null,
    hasStaleOfferItems: structuralStaleness.hasStaleOfferItems,
    hasStaleAudienceTerritories: structuralStaleness.hasStaleAudienceTerritories,
    brandRowUpdatedAt: structuralStaleness.brandRowUpdatedAt ?? null,
  });

  return {
    pendingFactsCount: pendingFacts,
    hasActiveDiagnosis: true,
    activeDiagnosis,
    diagnosisIsStale,
  };
}
