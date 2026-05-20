import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBrainstormerOpenAIInput } from "@/lib/brainstormer/build-brainstormer-openai-input";
import {
  extractDetectedBrandSignalsFromPayloads,
  type BrainstormerDetectedBrandSignals,
} from "@/lib/brainstormer/brand-signals-from-active-base";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director";
import { loadFrozenBrandPayloadsForBrainstormSession } from "@/lib/brainstormer/load-frozen-brand-payloads-for-session";
import {
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  buildWorkingBriefPromptBlock,
  extractWorkingBriefFromProgress,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { buildThinkingModelBlockForSessionTurn } from "@/lib/brainstormer/session-thinking-model";
import {
  assessKnowledgePayloadForProjectContract,
  assessLimbicPayloadForProjectContract,
} from "@/lib/brands/load-active-brand-context-for-project";
import { loadBrandBasesDetailState } from "@/lib/brands/load-brand-bases-state";
import { coerceBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";
import type { BrainstormSessionRow } from "@/types/database";

export function isBrainstormerDebugContextEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return process.env.BRAINSTORMER_DEBUG_CONTEXT === "true";
  }
  return process.env.BRAINSTORMER_DEBUG_CONTEXT !== "false";
}

export type { BrainstormerDetectedBrandSignals } from "@/lib/brainstormer/brand-signals-from-active-base";
export { extractDetectedBrandSignalsFromPayloads } from "@/lib/brainstormer/brand-signals-from-active-base";

