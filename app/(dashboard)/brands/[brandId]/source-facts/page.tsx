import { notFound, redirect } from "next/navigation";
import { BrandSourceFactsClient } from "@/components/brands/source-facts/brand-source-facts-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ brandId: string }> };

export default async function BrandSourceFactsPage({ params }: Props) {
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

  return <BrandSourceFactsClient brandId={brandId} brandName={brand.name} />;
}
