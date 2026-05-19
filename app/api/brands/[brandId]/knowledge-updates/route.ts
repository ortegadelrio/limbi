import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { classifyBrandKnowledgeUpdate } from "@/lib/brands/classify-brand-knowledge-update";
import {
  brandKnowledgeUpdatesGetQuerySchema,
  postBrandKnowledgeUpdateBodySchema,
} from "@/lib/schemas/brand-knowledge-update";
import type { BrandKnowledgeUpdateRow } from "@/types/database";

export const runtime = "nodejs";

type Params = { params: Promise<{ brandId: string }> };

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

export async function GET(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  const owned = await assertBrandOwned(supabase, user.id, brandId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const parsed = brandKnowledgeUpdatesGetQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? "pending_review",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let query = supabase
    .from("brand_knowledge_updates")
    .select(SELECT_COLUMNS)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });

  if (parsed.data.status !== "all") {
    query = query.eq("status", parsed.data.status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updates: (data ?? []) as BrandKnowledgeUpdateRow[] });
}

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  const owned = await assertBrandOwned(supabase, user.id, brandId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = postBrandKnowledgeUpdateBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonBadRequest("Cuerpo inválido.", {
      code: "invalid_body",
      detail: parsed.error.message,
    });
  }

  const classification = classifyBrandKnowledgeUpdate(parsed.data.raw_text);
  const sectionKey = parsed.data.section_key ?? classification.section_key;

  const { data: inserted, error: insErr } = await supabase
    .from("brand_knowledge_updates")
    .insert({
      brand_id: brandId,
      user_id: user.id,
      raw_text: parsed.data.raw_text,
      interpreted_summary: classification.interpreted_summary,
      source_type: "manual_addition",
      section_key: sectionKey,
      importance_level: classification.importance_level,
      must_include: classification.must_include,
      status: "pending_review",
    })
    .select(SELECT_COLUMNS)
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: insErr?.message ?? "No se pudo guardar la actualización." },
      { status: 500 },
    );
  }

  return NextResponse.json({ update: inserted as BrandKnowledgeUpdateRow }, { status: 201 });
}
