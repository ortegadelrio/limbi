import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { runBrainstormerAssistantTurnAfterUserMessage } from "@/lib/brainstormer/run-brainstormer-assistant-turn";
import { postBrainstormerMessageBodySchema } from "@/lib/schemas/brainstormer-session";
import type { BrainstormSessionRow } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { sessionId } = await params;

  const { data: sessionRow, error: sErr } = await supabase
    .from("brainstorm_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sErr || !sessionRow) {
    return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });
  }

  const session = sessionRow as BrainstormSessionRow;

  if (session.status === "closed" || session.status === "converted_to_project_base") {
    return NextResponse.json(
      { error: "Esta sesión está cerrada.", code: "session_closed" },
      { status: 409 },
    );
  }

  if (session.status === "paused") {
    return NextResponse.json(
      {
        error: "La sesión está pausada. Reactívala desde el panel de la sesión para continuar.",
        code: "session_paused",
      },
      { status: 409 },
    );
  }

  if (session.brand_context_status === "blocked") {
    return NextResponse.json(
      {
        error:
          "Esta sesión no puede continuar: el contexto de marca quedó bloqueado al crearla.",
        code: "context_blocked",
      },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonBadRequest("JSON inválido.", { code: "invalid_json", stage: "brainstormer" });
  }

  const parsedBody = postBrainstormerMessageBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonBadRequest(parsedBody.error.message, {
      code: "validation_error",
      stage: "brainstormer",
    });
  }

  const userContent = parsedBody.data.content.trim();

  const { data: userIns, error: userInsErr } = await supabase
    .from("brainstorm_messages")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      role: "user",
      content: userContent,
      structured_extraction: {},
    })
    .select("id")
    .single();

  if (userInsErr || !userIns) {
    return NextResponse.json(
      { error: userInsErr?.message ?? "No se pudo guardar el mensaje." },
      { status: 500 },
    );
  }
  const userMessageId = (userIns as { id: string }).id;

  const turn = await runBrainstormerAssistantTurnAfterUserMessage({
    supabase,
    userId: user.id,
    session,
    sessionId,
    userMessageId,
  });

  if (!turn.ok) {
    const status =
      turn.code === "ia_schema_error"
        ? 502
        : turn.code === "forbidden" || turn.code === "missing_base_rows" || turn.code === "invalid_brand_scope"
          ? 400
          : 500;
    return NextResponse.json({ error: turn.error, code: turn.code }, { status });
  }

  return NextResponse.json({
    messages: turn.messages,
    snapshot: turn.snapshot,
    session_progress: turn.session_progress,
  });
}
