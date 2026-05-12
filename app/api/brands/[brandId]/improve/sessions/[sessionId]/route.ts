import { NextResponse } from "next/server";
import { getAuthenticatedSupabase, jsonUnauthorized } from "@/lib/api/route-auth";
import type { BrandImprovementMessageRow, BrandImprovementSessionRow } from "@/types/database";

type Params = { params: Promise<{ brandId: string; sessionId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId, sessionId } = await params;

  const { data: session, error: sErr } = await supabase
    .from("brand_improvement_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (sErr || !session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: messages, error: mErr } = await supabase
    .from("brand_improvement_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  return NextResponse.json({
    session: session as BrandImprovementSessionRow,
    messages: (messages ?? []) as BrandImprovementMessageRow[],
  });
}
