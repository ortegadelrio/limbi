import {
  extractDetectedBrandSignalsFromPayloads,
  formatBrandSignalsFromActiveBaseBlock,
} from "@/lib/brainstormer/brand-signals-from-active-base";
import { buildBrainstormerSessionUserPayload } from "@/lib/prompts/brainstormer-session";
import {
  BRAINSTORMER_CONVERSATION_EXCERPT_MAX_CHARS,
  BRAINSTORMER_KNOWLEDGE_PROMPT_MAX_CHARS,
  BRAINSTORMER_LIMBIC_PROMPT_MAX_CHARS,
  truncateForBrainstormerPrompt,
} from "@/lib/brainstormer/brainstormer-prompt-limits";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";
import { formatConversationDirectionForPrompt } from "@/lib/brainstormer/conversational-renderer";
import { buildConversationalRendererSystemInstructions } from "@/lib/brainstormer/conversational-renderer";
import type { BrainstormerSessionProgressPayload } from "@/lib/schemas/brainstormer-session";
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
  knowledge_payload: Record<string, unknown> | null;
  limbic_payload: Record<string, unknown> | null;
};

export type BuildBrainstormerOpenAIInputResult = {
  system_instructions: string;
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

export function buildBrainstormerOpenAIInput(
  args: BuildBrainstormerOpenAIInputArgs,
): BuildBrainstormerOpenAIInputResult {
  const system_instructions = buildConversationalRendererSystemInstructions();

  const signals = extractDetectedBrandSignalsFromPayloads(
    args.knowledge_payload,
    args.limbic_payload,
  );
  const brand_signals_block = formatBrandSignalsFromActiveBaseBlock(
    signals,
    args.knowledge_payload,
  );

  const knowledge = truncateForBrainstormerPrompt(
    args.knowledge_payload ?? {},
    BRAINSTORMER_KNOWLEDGE_PROMPT_MAX_CHARS,
  );
  const limbic = truncateForBrainstormerPrompt(
    args.limbic_payload ?? {},
    BRAINSTORMER_LIMBIC_PROMPT_MAX_CHARS,
  );

  const excerptRaw = args.conversation_excerpt;
  const excerptTruncated = excerptRaw.length > BRAINSTORMER_CONVERSATION_EXCERPT_MAX_CHARS;
  const conversation_excerpt = excerptTruncated
    ? excerptRaw.slice(-BRAINSTORMER_CONVERSATION_EXCERPT_MAX_CHARS)
    : excerptRaw;

  const conversation_direction_block = formatConversationDirectionForPrompt(
    args.conversation_director,
  );

  const user_payload = buildBrainstormerSessionUserPayload({
    brand_name: args.brand_name,
    session_title: args.session_title,
    brand_context_status: args.brand_context_status,
    brand_context_has_pending_updates: args.brand_context_has_pending_updates,
    brand_context_blocking_reasons: args.brand_context_blocking_reasons,
    session_summary_progress: args.session_summary_progress,
    conversation_excerpt,
    conversation_direction_block,
  });

  const systemText = `${system_instructions}

${brand_signals_block}

FROZEN_ACTIVE_KNOWLEDGE_BASE_JSON (deep consolidated_payload — authoritative for strategy; NOT the /bases UI summary):
${knowledge.text}

FROZEN_ACTIVE_LIMBIC_BASE_JSON (deep consolidated_payload — tone/atmosphere; symbolic):
${limbic.text}`;

  const full_input = `${systemText}\n\n---\n\n${user_payload}`;

  return {
    system_instructions,
    brand_signals_block,
    knowledge_json_in_prompt: knowledge.text,
    limbic_json_in_prompt: limbic.text,
    user_payload,
    conversation_direction_block,
    full_input,
    system_instructions_character_count: system_instructions.length,
    brand_signals_block_character_count: brand_signals_block.length,
    knowledge_full_character_count: knowledge.full_character_count,
    limbic_full_character_count: limbic.full_character_count,
    knowledge_in_prompt_character_count: knowledge.text.length,
    limbic_in_prompt_character_count: limbic.text.length,
    knowledge_truncated_in_prompt: knowledge.truncated,
    limbic_truncated_in_prompt: limbic.truncated,
    user_payload_character_count: user_payload.length,
    full_input_character_count: full_input.length,
    conversation_excerpt_character_count: conversation_excerpt.length,
    conversation_excerpt_truncated: excerptTruncated,
  };
}
