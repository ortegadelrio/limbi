import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchStructuralQuestionnaireStaleness } from "@/lib/brands/brand-diagnosis-staleness";

export function isAfterConsolidationCreatedAt(
  baseCreatedAt: string | null | undefined,
  timestamp: string | null | undefined,
): boolean {
  return Boolean(baseCreatedAt && timestamp && timestamp > baseCreatedAt);
}

export type BrandCuratedBaseStalenessFacts = {
  baseCreatedAt: string;
  diagnosisRenewedAfterBase: boolean;
  hasResponsesUpdatedAfterBase: boolean;
  hasSourceFactsUpdatedAfterBase: boolean;
  hasImprovementsApprovedAfterBase: boolean;
  offerProfileUpdatedAt: string | null;
  brandRowUpdatedAt: string | null;
  hasStaleOfferItems: boolean;
  hasStaleAudienceTerritories: boolean;
};

export function isBrandCuratedBaseStaleFromFacts(facts: BrandCuratedBaseStalenessFacts): boolean {
  const t = facts.baseCreatedAt;
  if (facts.diagnosisRenewedAfterBase) return true;
  if (facts.hasStaleOfferItems || facts.hasStaleAudienceTerritories) return true;
  if (facts.hasSourceFactsUpdatedAfterBase) return true;
  if (facts.hasResponsesUpdatedAfterBase) return true;
  if (facts.hasImprovementsApprovedAfterBase) return true;
  if (isAfterConsolidationCreatedAt(t, facts.offerProfileUpdatedAt ?? undefined)) return true;
  if (isAfterConsolidationCreatedAt(t, facts.brandRowUpdatedAt ?? undefined)) return true;
  return false;
}

export async function fetchBrandCuratedBaseStalenessFacts(
  supabase: SupabaseClient,
  brandId: string,
  baseCreatedAt: string,
): Promise<BrandCuratedBaseStalenessFacts> {
  const [
    responsesRes,
    factsRes,
    improvementsRes,
    structural,
    activeEvalRes,
  ] = await Promise.all([
    supabase
      .from("brand_responses")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .gt("updated_at", baseCreatedAt),
    supabase
      .from("brand_source_facts")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .gt("updated_at", baseCreatedAt),
    supabase
      .from("brand_section_improvements")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("status", "approved")
      .eq("is_active", true)
      .gt("approved_at", baseCreatedAt),
    fetchStructuralQuestionnaireStaleness(supabase, brandId, baseCreatedAt),
    supabase
      .from("brand_evaluations")
      .select("created_at")
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .eq("status", "succeeded")
      .maybeSingle(),
  ]);

  const evalCreated = activeEvalRes.data?.created_at ?? null;
  const diagnosisRenewedAfterBase = Boolean(
    evalCreated && isAfterConsolidationCreatedAt(baseCreatedAt, evalCreated),
  );

  return {
    baseCreatedAt,
    diagnosisRenewedAfterBase,
    hasResponsesUpdatedAfterBase: (responsesRes.count ?? 0) > 0,
    hasSourceFactsUpdatedAfterBase: (factsRes.count ?? 0) > 0,
    hasImprovementsApprovedAfterBase: (improvementsRes.count ?? 0) > 0,
    offerProfileUpdatedAt: structural.offerProfileUpdatedAt,
    brandRowUpdatedAt: structural.brandRowUpdatedAt,
    hasStaleOfferItems: structural.hasStaleOfferItems,
    hasStaleAudienceTerritories: structural.hasStaleAudienceTerritories,
  };
}
