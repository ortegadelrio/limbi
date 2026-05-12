import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BrandDiagnosisClient } from "@/components/brands/diagnosis/brand-diagnosis-client";
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

  return (
    <BrandDiagnosisClient
      brandId={brandId}
      brandName={brand.name}
      initialPendingReviewCount={pendingCount ?? 0}
      initialEvaluation={activeEvaluation}
      initialSectionKeysWithImprovementAfterDiagnosis={
        sectionKeysWithImprovementAfterDiagnosis
      }
    />
  );
}
