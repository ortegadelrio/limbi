import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FRAMEWORK_REGENERATED_FROM_REVISION_EVENT,
  FRAMEWORK_REVISION_NOTE_EVENT,
} from "@/lib/framework/revision-events";

export type RevisionHistoryEntry = {
  revision_note_event_id: string;
  revision_note: string;
  source_framework_id: string;
  source_framework_version: number;
  new_framework_id: string;
  new_framework_version: number;
  created_at: string;
};

function readPayloadString(payload: unknown, key: string): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const v = (payload as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function readPayloadNumber(payload: unknown, key: string): number | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const v = (payload as Record<string, unknown>)[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function readRevisionNoteFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }
  const v = (payload as Record<string, unknown>).revision_note;
  return typeof v === "string" ? v.trim() : "";
}

type RegenEventRow = {
  payload: unknown;
  created_at: string;
};

/**
 * Historial de regeneraciones desde sugerencia, más reciente primero (máx. `limit`).
 * Une `framework_regenerated_from_revision_note` con el texto de
 * `framework_revision_note_added` vía `revision_note_event_id`.
 */
export async function fetchFrameworkRevisionHistory(
  supabase: SupabaseClient,
  projectId: string,
  limit = 20,
): Promise<RevisionHistoryEntry[]> {
  const { data: regenRows, error: regenErr } = await supabase
    .from("project_events")
    .select("payload, created_at")
    .eq("project_id", projectId)
    .eq("event_type", FRAMEWORK_REGENERATED_FROM_REVISION_EVENT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (regenErr || !regenRows?.length) return [];

  const noteIds = new Set<string>();
  for (const row of regenRows as RegenEventRow[]) {
    const id = readPayloadString(row.payload, "revision_note_event_id");
    if (id) noteIds.add(id);
  }

  const noteMap = new Map<string, string>();
  if (noteIds.size > 0) {
    const { data: noteRows, error: noteErr } = await supabase
      .from("project_events")
      .select("id, event_type, payload")
      .eq("project_id", projectId)
      .in("id", [...noteIds]);

    if (!noteErr && noteRows) {
      for (const row of noteRows) {
        if (row.event_type !== FRAMEWORK_REVISION_NOTE_EVENT) continue;
        const id = typeof row.id === "string" ? row.id : "";
        if (!id) continue;
        const text = readRevisionNoteFromPayload(row.payload);
        if (text) noteMap.set(id, text);
      }
    }
  }

  const out: RevisionHistoryEntry[] = [];
  for (const row of regenRows as RegenEventRow[]) {
    const p = row.payload;
    const revision_note_event_id =
      readPayloadString(p, "revision_note_event_id") ?? "";
    const source_framework_id = readPayloadString(p, "source_framework_id") ?? "";
    const new_framework_id = readPayloadString(p, "new_framework_id") ?? "";
    if (!source_framework_id || !new_framework_id) continue;

    const revision_note = revision_note_event_id
      ? (noteMap.get(revision_note_event_id) ?? "")
      : "";

    const source_framework_version =
      readPayloadNumber(p, "source_framework_version") ?? 0;
    const new_framework_version =
      readPayloadNumber(p, "new_framework_version") ?? 0;

    out.push({
      revision_note_event_id,
      revision_note,
      source_framework_id,
      source_framework_version,
      new_framework_id,
      new_framework_version,
      created_at: row.created_at,
    });
  }

  return out;
}
