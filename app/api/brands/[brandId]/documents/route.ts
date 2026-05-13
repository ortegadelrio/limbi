import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import {
  attachExtractionSummaries,
  type BrandDocumentExtractionListFields,
} from "@/lib/brands/brand-document-extraction-summary";
import type { BrandDocumentListRow, BrandDocumentRow } from "@/types/database";

type Params = { params: Promise<{ brandId: string }> };

async function assertBrandOwned(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  userId: string,
  brandId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  const ok = await assertBrandOwned(supabase, user.id, brandId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("brand_documents")
    .select(
      "id, brand_id, user_id, file_name, file_type, document_type, storage_path, file_size_bytes, processing_status, processing_error, source_kind, web_entry_url, created_at, updated_at",
    )
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const docs = (data ?? []) as BrandDocumentRow[];
  const ids = docs.map((d) => d.id);
  let extractions: BrandDocumentExtractionListFields[] = [];
  if (ids.length > 0) {
    const { data: exRows, error: exErr } = await supabase
      .from("brand_document_extractions")
      .select(
        "brand_document_id, extraction_status, page_count, character_count, extraction_metadata, error_message",
      )
      .in("brand_document_id", ids);
    if (exErr) {
      return NextResponse.json({ error: exErr.message }, { status: 500 });
    }
    extractions = (exRows ?? []) as BrandDocumentExtractionListFields[];
  }

  const merged = attachExtractionSummaries(docs, extractions);
  return NextResponse.json({ documents: merged as BrandDocumentListRow[] });
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Usa POST /api/brands/[brandId]/documents/prepare-upload para subir documentos (subida directa a almacenamiento).",
      code: "use_prepare_upload",
    },
    { status: 405 },
  );
}
