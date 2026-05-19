import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { patchBrandKnowledgeUpdateBodySchema } from "@/lib/schemas/brand-knowledge-update";
import type { BrandKnowledgeUpdateRow } from "@/types/database";

export const runtime = "nodejs";

type Params = { params: Promise<{ brandId: string; updateId: string }> };

const SELECT_COLUMNS =
  "id, brand_id, user_id, raw_text, interpreted_summary, source_type, section_key, importance_level, must_include, status, user_decision, reason_for_exclusion, approved_at, discarded_at, incorporated_at, created_at, updated_at";

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

  const { brandId, updateId } = await params;
  const owned = await assertBrandOwned(supabase, user.id, brandId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = patchBrandKnowledgeUpdateBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonBadRequest("Cuerpo inválido.", {
      code: "invalid_body",
      detail: parsed.error.message,
    });
  }

  const { data: row, error: rowErr } = await supabase
    .from("brand_knowledge_updates")
    .select("id, brand_id, status")
    .eq("id", updateId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.status !== "pending_review") {
    return jsonBadRequest("Solo se pueden revisar actualizaciones en estado pending_review.", {
      code: "invalid_status",
    });
  }

  const now = new Date().toISOString();
  const action = parsed.data;

  if (action.action === "approve") {
    const { data: updated, error: upErr } = await supabase
      .from("brand_knowledge_updates")
      .update({
        status: "approved",
        approved_at: now,
        discarded_at: null,
        reason_for_exclusion: null,
        user_decision: action.user_decision?.trim() || null,
      })
      .eq("id", updateId)
      .select(SELECT_COLUMNS)
      .single();
    if (upErr || !updated) {
      return NextResponse.json({ error: upErr?.message ?? "Error al actualizar." }, { status: 500 });
    }
    return NextResponse.json({ update: updated as BrandKnowledgeUpdateRow });
  }

  const { data: updated, error: upErr } = await supabase
    .from("brand_knowledge_updates")
    .update({
      status: "discarded",
      discarded_at: now,
      approved_at: null,
      reason_for_exclusion: action.reason_for_exclusion?.trim() || null,
      user_decision: action.user_decision?.trim() || null,
    })
    .eq("id", updateId)
    .select(SELECT_COLUMNS)
    .single();

  if (upErr || !updated) {
    return NextResponse.json({ error: upErr?.message ?? "Error al actualizar." }, { status: 500 });
  }
  return NextResponse.json({ update: updated as BrandKnowledgeUpdateRow });
}