export type BrainstormerContextAuditReport = {
  session_id: string;
  brand_id: string;
  brand_name: string;
  brand_knowledge_base_id_used: string | null;
  brand_limbic_base_id_used: string | null;
  brand_context_status: string;
  knowledge_payload_present: boolean;
  limbic_payload_present: boolean;
  knowledge_payload_character_count: number;
  limbic_payload_character_count: number;
  contains_audiences: boolean;
  contains_offer: boolean;
  contains_value_proposition: boolean;
  contains_differentiators: boolean;
  contains_tone: boolean;
  contains_credibility_assets: boolean;
  contains_guardrails: boolean;
  contains_limbic_cues: boolean;
  possible_truncation: boolean;
  knowledge_truncated_in_prompt: boolean;
  limbic_truncated_in_prompt: boolean;
  top_level_knowledge_keys: string[];
  top_level_limbic_keys: string[];
  knowledge_contract_gaps: string[];
  limbic_contract_gaps: string[];
  frozen_base_alignment: {
    knowledge_matches_current_active: boolean | null;
    limbic_matches_current_active: boolean | null;
    current_active_knowledge_base_id: string | null;
    current_active_limbic_base_id: string | null;
  };
  prompt_assembly: {
    full_input_character_count: number;
    system_instructions_character_count: number;
    brand_signals_block_character_count: number;
    knowledge_in_prompt_character_count: number;
    limbic_in_prompt_character_count: number;
    user_payload_character_count: number;
    conversation_excerpt_character_count: number;
    conversation_excerpt_truncated: boolean;
    message_count_in_excerpt: number;
  };
  detected_brand_signals: BrainstormerDetectedBrandSignals;
  warnings: string[];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function sectionInterpretation(
  payload: Record<string, unknown> | null,
  sectionKey: string,
): string | null {
  if (!payload) return null;
  const sections = payload.section_interpretations;
  if (!Array.isArray(sections)) return null;
  for (const row of sections) {
    const r =
      row && typeof row === "object" && !Array.isArray(row)
        ? (row as Record<string, unknown>)
        : null;
    if (r?.section_key === sectionKey) {
      const headline = typeof r.headline === "string" ? r.headline.trim() : "";
      const interpretation = typeof r.interpretation === "string" ? r.interpretation.trim() : "";
      const combined = [headline, interpretation].filter(Boolean).join(" — ");
      return combined.length > 0 ? combined : null;
    }
  }
  return null;
}

function hasSection(payload: Record<string, unknown> | null, sectionKey: string): boolean {
  const s = sectionInterpretation(payload, sectionKey);
  return Boolean(s && s.length > 20);
}

export async function auditBrainstormerContextForSession(
  supabase: SupabaseClient,
  session: BrainstormSessionRow,
  userId: string,
): Promise<
  | { ok: true; report: BrainstormerContextAuditReport }
  | { ok: false; code: string; message: string }
> {
  const warnings: string[] = [];

  const { data: brandRow } = await supabase
    .from("brands")
    .select("name")
    .eq("id", session.brand_id)
    .eq("user_id", userId)
    .maybeSingle();

  const brandName = String(brandRow?.name ?? "").trim() || "Marca";

  const frozen = await loadFrozenBrandPayloadsForBrainstormSession(supabase, session, userId);
  if (!frozen.ok) {
    return { ok: false, code: frozen.code, message: frozen.message };
  }

  const knowledge = frozen.knowledge_payload;
  const limbic = frozen.limbic_payload;

  const knowledgeChar = knowledge ? JSON.stringify(knowledge).length : 0;
  const limbicChar = limbic ? JSON.stringify(limbic).length : 0;

  const kContract = assessKnowledgePayloadForProjectContract(knowledge);
  const lContract = assessLimbicPayloadForProjectContract(limbic);

  const contains_audiences = hasSection(knowledge, "audiences");
  const contains_offer =
    Boolean(asRecord(knowledge?.offer_architecture)) || hasSection(knowledge, "offer");
  const contains_value_proposition = hasSection(knowledge, "value_proposition");
  const contains_differentiators = hasSection(knowledge, "differentiators");
  const contains_tone = hasSection(knowledge, "voice_tone");
  const contains_credibility_assets =
    extractDetectedBrandSignalsFromPayloads(knowledge, limbic).credibility_assets.length > 0;
  const contains_guardrails =
    (typeof knowledge?.restrictions_and_alerts === "string" &&
      knowledge.restrictions_and_alerts.trim().length > 20) ||
    hasSection(knowledge, "restrictions");
  const contains_limbic_cues = lContract.gaps.length === 0;

  let currentActiveKnowledgeId: string | null = null;
  let currentActiveLimbicId: string | null = null;
  try {
    const basesState = await loadBrandBasesDetailState(supabase, session.brand_id);
    currentActiveKnowledgeId = basesState.knowledge_base?.id ?? null;
    currentActiveLimbicId = basesState.limbic_base?.id ?? null;
  } catch {
    warnings.push("No se pudo cargar el estado de bases activas para comparar con la sesión congelada.");
  }

  const kid = session.brand_knowledge_base_id_used;
  const lid = session.brand_limbic_base_id_used;

  const { data: messages } = await supabase
    .from("brainstorm_messages")
    .select("role, content")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true })
    .limit(60);

  const excerptFull = (messages ?? [])
    .map((m) => `${(m as { role: string }).role}: ${(m as { content: string }).content}`)
    .join("\n\n");

  const { data: lastSnap } = await supabase
    .from("brainstorm_session_snapshots")
    .select("snapshot_payload")
    .eq("session_id", session.id)
    .eq("snapshot_kind", "strategic_summary")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const progress = coerceBrainstormerSessionProgress(lastSnap?.snapshot_payload);

  const userMessages = (messages ?? []).filter((m) => (m as { role: string }).role === "user");
  const lastUserContent =
    userMessages.length > 0
      ? String((userMessages[userMessages.length - 1] as { content: string }).content ?? "").trim()
      : "";
  const detected = extractDetectedBrandSignalsFromPayloads(knowledge, limbic);
  const conversationDirector = resolveConversationDirector({
    user_message: lastUserContent,
    conversation_excerpt: excerptFull,
    session_progress: {
      session_summary: progress.session_summary,
      current_challenge: progress.current_challenge,
      preliminary_objective: progress.preliminary_objective,
      project_readiness: progress.project_readiness,
      should_suggest_project_conversion: progress.should_suggest_project_conversion,
    },
    brand_signals: detected,
    user_message_count: userMessages.length,
  });

  const { block: thinking_model_block } = buildThinkingModelBlockForSessionTurn({
    session,
    lastUserMessage: lastUserContent,
    currentChallenge: progress.current_challenge,
  });

  const priorBrief = extractWorkingBriefFromProgress(progress);
  const updatedBrief = updateBrainstormerWorkingBrief({
    prior: priorBrief,
    userMessage: lastUserContent,
    conversationExcerpt: excerptFull,
  });
  const contract = buildConversationContractForTurn({
    brief: updatedBrief,
    userMessage: lastUserContent,
    conversationExcerpt: excerptFull,
    director: conversationDirector,
  });

  const prompt = buildBrainstormerOpenAIInput({
    brand_name: brandName,
    session_title: session.title,
    brand_context_status: session.brand_context_status,
    brand_context_has_pending_updates: session.brand_context_has_pending_updates,
    brand_context_blocking_reasons: Array.isArray(session.brand_context_blocking_reasons)
      ? (session.brand_context_blocking_reasons as string[])
      : [],
    session_summary_progress: progress,
    conversation_excerpt: excerptFull,
    conversation_director: conversationDirector,
    conversation_contract_turn: contract,
    knowledge_payload: knowledge,
    limbic_payload: limbic,
    working_brief: updatedBrief,
    working_brief_block: buildWorkingBriefPromptBlock(updatedBrief),
    conversation_contract_block: buildConversationContractPromptBlock(contract),
    thinking_model_block,
    last_user_message: lastUserContent,
  });

  const possible_truncation =
    prompt.knowledge_truncated_in_prompt ||
    prompt.limbic_truncated_in_prompt ||
    prompt.brand_dna_character_count >= 1_500;

  if (!knowledge) warnings.push("knowledge_payload ausente o inválido en la fila congelada.");
  if (!limbic) warnings.push("limbic_payload ausente o inválido en la fila congelada.");
  if (possible_truncation) {
    warnings.push(
      "El JSON enviado a OpenAI está truncado; el modelo puede no ver audiencias/oferta/diferenciadores al final del payload.",
    );
  }
  if (kContract.gaps.length > 0) {
    warnings.push(`Contrato de knowledge payload incompleto: ${kContract.gaps.join(", ")}`);
  }
  if (lContract.gaps.length > 0) {
    warnings.push(`Contrato de limbic payload incompleto: ${lContract.gaps.join(", ")}`);
  }
  if (!contains_audiences) {
    warnings.push("No se detectó sección audiences con contenido sustantivo en consolidated_payload.");
  }
  if (!contains_value_proposition) {
    warnings.push("No se detectó value_proposition en section_interpretations.");
  }
  if (!contains_differentiators) {
    warnings.push("No se detectó differentiators en section_interpretations.");
  }
  if (
    currentActiveKnowledgeId &&
    kid &&
    currentActiveKnowledgeId !== kid
  ) {
    warnings.push(
      "La base de conocimiento congelada en la sesión NO coincide con la base activa actual de la marca.",
    );
  }
  if (currentActiveLimbicId && lid && currentActiveLimbicId !== lid) {
    warnings.push(
      "La base límbica congelada en la sesión NO coincide con la base activa actual de la marca.",
    );
  }
  if (knowledgeChar > 0 && knowledgeChar < 500) {
    warnings.push("knowledge_payload muy pequeño; puede ser consolidación vacía o legacy.");
  }

  if (
    contains_audiences &&
    contains_value_proposition &&
    detected.audiences.length === 0 &&
    detected.identity_or_positioning.length === 0
  ) {
    warnings.push(
      "Payload tiene secciones marcadas pero extractDetectedSignals no encontró snippets legibles; JSON puede estar muy anidado o con campos vacíos.",
    );
  }

  const report: BrainstormerContextAuditReport = {
    session_id: session.id,
    brand_id: session.brand_id,
    brand_name: brandName,
    brand_knowledge_base_id_used: kid,
    brand_limbic_base_id_used: lid,
    brand_context_status: session.brand_context_status,
    knowledge_payload_present: Boolean(knowledge),
    limbic_payload_present: Boolean(limbic),
    knowledge_payload_character_count: knowledgeChar,
    limbic_payload_character_count: limbicChar,
    contains_audiences,
    contains_offer,
    contains_value_proposition,
    contains_differentiators,
    contains_tone,
    contains_credibility_assets,
    contains_guardrails,
    contains_limbic_cues,
    possible_truncation,
    knowledge_truncated_in_prompt: prompt.knowledge_truncated_in_prompt,
    limbic_truncated_in_prompt: prompt.limbic_truncated_in_prompt,
    top_level_knowledge_keys: knowledge ? Object.keys(knowledge) : [],
    top_level_limbic_keys: limbic ? Object.keys(limbic) : [],
    knowledge_contract_gaps: kContract.gaps,
    limbic_contract_gaps: lContract.gaps,
    frozen_base_alignment: {
      knowledge_matches_current_active:
        currentActiveKnowledgeId && kid ? currentActiveKnowledgeId === kid : null,
      limbic_matches_current_active:
        currentActiveLimbicId && lid ? currentActiveLimbicId === lid : null,
      current_active_knowledge_base_id: currentActiveKnowledgeId,
      current_active_limbic_base_id: currentActiveLimbicId,
    },
    prompt_assembly: {
      full_input_character_count: prompt.full_input_character_count,
      system_instructions_character_count: prompt.system_instructions_character_count,
      brand_signals_block_character_count: prompt.brand_signals_block_character_count,
      knowledge_in_prompt_character_count: prompt.knowledge_in_prompt_character_count,
      limbic_in_prompt_character_count: prompt.limbic_in_prompt_character_count,
      user_payload_character_count: prompt.user_payload_character_count,
      conversation_excerpt_character_count: prompt.conversation_excerpt_character_count,
      conversation_excerpt_truncated: prompt.conversation_excerpt_truncated,
      message_count_in_excerpt: messages?.length ?? 0,
    },
    detected_brand_signals: detected,
    warnings,
  };

  return { ok: true, report };
}
