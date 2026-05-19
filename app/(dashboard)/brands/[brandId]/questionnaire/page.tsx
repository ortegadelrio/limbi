import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BrandQuestionnaireShell } from "@/components/brands/questionnaire/brand-questionnaire-shell";
import { fetchBrandDashboardDiagnosisState } from "@/lib/brands/fetch-brand-dashboard-diagnosis-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ brandId: string }> };

export default async function BrandQuestionnairePage({ params }: Props) {
  const { brandId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: knowledge }, { data: limbic }] = await Promise.all([
    supabase
      .from("brand_knowledge_bases")
      .select("id")
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .is("superseded_at", null)
      .eq("status", "succeeded")
      .maybeSingle(),
    supabase
      .from("brand_limbic_bases")
      .select("id")
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .is("superseded_at", null)
      .eq("status", "succeeded")
      .maybeSingle(),
  ]);
  const hasActiveBases = Boolean(knowledge && limbic);
  const diagnosisState = await fetchBrandDashboardDiagnosisState(supabase, brandId);

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-limbi-muted">
          Cargando cuestionario…
        </div>
      }
    >
      <BrandQuestionnaireShell
        brandId={brandId}
        hasActiveBases={hasActiveBases}
        hasActiveDiagnosis={diagnosisState.hasActiveDiagnosis}
      />
    </Suspense>
  );
}
