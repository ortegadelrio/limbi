import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BrandDiagnosisClient } from "@/components/brands/diagnosis/brand-diagnosis-client";
import {
  fetchStructuralQuestionnaireStaleness,
  isBrandDiagnosisStale,
} from "@/lib/brands/brand-diagnosis-staleness";
import { fetchBrandDashboardBasesState } from "@/lib/brands/fetch-brand-dashboard-bases-state";
import { sectionKeysWithApprovedImprovementAfterEvaluation } from "@/lib/brands/diagnosis-improvement-badges";
import type { BrandEvaluationRow } from "@/types/database";

type Props = { params: Promise<{ brandId: string }> };

export default async function BrandDiagnosisPage({ params }: Props) {
  const { brandId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id, name")
    .eq("id", brandId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (brandError) {
    throw new Error(brandError.message);
  }
  if (!brand) notFound();

  const { count: pendingCount } = await supabase
    .from("brand_source_facts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("status", "pending_review");

  const { data: evaluation, error: evErr } = await supabase
    .from("brand_evaluations")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .eq("status", "succeeded")
    .maybeSingle();

  if (evErr) {
    throw new Error(evErr.message);
  }

  const activeEvaluation = (evaluation ?? null) as BrandEvaluationRow | null;

  const { data: improvementBadgeRows, error: impErr } = await supabase
    .from("brand_section_improvements")
    .select("section_key, approved_at")
    .eq("brand_id", brandId)
    .eq("status", "approved")
    .eq("is_active", true);

  if (impErr) {
    throw new Error(impErr.message);
  }

  const sectionKeysWithImprovementAfterDiagnosis =
    sectionKeysWithApprovedImprovementAfterEvaluation(
      activeEvaluation,
      (improvementBadgeRows ?? []) as { section_key: string; approved_at: string | null }[],
    );

  const [responseStaleness, sourceFactStaleness, structuralStaleness] = activeEvaluation
    ? await Promise.all([
        supabase
          .from("brand_responses")
          .select("updated_at")
          .eq("brand_id", brandId)
          .gt("updated_at", activeEvaluation.created_at),
        supabase
          .from("brand_source_facts")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", brandId)
          .gt("updated_at", activeEvaluation.created_at),
        fetchStructuralQuestionnaireStaleness(
          supabase,
          brandId,
          activeEvaluation.created_at,
        ),
      ])
    : [null, null, null];

  const diagnosisIsStale = isBrandDiagnosisStale({
    evaluation: activeEvaluation,
    responseRows: responseStaleness?.data ?? [],
    hasSourceFactsUpdatedAfterEvaluation: (sourceFactStaleness?.count ?? 0) > 0,
    improvementRows: improvementBadgeRows ?? [],
    offerProfileUpdatedAt: structuralStaleness?.offerProfileUpdatedAt ?? null,
    hasStaleOfferItems: structuralStaleness?.hasStaleOfferItems ?? false,
    hasStaleAudienceTerritories: structuralStaleness?.hasStaleAudienceTerritories ?? false,
    brandRowUpdatedAt: structuralStaleness?.brandRowUpdatedAt ?? null,
  });

  const initialBasesState = await fetchBrandDashboardBasesState(supabase, brandId);

  return (
    <BrandDiagnosisClient
      brandId={brandId}
      brandName={brand.name}
      initialPendingReviewCount={pendingCount ?? 0}
      initialEvaluation={activeEvaluation}
      initialSectionKeysWithImprovementAfterDiagnosis={
        sectionKeysWithImprovementAfterDiagnosis
      }
      initialDiagnosisIsStale={diagnosisIsStale}
      initialBasesState={initialBasesState}
    />
  );
}
