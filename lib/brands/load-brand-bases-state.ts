import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchBrandCuratedBaseStalenessFacts,
  isBrandCuratedBaseStaleFromFacts,
} from "@/lib/brands/brand-bases-staleness";
import type { BrandKnowledgeBaseRow, BrandLimbicBaseRow } from "@/types/database";

export type BrandBasesDetailState = {
  pending_review_count: number;
  consolidation_running: boolean;
  knowledge_base: BrandKnowledgeBaseRow | null;
  limbic_base: BrandLimbicBaseRow | null;
  knowledge_base_is_stale: boolean;
  limbic_base_is_stale: boolean;
};

export async function loadBrandBasesDetailState(
  supabase: SupabaseClient,
  brandId: string,
): Promise<BrandBasesDetailState> {
  const { count: pending_review_count } = await supabase
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
  ]);

  const kRow = (knowledge ?? null) as BrandKnowledgeBaseRow | null;
  const lRow = (limbic ?? null) as BrandLimbicBaseRow | null;

  const [kFacts, lFacts] = await Promise.all([
    kRow?.created_at
      ? fetchBrandCuratedBaseStalenessFacts(supabase, brandId, kRow.created_at)
      : null,
    lRow?.created_at
      ? fetchBrandCuratedBaseStalenessFacts(supabase, brandId, lRow.created_at)
      : null,
  ]);

  return {
    pending_review_count: pending_review_count ?? 0,
    consolidation_running: (kRun ?? 0) > 0 || (lRun ?? 0) > 0,
    knowledge_base: kRow,
    limbic_base: lRow,
    knowledge_base_is_stale: kFacts ? isBrandCuratedBaseStaleFromFacts(kFacts) : false,
    limbic_base_is_stale: lFacts ? isBrandCuratedBaseStaleFromFacts(lFacts) : false,
  };
}
