import type { SupabaseClient } from "@supabase/supabase-js";

export const FRAMEWORK_REVISION_NOTE_EVENT =
  "framework_revision_note_added" as const;

export const FRAMEWORK_REGENERATED_FROM_REVISION_EVENT =
  "framework_regenerated_from_revision_note" as const;

/** Regeneración sin body explícito pero arrastrando la última sugerencia del proyecto. */
export const FRAMEWORK_REGENERATED_WITH_CARRIED_REVISION_EVENT =
  "framework_regenerated_with_carried_revision_note" as const;

type ProjectEventRow = {
  payload: unknown;
  created_at: string;
};

function readPayloadId(
  payload: unknown,
  key: string,
): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const v = (payload as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function readPayloadRevisionNote(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const v = (payload as Record<string, unknown>).revision_note;
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * Valida que el evento de sugerencia pertenezca al proyecto y al marco origen.
 */
export async function fetchRevisionNoteEventForRegeneration(
  supabase: SupabaseClient,
  projectId: string,
  revisionNoteEventId: string,
  sourceVisibleFrameworkId: string,
): Promise<{ revision_note: string; event_id: string } | null> {
  const { data: ev, error } = await supabase
    .from("project_events")
    .select("id, event_type, payload")
    .eq("id", revisionNoteEventId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error || !ev) return null;
  if (ev.event_type !== FRAMEWORK_REVISION_NOTE_EVENT) return null;
  const p = ev.payload;
  const fid = readPayloadId(p, "visible_framework_id");
  if (fid !== sourceVisibleFrameworkId) return null;
  const note = readPayloadRevisionNote(p);
  if (!note) return null;
  return { revision_note: note, event_id: ev.id };
}

/**
 * Latest saved revision note for a given visible_framework row (by id).
 */
export type LatestFrameworkRevisionGuidance = {
  revision_note_event_id: string;
  revision_note: string;
  source_framework_id: string;
  source_framework_version: number;
  created_at: string;
};

/**
 * Última sugerencia final guardada en el proyecto (evento
 * `framework_revision_note_added` más reciente por `created_at`).
 */
export async function fetchLatestFrameworkRevisionGuidanceForProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<LatestFrameworkRevisionGuidance | null> {
  const { data: ev, error } = await supabase
    .from("project_events")
    .select("id, payload, created_at")
    .eq("project_id", projectId)
    .eq("event_type", FRAMEWORK_REVISION_NOTE_EVENT)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !ev) return null;

  const p = ev.payload;
  const fid = readPayloadId(p, "visible_framework_id");
  const note = readPayloadRevisionNote(p);
  if (!fid || !note) return null;

  const { data: fwRow, error: fwErr } = await supabase
    .from("visible_frameworks")
    .select("id, version")
    .eq("project_id", projectId)
    .eq("id", fid)
    .maybeSingle();

  if (fwErr) return null;

  const source_framework_version =
    fwRow &&
    typeof fwRow.version === "number" &&
    Number.isFinite(fwRow.version)
      ? fwRow.version
      : 0;

  const eventId = typeof ev.id === "string" && ev.id.length > 0 ? ev.id : "";
  if (!eventId) return null;

  return {
    revision_note_event_id: eventId,
    revision_note: note,
    source_framework_id: fid,
    source_framework_version,
    created_at: ev.created_at,
  };
}

export async function fetchLatestRevisionNoteForFramework(
  supabase: SupabaseClient,
  projectId: string,
  visibleFrameworkId: string,
): Promise<{ revision_note: string; created_at: string } | null> {
  const { data, error } = await supabase
    .from("project_events")
    .select("payload, created_at")
    .eq("project_id", projectId)
    .eq("event_type", FRAMEWORK_REVISION_NOTE_EVENT)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error || !data?.length) return null;

  for (const row of data as ProjectEventRow[]) {
    const fid = readPayloadId(row.payload, "visible_framework_id");
    if (fid !== visibleFrameworkId) continue;
    const note = readPayloadRevisionNote(row.payload);
    if (!note) continue;
    return { revision_note: note, created_at: row.created_at };
  }
  return null;
}
