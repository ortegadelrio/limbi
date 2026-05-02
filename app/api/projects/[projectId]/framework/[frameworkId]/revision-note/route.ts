import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import { FRAMEWORK_REVISION_NOTE_EVENT } from "@/lib/framework/revision-events";

type Params = { params: Promise<{ projectId: string; frameworkId: string }> };

const MIN_NOTE = 10;

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId, frameworkId } = await params;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return jsonNotFound();
  }

  const { data: fw, error: fwError } = await supabase
    .from("visible_frameworks")
    .select("id, project_id, version, status")
    .eq("id", frameworkId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (fwError) {
    return NextResponse.json({ error: fwError.message }, { status: 500 });
  }
  if (!fw) {
    return jsonNotFound();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const raw = (body as Record<string, unknown>).revision_note;
  if (typeof raw !== "string") {
    return NextResponse.json(
      { error: "revision_note debe ser un string." },
      { status: 400 },
    );
  }
  const revision_note = raw.trim();
  if (revision_note.length < MIN_NOTE) {
    return NextResponse.json(
      {
        error: `La sugerencia debe tener al menos ${String(MIN_NOTE)} caracteres.`,
      },
      { status: 400 },
    );
  }

  const version =
    typeof fw.version === "number" && Number.isFinite(fw.version)
      ? fw.version
      : 0;

  const created_at = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("project_events")
    .insert({
      project_id: projectId,
      user_id: user.id,
      event_type: FRAMEWORK_REVISION_NOTE_EVENT,
      payload: {
        project_id: projectId,
        visible_framework_id: frameworkId,
        framework_version: version,
        revision_note,
        created_at,
      },
    })
    .select("id, event_type, payload, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "No se pudo guardar la sugerencia." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    event: {
      id: inserted.id,
      event_type: inserted.event_type,
      payload: inserted.payload,
      created_at: inserted.created_at,
    },
  });
}
