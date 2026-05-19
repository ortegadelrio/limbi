import type { BrainstormerSessionProgressPayload } from "@/lib/schemas/brainstormer-session";
import type { BrainstormSessionSnapshotRow } from "@/types/database";

/**
 * Prioriza el snapshot devuelto por API; si solo viene session_progress, actualiza el payload local.
 */
export function applyTurnSnapshotUpdate(args: {
  previous: BrainstormSessionSnapshotRow | null;
  snapshotFromApi: BrainstormSessionSnapshotRow | null | undefined;
  sessionProgress: BrainstormerSessionProgressPayload | undefined;
  sessionId: string;
  userId: string;
}): BrainstormSessionSnapshotRow | null {
  if (args.snapshotFromApi) return args.snapshotFromApi;
  if (!args.sessionProgress) return args.previous;

  const created_at = new Date().toISOString();
  if (args.previous) {
    return {
      ...args.previous,
      snapshot_payload: args.sessionProgress as unknown as Record<string, unknown>,
      created_at,
    };
  }

  return {
    id: `local-${created_at}`,
    session_id: args.sessionId,
    user_id: args.userId,
    snapshot_kind: "strategic_summary",
    snapshot_payload: args.sessionProgress as unknown as Record<string, unknown>,
    created_at,
  };
}

export function isSnapshotNewer(
  a: BrainstormSessionSnapshotRow | null,
  b: BrainstormSessionSnapshotRow | null,
): boolean {
  if (!b) return false;
  if (!a) return true;
  return new Date(b.created_at).getTime() > new Date(a.created_at).getTime();
}
