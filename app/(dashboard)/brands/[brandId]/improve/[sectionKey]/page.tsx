import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BrandSectionImproveClient } from "@/components/brands/improve/brand-section-improve-client";

type Props = { params: Promise<{ brandId: string; sectionKey: string }> };

export default async function BrandSectionImprovePage({ params }: Props) {
  const { brandId, sectionKey: rawKey } = await params;
  const sectionKey = decodeURIComponent(rawKey);

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

  return (
    <BrandSectionImproveClient brandId={brandId} brandName={brand.name} sectionKey={sectionKey} />
  );
}
