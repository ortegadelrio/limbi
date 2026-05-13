import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchBrandCuratedBaseStalenessFacts,
  isBrandCuratedBaseStaleFromFacts,
} from "@/lib/brands/brand-bases-staleness";

export type BrandDashboardBasesState = {
  pendingFactsCount: number;
  consolidationRunning: boolean;
  hasActiveKnowledgeBase: boolean;
  hasActiveLimbicBase: boolean;
  activeKnowledgeCreatedAt: string | null;
  activeLimbicCreatedAt: string | null;
  knowledgeBaseIsStale: boolean;
  limbicBaseIsStale: boolean;
};

export async function fetchBrandDashboardBasesState(
  supabase: SupabaseClient,
  brandId: string,
): Promise<BrandDashboardBasesState> {
  const { count: pendingFactsCount } = await supabase
    .from("brand_source_facts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("status", "pending_review");

  const [{ count: kRun }, { count: lRun }] = await Promise.all([
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
  ]);

  const [{ data: knowledge }, { data: limbic }] = await Promise.all([
    supabase
      .from("brand_knowledge_bases")
      .select("id, created_at")
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .is("superseded_at", null)
      .eq("status", "succeeded")
      .maybeSingle(),
    supabase
      .from("brand_limbic_bases")
      .select("id, created_at")
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .is("superseded_at", null)
      .eq("status", "succeeded")
      .maybeSingle(),
  ]);

  const kAt = knowledge?.created_at ?? null;
  const lAt = limbic?.created_at ?? null;

  const [kFacts, lFacts] = await Promise.all([
    kAt ? fetchBrandCuratedBaseStalenessFacts(supabase, brandId, kAt) : null,
    lAt ? fetchBrandCuratedBaseStalenessFacts(supabase, brandId, lAt) : null,
  ]);

  return {
    pendingFactsCount: pendingFactsCount ?? 0,
    consolidationRunning: (kRun ?? 0) > 0 || (lRun ?? 0) > 0,
    hasActiveKnowledgeBase: Boolean(knowledge),
    hasActiveLimbicBase: Boolean(limbic),
    activeKnowledgeCreatedAt: kAt,
    activeLimbicCreatedAt: lAt,
    knowledgeBaseIsStale: kFacts ? isBrandCuratedBaseStaleFromFacts(kFacts) : false,
    limbicBaseIsStale: lFacts ? isBrandCuratedBaseStaleFromFacts(lFacts) : false,
  };
}
