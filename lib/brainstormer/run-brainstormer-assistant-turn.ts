import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBrainstormerOpenAIInput } from "@/lib/brainstormer/build-brainstormer-openai-input";
import {
  applyConversationContractToDirector,
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  buildWorkingBriefPromptBlock,
  extractWorkingBriefFromProgress,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { interpretBrainstormerTurn } from "@/lib/brainstormer/interpret-brainstormer-turn";
import { buildCompactThinkingModelPromptBlock } from "@/lib/ai/thinking-models";
import {
  resolveThinkingForSessionTurn,
  thinkingModelFieldsForSessionUpdate,
} from "@/lib/brainstormer/session-thinking-model";
import {
  extractDetectedBrandSignalsFromPayloads,
} from "@/lib/brainstormer/brand-signals-from-active-base";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director";
import { coerceConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/coerce-conversation-director-decision";
import type { ResolveConversationDirectorInput } from "@/lib/brainstormer/conversation-director/types";
import {
  assistantMessageAlreadyIncludesBrandBaseUpdateNotice,
  BRAND_BASE_UPDATED_SESSION_NOTICE_ES,
} from "@/lib/brainstormer/brainstormer-brand-base-updated-notice";
import {
  isResolveBrainstormBrandContextError,
  resolveBrainstormBrandContextForTurn,
} from "@/lib/brainstormer/resolve-brainstorm-brand-context-for-turn";
import { enrichSessionProgressFromDirector } from "@/lib/brainstormer/enrich-session-progress-from-director";
import {
  mergeBrainstormerSessionProgress,
  resolveWorkingBriefForSessionMerge,
} from "@/lib/brainstormer/merge-brainstormer-session-progress";
import {
  generateBrainstormerOutputRepair,
  generateBrainstormerTurnJson,
} from "@/lib/openai/brainstormer-session";
import { buildBrainstormerOutputFallback } from "@/lib/brainstormer/build-brainstormer-output-fallback";
import { ensureUserFacingAssistantMessage } from "@/lib/brainstormer/sanitize-visible-assistant-message";
import { handleSpecialBrainstormerTurn } from "@/lib/brainstormer/handle-special-brainstormer-turn";
import { applyBrainstormerOutputQualityGate } from "@/lib/brainstormer/validate-brainstormer-output-quality";
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

  const brandCtx = await resolveBrainstormBrandContextForTurn(supabase, session, userId);
  if (isResolveBrainstormBrandContextError(brandCtx)) {
    await supabase.from("brainstorm_messages").delete().eq("id", userMessageId);
    return { ok: false, error: brandCtx.message, code: brandCtx.code };
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
    brandCtx.knowledge_payload,
    brandCtx.limbic_payload,
  );

  const shouldPrependBrandUpdateNotice =
    brandCtx.brand_base_updated_since_session_freeze &&
    !assistantMessageAlreadyIncludesBrandBaseUpdateNotice(history ?? []);

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

  const directorBase = coerceConversationDirectorDecision(
    resolveConversationDirector(directorInput),
    directorInput,
  );

  const thinkingResolved = resolveThinkingForSessionTurn({
    session,
    lastUserMessage: lastUserContent,
    currentChallenge: progress.current_challenge,
  });
  const thinking_model_block = buildCompactThinkingModelPromptBlock({ resolved: thinkingResolved });

  const priorBrief = extractWorkingBriefFromProgress(progress);
  const { interpretation: turnInterpretation } = await interpretBrainstormerTurn({
    last_user_message: lastUserContent,
    conversation_excerpt: excerpt,
    working_brief: priorBrief,
    thinking_model_key: thinkingResolved.primaryKey,
    brand_name: brandName,
  });
  const updatedBrief = updateBrainstormerWorkingBrief({
    prior: priorBrief,
    userMessage: lastUserContent,
    conversationExcerpt: excerpt,
    interpretation: turnInterpretation,
  });
  const contract = buildConversationContractForTurn({
    brief: updatedBrief,
    userMessage: lastUserContent,
    conversationExcerpt: excerpt,
    director: directorBase,
    thinkingPrimaryKey: thinkingResolved.primaryKey,
    brandCredibilityAssets: brandSignals.credibility_assets,
    interpretation: turnInterpretation,
  });
  const conversationDirector = applyConversationContractToDirector(directorBase, contract);

  const specialTurn = await handleSpecialBrainstormerTurn({
    interpretation: turnInterpretation,
    last_user_message: lastUserContent,
    progress,
    working_brief: updatedBrief,
    brand_name: brandName,
  });

  const brandContextInternalNote = brandCtx.brand_base_updated_since_session_freeze
    ? "Contexto de marca: la Base de Marca activa fue actualizada respecto al inicio de sesión; priorizar ADN y memoria de sesión (paraguas/decisiones confirmadas) sin reabrir rutas ya cerradas."
    : null;

  const { full_input, brand_dna_block } = buildBrainstormerOpenAIInput({
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
    conversation_contract_turn: contract,
    knowledge_payload: brandCtx.knowledge_payload,
    limbic_payload: brandCtx.limbic_payload,
    working_brief: updatedBrief,
    working_brief_block: buildWorkingBriefPromptBlock(updatedBrief),
    conversation_contract_block: buildConversationContractPromptBlock(contract),
    thinking_model_block,
    last_user_message: lastUserContent,
    brand_context_internal_note: brandContextInternalNote,
  });

  try {
    let assistantContent: string;
    let merged: BrainstormerSessionProgressPayload;
    let model_used = "brainstormer-session";
    let structuredExtraction: Record<string, unknown>;

    if (specialTurn.handled) {
      const persistedBrief = resolveWorkingBriefForSessionMerge({
        priorProgress: progress,
        serverBrief: updatedBrief,
      });
      merged = mergeBrainstormerSessionProgress(progress, {
        ...progress,
        ...specialTurn.progress_patch,
        working_brief: persistedBrief,
      });
      merged = enrichSessionProgressFromDirector(merged, conversationDirector, {
        conversation_excerpt: excerpt,
        user_message: lastUserContent,
        brand_signals: brandSignals,
      });

      const userFacing = ensureUserFacingAssistantMessage({
        message: specialTurn.assistant_message,
        buildSafeFallback: () => specialTurn.assistant_message,
      });
      assistantContent = userFacing.message;
      model_used = "brainstormer-special-turn";
      structuredExtraction = {
        model_used,
        turn_interpretation: turnInterpretation,
        conversation_director: conversationDirector,
        conversation_contract: {
          turn_intent: contract.turn_intent,
          effective_closing_question: contract.effective_closing_question,
        },
        ...specialTurn.structured_extra,
      };
    } else {
      const { model_used: openaiModel, raw_json_text } = await generateBrainstormerTurnJson({
        input: full_input,
      });
      model_used = openaiModel;

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

      const persistedBrief = resolveWorkingBriefForSessionMerge({
        priorProgress: progress,
        serverBrief: updatedBrief,
        modelWorkingBrief: z.data.session_progress.working_brief,
      });
      const mergedBase = mergeBrainstormerSessionProgress(progress, {
        ...z.data.session_progress,
        working_brief: persistedBrief,
      });
      merged = enrichSessionProgressFromDirector(mergedBase, conversationDirector, {
        conversation_excerpt: excerpt,
        user_message: lastUserContent,
        brand_signals: brandSignals,
      });

      const qualityGate = await applyBrainstormerOutputQualityGate({
        assistant_message: z.data.assistant_message,
        turn_intent: contract.turn_intent,
        thinking_model_key: thinkingResolved.selectedKey,
        resolved_primary_model_key: thinkingResolved.primaryKey,
        working_brief: updatedBrief,
        last_user_message: lastUserContent,
        working_brief_block: buildWorkingBriefPromptBlock(updatedBrief),
        thinking_model_block,
        brand_dna: brand_dna_block,
        brand_name: brandName,
        turn_interpretation: turnInterpretation,
        generateRepair: generateBrainstormerOutputRepair,
      });

      if (qualityGate.fallback_used) {
        // eslint-disable-next-line no-console
        console.warn("[brainstormer] output fallback used", {
          issues: qualityGate.pre_repair_issues,
          remaining: qualityGate.quality.issues,
        });
      } else if (qualityGate.repair_still_failed) {
        // eslint-disable-next-line no-console
        console.warn(
          "[brainstormer] output repair still failed:",
          qualityGate.quality.issues,
        );
      } else if (!qualityGate.quality.ok && process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[brainstormer] output quality issues:", qualityGate.quality.issues);
      }

      const userFacing = ensureUserFacingAssistantMessage({
        message: qualityGate.assistant_message,
        buildSafeFallback: () =>
          buildBrainstormerOutputFallback(
            {
              turn_intent: contract.turn_intent,
              thinking_model_key: thinkingResolved.selectedKey,
              resolved_primary_model_key: thinkingResolved.primaryKey,
              working_brief: updatedBrief,
              last_user_message: lastUserContent,
              interpretation: turnInterpretation,
            },
            { brand_dna: brand_dna_block, brand_name: brandName },
          ),
      });
      if (userFacing.replaced) {
        // eslint-disable-next-line no-console
        console.warn("[brainstormer] user-facing sanitize before persist", {
          issues: userFacing.issues,
          used_absolute_safe: userFacing.usedAbsoluteSafe,
        });
      }

      assistantContent = userFacing.message;
      structuredExtraction = {
        model_used,
        session_progress: z.data.session_progress,
        conversation_director: conversationDirector,
        conversation_contract: {
          turn_intent: contract.turn_intent,
          effective_closing_question: contract.effective_closing_question,
        },
        output_quality: {
          ok: qualityGate.quality.ok,
          issues: qualityGate.quality.issues,
          repair_attempted: qualityGate.repair_attempted,
          repair_used: qualityGate.repair_used,
          repair_still_failed: qualityGate.repair_still_failed,
          fallback_used: qualityGate.fallback_used,
          pre_repair_issues: qualityGate.pre_repair_issues,
        },
      };
    }

    if (shouldPrependBrandUpdateNotice) {
      assistantContent = `${BRAND_BASE_UPDATED_SESSION_NOTICE_ES}\n\n${assistantContent}`;
    }

    const { error: asstErr } = await supabase.from("brainstorm_messages").insert({
      session_id: sessionId,
      user_id: userId,
      role: "assistant",
      content: assistantContent,
      structured_extraction: structuredExtraction,
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
        ...thinkingModelFieldsForSessionUpdate(thinkingResolved),
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
