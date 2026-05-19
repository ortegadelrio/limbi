import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { BrandKnowledgeUpdatesClient } from "@/components/brands/knowledge-updates/brand-knowledge-updates-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ brandId: string }> };

async function BrandKnowledgeUpdatesPageInner({ params }: Props) {
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

  const [{ data: knowledge }, { count: approvedNotIncorporated }] = await Promise.all([
    supabase
      .from("brand_knowledge_bases")
      .select("created_at")
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .is("superseded_at", null)
      .eq("status", "succeeded")
      .maybeSingle(),
    supabase
      .from("brand_knowledge_updates")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("status", "approved"),
  ]);

  let hasApprovedPendingConsolidation = (approvedNotIncorporated ?? 0) > 0;
  if (hasApprovedPendingConsolidation && knowledge?.created_at) {
    const { count: afterBase } = await supabase
      .from("brand_knowledge_updates")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("status", "approved")
      .gt("approved_at", knowledge.created_at);
    hasApprovedPendingConsolidation = (afterBase ?? 0) > 0;
  }

  return (
    <BrandKnowledgeUpdatesClient
      brandId={brandId}
      brandName={brand.name}
      hasApprovedPendingConsolidation={hasApprovedPendingConsolidation}
    />
  );
}

export default function BrandKnowledgeUpdatesPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-limbi-muted">
          Cargando actualizaciones…
        </div>
      }
    >
      <BrandKnowledgeUpdatesPageInner {...props} />
    </Suspense>
  );
}
