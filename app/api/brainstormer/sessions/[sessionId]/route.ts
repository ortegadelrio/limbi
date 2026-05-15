import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { patchBrainstormerSessionBodySchema } from "@/lib/schemas/brainstormer-session";
import type { BrainstormSessionRow } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 30;

type Params = { params: Promise<{ sessionId: string }> };

async function getOwnedSession(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  userId: string,
  sessionId: string,
): Promise<BrainstormSessionRow | null> {
  const { data, error } = await supabase
    .from("brainstorm_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as BrainstormSessionRow;
}

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { sessionId } = await params;
  const session = await getOwnedSession(supabase, user.id, sessionId);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ data: brand }, { data: messages }, { data: snaps }] = await Promise.all([
    supabase.from("brands").select("id, name").eq("id", session.brand_id).maybeSingle(),
    supabase
      .from("brainstorm_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("brainstorm_session_snapshots")
      .select("*")
      .eq("session_id", sessionId)
      .eq("snapshot_kind", "strategic_summary")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const snapshot = snaps?.[0] ?? null;

  return NextResponse.json({
    session,
    brand: brand ? { id: brand.id, name: String(brand.name ?? "").trim() || "Marca" } : null,
    messages: messages ?? [],
    snapshot,
    frozen_context_note:
      "Esta sesión usa la versión de Base de Marca y Base Límbica guardada al crearla. Si consolidaste de nuevo, otras partes de Limbi verán la base nueva; aquí seguimos con esta versión hasta que exista «actualizar contexto de sesión».",
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { sessionId } = await params;
  const session = await getOwnedSession(supabase, user.id, sessionId);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonBadRequest("JSON inválido.", { code: "invalid_json", stage: "brainstormer" });
  }

  const parsed = patchBrainstormerSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest(parsed.error.message, { code: "validation_error", stage: "brainstormer" });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;

  if (Object.keys(patch).length === 0) {
    return jsonBadRequest("Sin cambios.", { code: "empty_patch", stage: "brainstormer" });
  }

  const { data: updated, error } = await supabase
    .from("brainstorm_sessions")
    .update(patch)
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? "No se pudo actualizar." }, { status: 500 });
  }

  return NextResponse.json({ session: updated });
}
