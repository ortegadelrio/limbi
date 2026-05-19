import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBrainstormerOpenAIInput } from "@/lib/brainstormer/build-brainstormer-openai-input";
import {
  extractDetectedBrandSignalsFromPayloads,
} from "@/lib/brainstormer/brand-signals-from-active-base";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director";
import { coerceConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/coerce-conversation-director-decision";
import type { ResolveConversationDirectorInput } from "@/lib/brainstormer/conversation-director/types";
import { loadFrozenBrandPayloadsForBrainstormSession } from "@/lib/brainstormer/load-frozen-brand-payloads-for-session";
import { enrichSessionProgressFromDirector } from "@/lib/brainstormer/enrich-session-progress-from-director";
import { mergeBrainstormerSessionProgress } from "@/lib/brainstormer/merge-brainstormer-session-progress";
import { generateBrainstormerTurnJson } from "@/lib/openai/brainstormer-session";
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
    .join("\n\n");

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

  const userMessages = (history ?? []).filter((m) => (m as { role: string }).role === "user");
  const lastUserContent =
    userMessages.length > 0
      ? String((userMessages[userMessages.length - 1] as { content: string }).content ?? "").trim()
      : "";

  const brandSignals = extractDetectedBrandSignalsFromPayloads(
    frozen.knowledge_payload,
    frozen.limbic_payload,
  );

  const directorInput: ResolveConversationDirectorInput = {
    user_message: lastUserContent,
    conversation_excerpt: excerpt,
    session_progress: {
      session_summary: progress.session_summary,
      current_challenge: progress.current_challenge,
      preliminary_objective: progress.preliminary_objective,
      project_readiness: progress.project_readiness,
      should_suggest_project_conversion: progress.should_suggest_project_conversion,
    },
    brand_signals: brandSignals,
    user_message_count: userMessages.length,
  };

  const conversationDirector = coerceConversationDirectorDecision(
    resolveConversationDirector(directorInput),
    directorInput,
  );

  const { full_input } = buildBrainstormerOpenAIInput({
    brand_name: brandName,
    session_title: session.title,
    brand_context_status: session.brand_context_status,
    brand_context_has_pending_updates: session.brand_context_has_pending_updates,
    brand_context_blocking_reasons: Array.isArray(session.brand_context_blocking_reasons)
      ? (session.brand_context_blocking_reasons as string[])
      : [],
    session_summary_progress: progress,
    conversation_excerpt: excerpt,
    conversation_director: conversationDirector,
    knowledge_payload: frozen.knowledge_payload,
    limbic_payload: frozen.limbic_payload,
  });

  try {
    const { model_used, raw_json_text } = await generateBrainstormerTurnJson({
      input: full_input,
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

    const merged = enrichSessionProgressFromDirector(
      mergeBrainstormerSessionProgress(progress, z.data.session_progress),
      conversationDirector,
      {
        conversation_excerpt: excerpt,
        user_message: lastUserContent,
        brand_signals: brandSignals,
      },
    );

    const { error: asstErr } = await supabase.from("brainstorm_messages").insert({
      session_id: sessionId,
      user_id: userId,
      role: "assistant",
      content: z.data.assistant_message,
      structured_extraction: {
        model_used,
        session_progress: z.data.session_progress,
        conversation_director: conversationDirector,
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
