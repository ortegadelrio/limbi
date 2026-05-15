import { NextResponse } from "next/server";
import {
  auditBrainstormerContextForSession,
  isBrainstormerDebugContextEnabled,
} from "@/lib/brainstormer/audit-brainstormer-context";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import type { BrainstormSessionRow } from "@/types/database";

export const runtime = "nodejs";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: Params) {
  if (!isBrainstormerDebugContextEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  const audit = await auditBrainstormerContextForSession(
    supabase,
    sessionRow as BrainstormSessionRow,
    user.id,
  );

  if (!audit.ok) {
    return NextResponse.json({ error: audit.message, code: audit.code }, { status: 400 });
  }

  return NextResponse.json({
    debug: true,
    prompt_version_note:
      "Inspección del contexto que se enviaría a OpenAI. No incluye payloads completos ni llama al modelo.",
    ...audit.report,
  });
}
