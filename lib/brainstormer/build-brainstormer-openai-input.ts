import {
  buildBrandDnaForBrainstormer,
  BRAND_DNA_PROMPT_HEADER,
} from "@/lib/brainstormer/build-brand-dna-for-brainstormer";
import { buildSupplementalBrandContextBlock } from "@/lib/brainstormer/build-supplemental-brand-context";
import {
  BRAINSTORMER_CORE_BEHAVIOR_ES,
  buildCompactCanonPromptBlock,
} from "@/lib/brainstormer/brainstormer-core-behavior";
import type { BrainstormerConversationContractTurn } from "@/lib/brainstormer/conversation-contract";
import type { BrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";
import { BRAINSTORMER_CONVERSATION_EXCERPT_MAX_CHARS } from "@/lib/brainstormer/brainstormer-prompt-limits";
import { shouldIncludeSupplementalBrandContext } from "@/lib/brainstormer/should-include-supplemental-brand-context";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";
import { formatCompactConversationDirectionForPrompt } from "@/lib/brainstormer/format-compact-conversation-direction";
import { buildBrainstormerSessionUserPayload } from "@/lib/prompts/brainstormer-session";
import type { BrainstormerSessionProgressPayload } from "@/lib/schemas/brainstormer-session";
import { BRAINSTORMER_PROMPT_HIERARCHY_RULE_EN } from "@/lib/brainstormer/brainstormer-prompt-hierarchy";
import type { BrainstormBrandContextStatus } from "@/types/database";

export type BuildBrainstormerOpenAIInputArgs = {
  brand_name: string;
  session_title: string;
  brand_context_status: BrainstormBrandContextStatus;
  brand_context_has_pending_updates: boolean;
  brand_context_blocking_reasons: readonly string[];
  session_summary_progress: BrainstormerSessionProgressPayload;
  conversation_excerpt: string;
  conversation_director: ConversationDirectorDecision;
  conversation_contract_turn?: BrainstormerConversationContractTurn;
  knowledge_payload: Record<string, unknown> | null;
  limbic_payload: Record<string, unknown> | null;
  working_brief?: BrainstormerWorkingBrief | null;
  working_brief_block: string;
  conversation_contract_block: string;
  thinking_model_block: string;
  last_user_message: string;
  /** Incluir subconjunto de base (evidencia/credenciales); por defecto según mensaje del usuario. */
  force_supplemental_brand_context?: boolean;
  /** Nota interna de prompt cuando la base activa cambió (no es etiqueta de producto). */
  brand_context_internal_note?: string | null;
};

export type BuildBrainstormerOpenAIInputResult = {
  system_instructions: string;
  brand_dna_block: string;
  brand_dna_character_count: number;
  supplemental_brand_context_block: string;
  supplemental_brand_context_included: boolean;
  /** @deprecated Mantener para auditoría; vacío salvo contexto suplementario. */
  brand_signals_block: string;
  knowledge_json_in_prompt: string;
  limbic_json_in_prompt: string;
  user_payload: string;
  conversation_direction_block: string;
  full_input: string;
  system_instructions_character_count: number;
  brand_signals_block_character_count: number;
  knowledge_full_character_count: number;
  limbic_full_character_count: number;
  knowledge_in_prompt_character_count: number;
  limbic_in_prompt_character_count: number;
  knowledge_truncated_in_prompt: boolean;
  limbic_truncated_in_prompt: boolean;
  user_payload_character_count: number;
  full_input_character_count: number;
  conversation_excerpt_character_count: number;
  conversation_excerpt_truncated: boolean;
};

/** Composición v4: core → ADN marca → memoria → turno → modelo → director (×1) → sesión → usuario. */
export function buildBrainstormerCorePromptLayers(
  args: BuildBrainstormerOpenAIInputArgs,
): BuildBrainstormerOpenAIInputResult {
  const brandDna = buildBrandDnaForBrainstormer({
    knowledge_payload: args.knowledge_payload,
    limbic_payload: args.limbic_payload,
    working_brief: args.working_brief,
  });

  const includeSupplemental =
    args.force_supplemental_brand_context ??
    shouldIncludeSupplementalBrandContext(
      args.last_user_message,
      args.conversation_excerpt,
    );

  const supplemental_brand_context_block = includeSupplemental
    ? buildSupplementalBrandContextBlock(args.knowledge_payload, args.limbic_payload)
    : "";

  const knowledgeFull = JSON.stringify(args.knowledge_payload ?? {});
  const limbicFull = JSON.stringify(args.limbic_payload ?? {});

  const excerptRaw = args.conversation_excerpt;
  const excerptTruncated = excerptRaw.length > BRAINSTORMER_CONVERSATION_EXCERPT_MAX_CHARS;
  const conversation_excerpt = excerptTruncated
    ? excerptRaw.slice(-BRAINSTORMER_CONVERSATION_EXCERPT_MAX_CHARS)
    : excerptRaw;

  const conversation_direction_block = formatCompactConversationDirectionForPrompt(
    args.conversation_director,
    args.conversation_contract_turn,
  );

  const user_payload = buildBrainstormerSessionUserPayload({
    brand_name: args.brand_name,
    session_title: args.session_title,
    brand_context_status: args.brand_context_status,
    brand_context_has_pending_updates: args.brand_context_has_pending_updates,
    brand_context_blocking_reasons: args.brand_context_blocking_reasons,
    session_summary_progress: args.session_summary_progress,
    conversation_excerpt,
    brand_context_internal_note: args.brand_context_internal_note,
  });

  const canon_block = buildCompactCanonPromptBlock();

  const lastUserBlock =
    args.last_user_message.trim().length > 0
      ? `LAST USER MESSAGE (prioritize this turn):\n${args.last_user_message.trim()}`
      : "LAST USER MESSAGE: (none yet — session opening)";

  const brandNoteBlock = args.brand_context_internal_note?.trim()
    ? `${args.brand_context_internal_note.trim()}\n\n`
    : "";

  const supplementalSection = supplemental_brand_context_block
    ? `---\n\n${supplemental_brand_context_block}\n\n`
    : "";

  const full_input = `${BRAINSTORMER_CORE_BEHAVIOR_ES}

${canon_block}

---

${brandDna.block}

${brandNoteBlock}${supplementalSection}---

${args.working_brief_block}

---

${args.conversation_contract_block}

---

${args.thinking_model_block}

---

${conversation_direction_block}

---

SESSION CONTEXT
${user_payload}

---

${lastUserBlock}

---

OUTPUT
Spanish assistant_message = prosa conversacional natural (no encabezados Lectura/Criterio/Ruta salvo pedido formal) + session_progress JSON.
${BRAINSTORMER_PROMPT_HIERARCHY_RULE_EN}
Closing question only if DIRECTOR/contract marks one; otherwise end with clear stance.`;

  const supplementalJson = supplemental_brand_context_block
    ? supplemental_brand_context_block
    : "";

  return {
    system_instructions: BRAINSTORMER_CORE_BEHAVIOR_ES,
    brand_dna_block: brandDna.block,
    brand_dna_character_count: brandDna.character_count,
    supplemental_brand_context_block,
    supplemental_brand_context_included: includeSupplemental,
    brand_signals_block: "",
    knowledge_json_in_prompt: supplementalJson.includes("BRAND_CONTEXT_SUPPLEMENT")
      ? supplementalJson
      : "",
    limbic_json_in_prompt: "",
    user_payload,
    conversation_direction_block,
    full_input,
    system_instructions_character_count: BRAINSTORMER_CORE_BEHAVIOR_ES.length,
    brand_signals_block_character_count: 0,
    knowledge_full_character_count: knowledgeFull.length,
    limbic_full_character_count: limbicFull.length,
    knowledge_in_prompt_character_count: supplementalJson.length,
    limbic_in_prompt_character_count: 0,
    knowledge_truncated_in_prompt: supplementalJson.includes("truncado"),
    limbic_truncated_in_prompt: false,
    user_payload_character_count: user_payload.length,
    full_input_character_count: full_input.length,
    conversation_excerpt_character_count: conversation_excerpt.length,
    conversation_excerpt_truncated: excerptTruncated,
  };
}

export function buildBrainstormerOpenAIInput(
  args: BuildBrainstormerOpenAIInputArgs,
): BuildBrainstormerOpenAIInputResult {
  return buildBrainstormerCorePromptLayers(args);
}

export { BRAND_DNA_PROMPT_HEADER };
