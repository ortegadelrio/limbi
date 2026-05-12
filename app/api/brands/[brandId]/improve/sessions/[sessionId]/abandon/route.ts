import { NextResponse } from "next/server";
import { getAuthenticatedSupabase, jsonUnauthorized } from "@/lib/api/route-auth";
import type { BrandImprovementSessionRow } from "@/types/database";

type Params = { params: Promise<{ brandId: string; sessionId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId, sessionId } = await params;

  const { data: sessionRow, error: sErr } = await supabase
    .from("brand_improvement_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (sErr || !sessionRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = sessionRow as BrandImprovementSessionRow;

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (session.status !== "open" && session.status !== "draft_ready") {
    return NextResponse.json({ ok: true, session });
  }

  const { data: updated, error: uErr } = await supabase
    .from("brand_improvement_sessions")
    .update({
      status: "abandoned",
      closed_reason: "user_abandoned",
    })
    .eq("id", sessionId)
    .select("*")
    .single();

  if (uErr || !updated) {
    return NextResponse.json({ error: uErr?.message ?? "Error" }, { status: 500 });
  }

  return NextResponse.json({ session: updated as BrandImprovementSessionRow });
}
