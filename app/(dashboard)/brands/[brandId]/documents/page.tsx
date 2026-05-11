import { notFound, redirect } from "next/navigation";
import { BrandDocumentsClient } from "@/components/brands/brand-documents-client";
import {
  attachExtractionSummaries,
  type BrandDocumentExtractionListFields,
} from "@/lib/brands/brand-document-extraction-summary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { BrandDocumentListRow, BrandDocumentRow } from "@/types/database";

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

  const docRows = (docs ?? []) as BrandDocumentRow[];
  const ids = docRows.map((d) => d.id);
  let extractions: BrandDocumentExtractionListFields[] = [];
  if (ids.length > 0) {
    const { data: exRows, error: exError } = await supabase
      .from("brand_document_extractions")
      .select(
        "brand_document_id, extraction_status, page_count, character_count, extraction_metadata, error_message",
      )
      .in("brand_document_id", ids);
    if (exError) {
      throw new Error(exError.message);
    }
    extractions = (exRows ?? []) as BrandDocumentExtractionListFields[];
  }

  const listRows = attachExtractionSummaries(docRows, extractions);

  return (
    <BrandDocumentsClient
      brandId={brandId}
      brandName={brand.name}
      initialDocuments={listRows as BrandDocumentListRow[]}
      mode="standalone"
    />
  );
}
