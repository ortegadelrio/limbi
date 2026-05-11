import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { patchBrandSourceFactBodySchema } from "@/lib/schemas/brand-source-facts";

type Params = { params: Promise<{ brandId: string; factId: string }> };

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

export async function PATCH(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId, factId } = await params;
  const owned = await assertBrandOwned(supabase, user.id, brandId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = patchBrandSourceFactBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonBadRequest("Cuerpo inválido.", {
      code: "invalid_body",
      detail: parsed.error.message,
    });
  }

  const { data: fact, error: factErr } = await supabase
    .from("brand_source_facts")
    .select("id, brand_id, status")
    .eq("id", factId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (factErr) {
    return NextResponse.json({ error: factErr.message }, { status: 500 });
  }
  if (!fact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (fact.status !== "pending_review") {
    return jsonBadRequest("Solo se pueden revisar hallazgos en estado pending_review.", {
      code: "invalid_status",
    });
  }

  const now = new Date().toISOString();
  const action = parsed.data;

  if (action.action === "approve") {
    const { data: updated, error: upErr } = await supabase
      .from("brand_source_facts")
      .update({
        status: "approved",
        reviewed_at: now,
        user_edited_text: null,
        rejection_reason: null,
      })
      .eq("id", factId)
      .select(
        "id, brand_id, source_type, brand_document_id, brand_document_extraction_id, analysis_batch_id, analysis_run_id, section_key, module_key, question_key, relationship_type, fact_type, source_excerpt, source_reference, source_document_name, supporting_documents, extracted_fact, ai_interpretation, existing_response_summary, proposed_inclusion, user_edited_text, status, rejection_reason, confidence_score, sort_order, created_at, updated_at, reviewed_at",
      )
      .single();
    if (upErr || !updated) {
      return NextResponse.json({ error: upErr?.message ?? "Error al actualizar." }, { status: 500 });
    }
    return NextResponse.json({ fact: updated });
  }

  if (action.action === "approve_with_edit") {
    const { data: updated, error: upErr } = await supabase
      .from("brand_source_facts")
      .update({
        status: "approved",
        user_edited_text: action.user_edited_text,
        reviewed_at: now,
        rejection_reason: null,
      })
      .eq("id", factId)
      .select(
        "id, brand_id, source_type, brand_document_id, brand_document_extraction_id, analysis_batch_id, analysis_run_id, section_key, module_key, question_key, relationship_type, fact_type, source_excerpt, source_reference, source_document_name, supporting_documents, extracted_fact, ai_interpretation, existing_response_summary, proposed_inclusion, user_edited_text, status, rejection_reason, confidence_score, sort_order, created_at, updated_at, reviewed_at",
      )
      .single();
    if (upErr || !updated) {
      return NextResponse.json({ error: upErr?.message ?? "Error al actualizar." }, { status: 500 });
    }
    return NextResponse.json({ fact: updated });
  }

  const { data: updated, error: upErr } = await supabase
    .from("brand_source_facts")
    .update({
      status: "rejected",
      reviewed_at: now,
      rejection_reason: action.rejection_reason?.trim() || null,
    })
    .eq("id", factId)
    .select(
      "id, brand_id, source_type, brand_document_id, brand_document_extraction_id, analysis_batch_id, analysis_run_id, section_key, module_key, question_key, relationship_type, fact_type, source_excerpt, source_reference, source_document_name, supporting_documents, extracted_fact, ai_interpretation, existing_response_summary, proposed_inclusion, user_edited_text, status, rejection_reason, confidence_score, sort_order, created_at, updated_at, reviewed_at",
    )
    .single();

  if (upErr || !updated) {
    return NextResponse.json({ error: upErr?.message ?? "Error al actualizar." }, { status: 500 });
  }
  return NextResponse.json({ fact: updated });
}
