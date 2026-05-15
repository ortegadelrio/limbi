import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFrozenBrandPayloadsForBrainstormSession } from "@/lib/brainstormer/load-frozen-brand-payloads-for-session";
import { mergeBrainstormerSessionProgress } from "@/lib/brainstormer/merge-brainstormer-session-progress";
import { generateBrainstormerTurnJson } from "@/lib/openai/brainstormer-session";
import {
  buildBrainstormerSessionSystemInstructions,
  buildBrainstormerSessionUserPayload,
} from "@/lib/prompts/brainstormer-session";
import {
  brainstormerTurnOutputSchema,
  coerceBrainstormerSessionProgress,
  type BrainstormerSessionProgressPayload,
} from "@/lib/schemas/brainstormer-session";
import type {
  BrainstormMessageRow,
  BrainstormSessionRow,
  BrainstormSessionSnapshotRow,
} from "@/types/database";

function truncateForPrompt(json: unknown, max: number): string {
  const s = JSON.stringify(json);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…(truncado por límite de contexto)`;
}

export type RunBrainstormerAssistantTurnResult =
  | {
      ok: true;
      messages: BrainstormMessageRow[];
      snapshot: BrainstormSessionSnapshotRow | null;
      session_progress: BrainstormerSessionProgressPayload;
    }
  | { ok: false; error: string; code: string };

/**
 * Tras insertar un mensaje `user` en la sesión, genera respuesta assistant + snapshot.
 * Si falla, elimina el mensaje de usuario indicado cuando aplica.
 */
export async function runBrainstormerAssistantTurnAfterUserMessage(args: {
  supabase: SupabaseClient;
  userId: string;
  session: BrainstormSessionRow;
  sessionId: string;
  userMessageId: string;
}): Promise<RunBrainstormerAssistantTurnResult> {
  const { supabase, userId, session, sessionId, userMessageId } = args;

  const frozen = await loadFrozenBrandPayloadsForBrainstormSession(supabase, session, userId);
  if (!frozen.ok) {
    await supabase.from("brainstorm_messages").delete().eq("id", userMessageId);
    return { ok: false, error: frozen.message, code: frozen.code };
  }

  const { data: history } = await supabase
    .from("brainstorm_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(60);

  const excerpt = (history ?? [])
    .map((m) => `${(m as { role: string }).role}: ${(m as { content: string }).content}`)
    .join("\n\n")
    .slice(-18_000);

  const { data: lastSnap } = await supabase
    .from("brainstorm_session_snapshots")
    .select("snapshot_payload")
    .eq("session_id", sessionId)
    .eq("snapshot_kind", "strategic_summary")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const progress = coerceBrainstormerSessionProgress(lastSnap?.snapshot_payload);

  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", session.brand_id)
    .maybeSingle();

  const brandName = String(brand?.name ?? "").trim() || "Marca";

  const knowledgeJson = truncateForPrompt(frozen.knowledge_payload ?? {}, 42_000);
  const limbicJson = truncateForPrompt(frozen.limbic_payload ?? {}, 24_000);

  const systemText = `${buildBrainstormerSessionSystemInstructions()}

FROZEN_ACTIVE_KNOWLEDGE_BASE_JSON (deep consolidated_payload — authoritative for strategy; NOT the /bases UI summary):
${knowledgeJson}

FROZEN_ACTIVE_LIMBIC_BASE_JSON (deep consolidated_payload — tone/atmosphere; symbolic):
${limbicJson}`;

  const userText = buildBrainstormerSessionUserPayload({
    brand_name: brandName,
    session_title: session.title,
    brand_context_status: session.brand_context_status,
    brand_context_has_pending_updates: session.brand_context_has_pending_updates,
    brand_context_blocking_reasons: Array.isArray(session.brand_context_blocking_reasons)
      ? (session.brand_context_blocking_reasons as string[])
      : [],
    session_summary_progress: progress,
    conversation_excerpt: excerpt,
  });

  const fullInput = `${systemText}\n\n---\n\n${userText}`;

  try {
    const { model_used, raw_json_text } = await generateBrainstormerTurnJson({
      input: fullInput,
    });

    const json = JSON.parse(raw_json_text) as unknown;
    const z = brainstormerTurnOutputSchema.safeParse(json);
    if (!z.success) {
      await supabase.from("brainstorm_messages").delete().eq("id", userMessageId);
      return {
        ok: false,
        error: `Salida IA inválida: ${z.error.message}`,
        code: "ia_schema_error",
      };
    }

    const merged = mergeBrainstormerSessionProgress(progress, z.data.session_progress);

    const { error: asstErr } = await supabase.from("brainstorm_messages").insert({
      session_id: sessionId,
      user_id: userId,
      role: "assistant",
      content: z.data.assistant_message,
      structured_extraction: {
        model_used,
        session_progress: z.data.session_progress,
      },
    });
    if (asstErr) {
      await supabase.from("brainstorm_messages").delete().eq("id", userMessageId);
      return { ok: false, error: asstErr.message, code: "assistant_insert_failed" };
    }

    const { error: snapErr } = await supabase.from("brainstorm_session_snapshots").insert({
      session_id: sessionId,
      user_id: userId,
      snapshot_kind: "strategic_summary",
      snapshot_payload: merged,
    });
    if (snapErr) {
      return { ok: false, error: snapErr.message, code: "snapshot_insert_failed" };
    }

    const summaryLine = merged.session_summary.trim().slice(0, 12_000);
    await supabase
      .from("brainstorm_sessions")
      .update({
        summary: summaryLine.length > 0 ? summaryLine : session.summary,
      })
      .eq("id", sessionId)
      .eq("user_id", userId);

    const { data: messages } = await supabase
      .from("brainstorm_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const { data: snapOut } = await supabase
      .from("brainstorm_session_snapshots")
      .select("*")
      .eq("session_id", sessionId)
      .eq("snapshot_kind", "strategic_summary")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      ok: true,
      messages: (messages ?? []) as BrainstormMessageRow[],
      snapshot: (snapOut ?? null) as BrainstormSessionSnapshotRow | null,
      session_progress: merged,
    };
  } catch (e) {
    await supabase.from("brainstorm_messages").delete().eq("id", userMessageId);
    const msg = e instanceof Error ? e.message : "Error al procesar el mensaje.";
    return { ok: false, error: msg, code: "brainstormer_message_failed" };
  }
}
