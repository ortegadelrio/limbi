import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { prepareBrainstormSessionContext } from "@/lib/brainstormer/create-brainstorm-session-context";
import { runBrainstormerAssistantTurnAfterUserMessage } from "@/lib/brainstormer/run-brainstormer-assistant-turn";
import {
  postBrainstormerSessionBodySchema,
  emptyBrainstormerSessionProgress,
  BRAINSTORMER_SESSION_PROMPT_VERSION,
} from "@/lib/schemas/brainstormer-session";
import type { BrainstormSessionRow } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 120;

function jsonConflict(message: string, code: string) {
  return NextResponse.json({ error: message, code }, { status: 409 });
}

const LIMBI_OPENING =
  "Ya tengo el contexto aprobado de la marca. ¿Sobre qué reto quieres que pensemos hoy?";

export async function GET() {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { data: rows, error } = await supabase
    .from("brainstorm_sessions")
    .select(
      "id, brand_id, title, status, brand_context_status, updated_at, created_at, brand_context_has_pending_updates",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sessions = rows ?? [];
  if (sessions.length === 0) {
    return NextResponse.json({ sessions: [] });
  }

  const brandIds = [...new Set(sessions.map((s) => s.brand_id))];
  const { data: brands } = await supabase.from("brands").select("id, name").in("id", brandIds);
  const nameById = new Map((brands ?? []).map((b) => [b.id, String(b.name ?? "").trim() || "Marca"]));

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      ...s,
      brand_name: nameById.get(s.brand_id) ?? "Marca",
    })),
  });
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonBadRequest("JSON inválido.", { code: "invalid_json", stage: "brainstormer" });
  }

  const parsed = postBrainstormerSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest(parsed.error.message, { code: "validation_error", stage: "brainstormer" });
  }

  const { brand_id, title, initial_user_message } = parsed.data;

  const prep = await prepareBrainstormSessionContext(supabase, {
    userId: user.id,
    brandId: brand_id,
    title: title ?? undefined,
  });

  if (!prep.ok) {
    return NextResponse.json({ error: prep.message, code: prep.code }, { status: 404 });
  }

  if (!prep.can_start || prep.brand_context_status === "blocked") {
    return jsonConflict(
      "Esta marca todavía no tiene una Base de Marca activa suficiente para iniciar Brainstormer. Primero debes consolidar o actualizar la marca.",
      "brainstormer_context_blocked",
    );
  }

  const insertRow = {
    user_id: user.id,
    brand_id,
    title: prep.title,
    status: "open" as const,
    source_brand_knowledge_base_id: prep.source_brand_knowledge_base_id,
    source_brand_limbic_base_id: prep.source_brand_limbic_base_id,
    brand_knowledge_base_id_used: prep.brand_knowledge_base_id_used,
    brand_limbic_base_id_used: prep.brand_limbic_base_id_used,
    brand_context_generated_at: prep.brand_context_generated_at,
    brand_context_status: prep.brand_context_status,
    brand_context_blocking_reasons: prep.brand_context_blocking_reasons,
    brand_context_has_pending_updates: prep.brand_context_has_pending_updates,
    suggested_project_type: {},
    source_brand_context: prep.source_brand_context,
    summary: "",
  };

  const { data: session, error: insErr } = await supabase
    .from("brainstorm_sessions")
    .insert(insertRow)
    .select("*")
    .single();

  if (insErr || !session) {
    return NextResponse.json(
      { error: insErr?.message ?? "No se pudo crear la sesión." },
      { status: 500 },
    );
  }

  const sessionId = (session as BrainstormSessionRow).id;

  const advisoryNotice =
    prep.brand_context_status === "advisory"
      ? "Puedes iniciar la sesión, pero hay información pendiente o señales de desactualización en la marca. Brainstormer usará la versión activa actual."
      : null;

  const initialProgress = emptyBrainstormerSessionProgress();

  const { error: snapErr } = await supabase.from("brainstorm_session_snapshots").insert({
    session_id: sessionId,
    user_id: user.id,
    snapshot_kind: "strategic_summary",
    snapshot_payload: initialProgress,
  });
  if (snapErr) {
    await supabase.from("brainstorm_sessions").delete().eq("id", sessionId);
    return NextResponse.json({ error: snapErr.message }, { status: 500 });
  }

  const { error: gErr } = await supabase.from("brainstorm_messages").insert({
    session_id: sessionId,
    user_id: user.id,
    role: "assistant",
    content: LIMBI_OPENING,
    structured_extraction: {
      prompt_version: BRAINSTORMER_SESSION_PROMPT_VERSION,
      kind: "session_opening",
    },
  });
  if (gErr) {
    await supabase.from("brainstorm_sessions").delete().eq("id", sessionId);
    return NextResponse.json({ error: gErr.message }, { status: 500 });
  }

  if (initial_user_message?.trim()) {
    const { data: u0, error: u0Err } = await supabase
      .from("brainstorm_messages")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role: "user",
        content: initial_user_message.trim(),
        structured_extraction: {},
      })
      .select("id")
      .single();
    if (u0Err || !u0) {
      await supabase.from("brainstorm_sessions").delete().eq("id", sessionId);
      return NextResponse.json({ error: u0Err?.message ?? "No se pudo guardar el mensaje." }, { status: 500 });
    }
    const userMessageId = (u0 as { id: string }).id;
    const turn = await runBrainstormerAssistantTurnAfterUserMessage({
      supabase,
      userId: user.id,
      session: session as BrainstormSessionRow,
      sessionId,
      userMessageId,
    });
    if (!turn.ok) {
      await supabase.from("brainstorm_sessions").delete().eq("id", sessionId);
      const status =
        turn.code === "ia_schema_error"
          ? 502
          : turn.code === "forbidden" ||
              turn.code === "missing_base_rows" ||
              turn.code === "invalid_brand_scope"
            ? 400
            : 500;
      return NextResponse.json({ error: turn.error, code: turn.code }, { status });
    }
  }

  const { data: messages } = await supabase
    .from("brainstorm_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    session,
    messages: messages ?? [],
    advisory_notice: advisoryNotice,
    recommended_warning: prep.recommended_warning,
  });
}
