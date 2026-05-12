import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchBrandCuratedBaseStalenessFacts,
  isBrandCuratedBaseStaleFromFacts,
} from "@/lib/brands/brand-bases-staleness";
import { fetchBrandDashboardDiagnosisState } from "@/lib/brands/fetch-brand-dashboard-diagnosis-state";
import { formatBogotaDateTime } from "@/lib/datetime/format-bogota-date-time";
import type { BrandKnowledgeBaseRow, BrandLimbicBaseRow } from "@/types/database";

export type BrandBasesDetailState = {
  pending_review_count: number;
  consolidation_running: boolean;
  knowledge_base: BrandKnowledgeBaseRow | null;
  limbic_base: BrandLimbicBaseRow | null;
  knowledge_base_is_stale: boolean;
  limbic_base_is_stale: boolean;
  has_active_diagnosis: boolean;
  diagnosis_is_stale: boolean;
  knowledge_consolidated_at_bogota: string | null;
};

export async function loadBrandBasesDetailState(
  supabase: SupabaseClient,
  brandId: string,
): Promise<BrandBasesDetailState> {
  const diagnosisDashPromise = fetchBrandDashboardDiagnosisState(supabase, brandId);

  const [
    pendingRes,
    kRunRes,
    lRunRes,
    knowledgeRes,
    limbicRes,
    diagnosisDash,
  ] = await Promise.all([
    supabase
      .from("brand_source_facts")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("status", "pending_review"),
    supabase
      .from("brand_knowledge_bases")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("status", "running"),
    supabase
      .from("brand_limbic_bases")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("status", "running"),
    supabase
      .from("brand_knowledge_bases")
      .select("*")
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .eq("status", "succeeded")
      .maybeSingle(),
    supabase
      .from("brand_limbic_bases")
      .select("*")
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .eq("status", "succeeded")
      .maybeSingle(),
    diagnosisDashPromise,
  ]);

  const kRow = (knowledgeRes.data ?? null) as BrandKnowledgeBaseRow | null;
  const lRow = (limbicRes.data ?? null) as BrandLimbicBaseRow | null;

  const staleOpts = {
    activeDiagnosisIsStale:
      diagnosisDash.hasActiveDiagnosis && diagnosisDash.diagnosisIsStale,
  };

  const [kFacts, lFacts] = await Promise.all([
    kRow?.created_at
      ? fetchBrandCuratedBaseStalenessFacts(supabase, brandId, kRow.created_at, staleOpts)
      : null,
    lRow?.created_at
      ? fetchBrandCuratedBaseStalenessFacts(supabase, brandId, lRow.created_at, staleOpts)
      : null,
  ]);

  return {
    pending_review_count: pendingRes.count ?? 0,
    consolidation_running: (kRunRes.count ?? 0) > 0 || (lRunRes.count ?? 0) > 0,
    knowledge_base: kRow,
    limbic_base: lRow,
    knowledge_base_is_stale: kFacts ? isBrandCuratedBaseStaleFromFacts(kFacts) : false,
    limbic_base_is_stale: lFacts ? isBrandCuratedBaseStaleFromFacts(lFacts) : false,
    has_active_diagnosis: diagnosisDash.hasActiveDiagnosis,
    diagnosis_is_stale: diagnosisDash.diagnosisIsStale,
    knowledge_consolidated_at_bogota: kRow?.created_at
      ? formatBogotaDateTime(kRow.created_at)
      : null,
  };
}
