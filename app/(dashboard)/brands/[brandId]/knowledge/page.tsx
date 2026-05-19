import { notFound, redirect } from "next/navigation";
import { BrandKnowledgeHubClient } from "@/components/brands/knowledge/brand-knowledge-hub-client";
import { fetchBrandKnowledgeHubState } from "@/lib/brands/fetch-brand-knowledge-hub-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ brandId: string }> };

export default async function BrandKnowledgeHubPage({ params }: Props) {
  const { brandId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: owned } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owned) notFound();

  const hubState = await fetchBrandKnowledgeHubState(supabase, brandId);
  if (!hubState) notFound();

  return <BrandKnowledgeHubClient brandId={brandId} initial={hubState} />;
}
