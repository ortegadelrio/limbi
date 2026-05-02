import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import {
  buildVisibleFrameworkInput,
  type VisibleFrameworkRevisionContext,
} from "@/lib/framework/build-input";
import {
  FRAMEWORK_REGENERATED_FROM_REVISION_EVENT,
  FRAMEWORK_REGENERATED_WITH_CARRIED_REVISION_EVENT,
  fetchLatestFrameworkRevisionGuidanceForProject,
  fetchRevisionNoteEventForRegeneration,
} from "@/lib/framework/revision-events";
import { validateVisibleFrameworkJson } from "@/lib/framework/validate-framework-json";
import { generateVisibleFrameworkJson } from "@/lib/openai/visible-framework";
import { buildVisibleFrameworkPrompt } from "@/lib/prompts/visible-framework";

type Params = { params: Promise<{ projectId: string }> };

const NO_ACTIVE_MASTER =
  "Primero debes generar el Documento Maestro.";

const NEED_REVISION_EVENT =
  "Para regenerar desde una sugerencia, envía revision_note_event_id junto con source_framework_id.";

const INVALID_REVISION_EVENT =
  "El evento de sugerencia no es válido para este marco o no existe.";

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

  let sourceFrameworkId: string | undefined;
  let revisionNoteEventId: string | undefined;
  try {
    const raw = await request.json();
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      const sid = o.source_framework_id;
      if (typeof sid === "string" && sid.trim().length > 0) {
        sourceFrameworkId = sid.trim();
      }
      const rid = o.revision_note_event_id;
      if (typeof rid === "string" && rid.trim().length > 0) {
        revisionNoteEventId = rid.trim();
      }
    }
  } catch {
    // First-time generation: empty body is allowed.
  }

  if (sourceFrameworkId && !revisionNoteEventId) {
    return NextResponse.json({ error: NEED_REVISION_EVENT }, { status: 400 });
  }
  if (revisionNoteEventId && !sourceFrameworkId) {
    return NextResponse.json(
      { error: "source_framework_id es obligatorio con revision_note_event_id." },
      { status: 400 },
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, user_id, name_or_descriptor, name_status, challenge_type, main_challenge, status, created_at, updated_at",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return jsonNotFound();
  }

  const { data: activeMaster, error: masterError } = await supabase
    .from("master_documents")
    .select("id, version, document, status")
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();

  if (masterError) {
    return NextResponse.json({ error: masterError.message }, { status: 500 });
  }
  if (!activeMaster) {
    return NextResponse.json({ error: NO_ACTIVE_MASTER }, { status: 400 });
  }

  const document: Record<string, unknown> =
    activeMaster.document &&
    typeof activeMaster.document === "object" &&
    !Array.isArray(activeMaster.document)
      ? (activeMaster.document as Record<string, unknown>)
      : {};

  let revisionContext: VisibleFrameworkRevisionContext | undefined;

  let sourceMeta: { id: string; version: number } | null = null;

  let carriedForwardMeta: {
    revision_note_event_id: string;
    revision_note_created_at: string;
  } | null = null;

  const CARRIED_REVISION_INSTRUCTION =
    "This is the latest active framework refinement guidance for the project. Apply it as persistent strategic guidance unless contradicted by the active Master Document.";

  if (sourceFrameworkId && revisionNoteEventId) {
    const { data: sourceRow, error: sourceErr } = await supabase
      .from("visible_frameworks")
      .select("id, project_id, framework, version")
      .eq("id", sourceFrameworkId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (sourceErr) {
      return NextResponse.json({ error: sourceErr.message }, { status: 500 });
    }
    if (!sourceRow) {
      return NextResponse.json(
        { error: "Marco origen no encontrado." },
        { status: 404 },
      );
    }

    const verified = await fetchRevisionNoteEventForRegeneration(
      supabase,
      projectId,
      revisionNoteEventId,
      sourceFrameworkId,
    );
    if (!verified) {
      return NextResponse.json({ error: INVALID_REVISION_EVENT }, { status: 400 });
    }

    const fwRaw = sourceRow.framework;
    const priorVisibleFramework =
      fwRaw && typeof fwRaw === "object" && !Array.isArray(fwRaw)
        ? (fwRaw as Record<string, unknown>)
        : {};

    sourceMeta = {
      id: sourceRow.id,
      version:
        typeof sourceRow.version === "number" &&
        Number.isFinite(sourceRow.version)
          ? sourceRow.version
          : 0,
    };
    revisionContext = {
      source_visible_framework_id: sourceRow.id,
      revision_note: verified.revision_note,
      prior_visible_framework: priorVisibleFramework,
    };
  } else if (!sourceFrameworkId && !revisionNoteEventId) {
    const guidance = await fetchLatestFrameworkRevisionGuidanceForProject(
      supabase,
      projectId,
    );
    if (guidance) {
      const { data: priorRow, error: priorErr } = await supabase
        .from("visible_frameworks")
        .select("framework")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (priorErr) {
        return NextResponse.json({ error: priorErr.message }, { status: 500 });
      }

      const priorFw =
        priorRow?.framework &&
        typeof priorRow.framework === "object" &&
        !Array.isArray(priorRow.framework)
          ? (priorRow.framework as Record<string, unknown>)
          : {};

      revisionContext = {
        source_visible_framework_id: guidance.source_framework_id,
        revision_note: guidance.revision_note,
        prior_visible_framework: priorFw,
        revision_note_event_id: guidance.revision_note_event_id,
        carried_forward: true,
        instruction: CARRIED_REVISION_INSTRUCTION,
      };
      carriedForwardMeta = {
        revision_note_event_id: guidance.revision_note_event_id,
        revision_note_created_at: guidance.created_at,
      };
    }
  }

  const structured = buildVisibleFrameworkInput({
    project,
    masterDocument: {
      id: activeMaster.id,
      version: activeMaster.version,
      document,
    },
    revisionContext,
  });

  const prompt = buildVisibleFrameworkPrompt(structured);

  let model_used: string;
  let raw_json_text: string;
  try {
    const gen = await generateVisibleFrameworkJson(prompt);
    model_used = gen.model_used;
    raw_json_text = gen.raw_json_text;
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Error al llamar a OpenAI.";
    const status =
      msg.includes("OPENAI_API_KEY") || msg.includes("no está configurada")
        ? 503
        : 502;
    return NextResponse.json({ error: msg }, { status });
  }

  const validated = validateVisibleFrameworkJson(raw_json_text);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.message }, { status: 422 });
  }

  const { data: maxRow, error: maxError } = await supabase
    .from("visible_frameworks")
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) {
    return NextResponse.json({ error: maxError.message }, { status: 500 });
  }

  const nextVersion =
    typeof maxRow?.version === "number" ? maxRow.version + 1 : 1;

  const { data: inserted, error: insertError } = await supabase
    .from("visible_frameworks")
    .insert({
      project_id: projectId,
      user_id: user.id,
      master_document_id: activeMaster.id,
      version: nextVersion,
      framework: validated.framework,
      status: "draft",
    })
    .select("id, project_id, master_document_id, version, status, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      {
        error:
          insertError?.message ??
          "No se pudo guardar el marco estratégico visible.",
      },
      { status: 500 },
    );
  }

  const { error: projectUpdateError } = await supabase
    .from("projects")
    .update({ status: "framework_created" })
    .eq("id", projectId);

  if (projectUpdateError) {
    return NextResponse.json(
      { error: projectUpdateError.message },
      { status: 500 },
    );
  }

  const prompt_version = structured.generation_instructions.builder_version;

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: projectId,
    user_id: user.id,
    event_type: "framework_created",
    payload: {
      visible_framework_id: inserted.id,
      master_document_id: activeMaster.id,
      framework_version: inserted.version,
      master_document_version: activeMaster.version,
      model_used,
      prompt_version,
      project_id: projectId,
    },
  });

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  if (
    sourceFrameworkId &&
    revisionNoteEventId &&
    sourceMeta
  ) {
    const created_at = new Date().toISOString();
    const { error: regenEventError } = await supabase
      .from("project_events")
      .insert({
        project_id: projectId,
        user_id: user.id,
        event_type: FRAMEWORK_REGENERATED_FROM_REVISION_EVENT,
        payload: {
          project_id: projectId,
          source_framework_id: sourceMeta.id,
          source_framework_version: sourceMeta.version,
          revision_note_event_id: revisionNoteEventId,
          new_framework_id: inserted.id,
          new_framework_version: inserted.version,
          created_at,
        },
      });
    if (regenEventError) {
      return NextResponse.json(
        { error: regenEventError.message },
        { status: 500 },
      );
    }
  } else if (carriedForwardMeta) {
    const created_at = new Date().toISOString();
    const { error: carriedEventError } = await supabase
      .from("project_events")
      .insert({
        project_id: projectId,
        user_id: user.id,
        event_type: FRAMEWORK_REGENERATED_WITH_CARRIED_REVISION_EVENT,
        payload: {
          project_id: projectId,
          revision_note_event_id: carriedForwardMeta.revision_note_event_id,
          revision_note_created_at:
            carriedForwardMeta.revision_note_created_at,
          new_framework_id: inserted.id,
          new_framework_version: inserted.version,
          reason: "carried_forward_after_master_or_base_update",
          created_at,
        },
      });
    if (carriedEventError) {
      return NextResponse.json(
        { error: carriedEventError.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    {
      visible_framework: {
        id: inserted.id,
        project_id: inserted.project_id,
        master_document_id: inserted.master_document_id,
        version: inserted.version,
        status: inserted.status,
        created_at: inserted.created_at,
      },
    },
    { status: 201 },
  );
}
