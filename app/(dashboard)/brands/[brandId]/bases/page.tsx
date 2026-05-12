import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BrandBasesClient } from "@/components/brands/bases/brand-bases-client";
import { loadBrandBasesDetailState } from "@/lib/brands/load-brand-bases-state";

type Props = { params: Promise<{ brandId: string }> };

export default async function BrandBasesPage({ params }: Props) {
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

  const { data: activeEvaluation } = await supabase
    .from("brand_evaluations")
    .select("id")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .eq("status", "succeeded")
    .maybeSingle();

  const bases = await loadBrandBasesDetailState(supabase, brandId);

  return (
    <BrandBasesClient
      brandId={brandId}
      brandName={brand.name}
      hasActiveDiagnosis={Boolean(activeEvaluation)}
      initialBases={bases}
    />
  );
}
