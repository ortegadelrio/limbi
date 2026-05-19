import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandOfferNature, BrandStatus } from "@/types/database";
import { fetchBrandDashboardBasesState } from "@/lib/brands/fetch-brand-dashboard-bases-state";
import { fetchBrandDashboardDiagnosisState } from "@/lib/brands/fetch-brand-dashboard-diagnosis-state";
import {
  brandOverviewExecutiveStatusLabel,
  resolveBrandDashboardMaintenance,
  type BrandDashboardMaintenanceResolved,
} from "@/lib/brands/brand-dashboard-maintenance-action";
import { formatBogotaDateTime } from "@/lib/datetime/format-bogota-date-time";

export type BrandOverviewListRow = {
  id: string;
  name: string;
  description: string | null;
  brand_status: BrandStatus;
  website_url: string | null;
  country_or_market: string | null;
  updated_at: string;
  offer_nature: BrandOfferNature | null;
  maintenance: BrandDashboardMaintenanceResolved;
  executiveStatusLabel: string;
  overallScore: number | null;
  diagnosisGeneratedAtBogota: string | null;
  baseConsolidatedAtBogota: string | null;
  hasActiveDiagnosis: boolean;
  diagnosisIsStale: boolean;
  hasActiveBases: boolean;
  basesStale: boolean;
  /** Para validar que POST diagnóstico devolvió una evaluación nueva antes de consolidar. */
  activeDiagnosisEvaluationId: string | null;
};

/**
 * Para `/brands`: misma fuente de verdad que el dashboard interno (diagnóstico + bases + resolver).
 */
export async function fetchBrandsOverviewMaintenanceRows(
  supabase: SupabaseClient,
  brands: Array<{
    id: string;
    name: string;
    description: string | null;
    brand_status: string;
    website_url: string | null;
    country_or_market: string | null;
    updated_at: string;
  }>,
  natureByBrand: Map<string, BrandOfferNature | null>,
): Promise<BrandOverviewListRow[]> {
  if (brands.length === 0) return [];

  return Promise.all(
    brands.map(async (b) => {
      const [diagnosisState, basesState] = await Promise.all([
        fetchBrandDashboardDiagnosisState(supabase, b.id),
        fetchBrandDashboardBasesState(supabase, b.id),
      ]);

      const hasActiveBases =
        basesState.hasActiveKnowledgeBase && basesState.hasActiveLimbicBase;
      const basesStale =
        basesState.knowledgeBaseIsStale || basesState.limbicBaseIsStale;

      const maintenance = resolveBrandDashboardMaintenance({
        brandId: b.id,
        pendingFactsCount: diagnosisState.pendingFactsCount,
        pendingKnowledgeUpdatesCount: basesState.pendingKnowledgeUpdatesCount,
        consolidationRunning: basesState.consolidationRunning,
        hasActiveDiagnosis: diagnosisState.hasActiveDiagnosis,
        diagnosisIsStale: diagnosisState.diagnosisIsStale,
        hasActiveBases,
        basesStale,
        forBrandsList: true,
      });

      const overallScore = diagnosisState.activeDiagnosis?.overall_score ?? null;
      const diagnosisGeneratedAtBogota = diagnosisState.activeDiagnosis?.created_at
        ? formatBogotaDateTime(diagnosisState.activeDiagnosis.created_at)
        : null;
      const baseConsolidatedAtBogota = basesState.activeKnowledgeCreatedAt
        ? formatBogotaDateTime(basesState.activeKnowledgeCreatedAt)
        : null;

      const executiveStatusLabel = brandOverviewExecutiveStatusLabel(maintenance, {
        hasActiveDiagnosis: diagnosisState.hasActiveDiagnosis,
        hasActiveBases,
      });

      return {
        id: b.id,
        name: b.name,
        description: b.description,
        brand_status: b.brand_status as BrandStatus,
        website_url: b.website_url,
        country_or_market: b.country_or_market,
        updated_at: b.updated_at,
        offer_nature: (natureByBrand.get(b.id) as BrandOfferNature | undefined) ?? null,
        maintenance,
        executiveStatusLabel,
        overallScore,
        diagnosisGeneratedAtBogota,
        baseConsolidatedAtBogota,
        hasActiveDiagnosis: diagnosisState.hasActiveDiagnosis,
        diagnosisIsStale: diagnosisState.diagnosisIsStale,
        hasActiveBases,
        basesStale,
        activeDiagnosisEvaluationId: diagnosisState.activeDiagnosis?.id ?? null,
      };
    }),
  );
}
