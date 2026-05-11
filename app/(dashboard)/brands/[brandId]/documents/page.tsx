import { notFound, redirect } from "next/navigation";
import { BrandDocumentsClient } from "@/components/brands/brand-documents-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { BrandDocumentRow } from "@/types/database";

type Props = { params: Promise<{ brandId: string }> };

export default async function BrandDocumentsPage({ params }: Props) {
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

  const { data: docs, error: docsError } = await supabase
    .from("brand_documents")
    .select(
      "id, brand_id, user_id, file_name, file_type, document_type, storage_path, file_size_bytes, processing_status, processing_error, created_at, updated_at",
    )
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });

  if (docsError) {
    throw new Error(docsError.message);
  }

  return (
    <BrandDocumentsClient
      brandId={brandId}
      brandName={brand.name}
      initialDocuments={(docs ?? []) as BrandDocumentRow[]}
      mode="standalone"
    />
  );
}
