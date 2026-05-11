import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { brandSourceFactsGetQuerySchema } from "@/lib/schemas/brand-source-facts";
import type { BrandSourceFactRow } from "@/types/database";

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

export async function GET(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  const owned = await assertBrandOwned(supabase, user.id, brandId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const parsed = brandSourceFactsGetQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? "pending_review",
    brand_document_id: url.searchParams.get("brand_document_id") ?? undefined,
    analysis_batch_id: url.searchParams.get("analysis_batch_id") ?? undefined,
    section_key: url.searchParams.get("section_key") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const q = parsed.data;
  let query = supabase
    .from("brand_source_facts")
    .select(
      "id, brand_id, source_type, brand_document_id, brand_document_extraction_id, analysis_batch_id, analysis_run_id, section_key, module_key, question_key, relationship_type, fact_type, source_excerpt, source_reference, source_document_name, supporting_documents, extracted_fact, ai_interpretation, existing_response_summary, proposed_inclusion, user_edited_text, status, rejection_reason, confidence_score, sort_order, created_at, updated_at, reviewed_at",
    )
    .eq("brand_id", brandId)
    .order("section_key", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (q.status !== "all") {
    query = query.eq("status", q.status);
  }
  if (q.brand_document_id) {
    query = query.eq("brand_document_id", q.brand_document_id);
  }
  if (q.analysis_batch_id) {
    query = query.eq("analysis_batch_id", q.analysis_batch_id);
  }
  if (q.section_key) {
    query = query.eq("section_key", q.section_key);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const facts = (data ?? []) as BrandSourceFactRow[];
  return NextResponse.json({ facts });
}
