/**
 * Auditoría comparativa Disruptor vs Comercial — mismo ADN, brief y último mensaje.
 */

import { buildBrandDnaForBrainstormer } from "@/lib/brainstormer/build-brand-dna-for-brainstormer";
import { buildBrainstormerOpenAIInput } from "@/lib/brainstormer/build-brainstormer-openai-input";
import {
  applyConversationContractToDirector,
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  buildWorkingBriefPromptBlock,
  updateBrainstormerWorkingBrief,
  emptyBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import {
  buildCompactThinkingModelPromptBlock,
  getCompactThinkingModelDelta,
  resolveThinkingModelForBrainstormer,
} from "@/lib/ai/thinking-models";
import { extractDetectedBrandSignalsFromPayloads } from "@/lib/brainstormer/brand-signals-from-active-base";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";
import type { ThinkingModelKey } from "@/lib/ai/thinking-models";

export const GENERIC_FAMILY_TERMS = [
  "descubrimiento",
  "descubre",
  "curioso",
  "curiosidad",
  "extraordinario",
  "aventura",
  "experiencia única",
  "experiencia unica",
  "sorpresa",
  "inesperado",
  "mágico",
  "magico",
] as const;

export type GenericTermHits = Partial<Record<(typeof GENERIC_FAMILY_TERMS)[number], number>>;

export function countGenericFamilyTerms(text: string): GenericTermHits {
  const lower = text.toLowerCase();
  const hits: GenericTermHits = {};
  for (const term of GENERIC_FAMILY_TERMS) {
    const k = term.toLowerCase();
    let c = 0;
    let i = 0;
    while ((i = lower.indexOf(k, i)) !== -1) {
      c += 1;
      i += k.length;
    }
    if (c > 0) hits[term] = c;
  }
  return hits;
}

export type ThinkingModelPromptSample = {
  thinking_model_key: ThinkingModelKey;
  public_name: string;
  full_input: string;
  full_input_chars: number;
  thinking_model_block: string;
  thinking_model_block_chars: number;
  delta_only: string;
  delta_chars: number;
  brand_dna_block: string;
  brand_dna_chars: number;
  turn_contract_block: string;
  last_user_message: string;
  positions: {
    brand_dna: number;
    working_brief: number;
    this_turn: number;
    thinking_model: number;
    director: number;
    last_user_message: number;
  };
  generic_hits: {
    full_input: GenericTermHits;
    brand_dna: GenericTermHits;
    thinking_model: GenericTermHits;
    core_and_shared: GenericTermHits;
  };
};

export type BoringstoreThinkingModelAuditArgs = {
  knowledge_payload: Record<string, unknown>;
  limbic_payload: Record<string, unknown>;
  conversation_excerpt: string;
  last_user_message: string;
  thinking_model_key: "explorer" | "commercial";
};

function buildSample(args: BoringstoreThinkingModelAuditArgs): ThinkingModelPromptSample {
  let brief = emptyBrainstormerWorkingBrief();
  for (const line of args.conversation_excerpt.split("\n\n")) {
    const m = line.replace(/^user:\s*/i, "").trim();
    if (m) brief = updateBrainstormerWorkingBrief({ prior: brief, userMessage: m });
  }
  brief.confirmed_conceptual_umbrella = "No sabías que lo querías";

  const resolved = resolveThinkingModelForBrainstormer({
    selectedKey: args.thinking_model_key,
    challengeText: args.last_user_message,
  });
  const thinking_model_block = buildCompactThinkingModelPromptBlock({ resolved });
  const contract = buildConversationContractForTurn({
    brief,
    userMessage: args.last_user_message,
    conversationExcerpt: args.conversation_excerpt,
    thinkingPrimaryKey: resolved.primaryKey,
  });
  const brandSignals = extractDetectedBrandSignalsFromPayloads(
    args.knowledge_payload,
    args.limbic_payload,
  );
  const director = applyConversationContractToDirector(
    resolveConversationDirector({
      user_message: args.last_user_message,
      conversation_excerpt: args.conversation_excerpt,
      session_progress: emptyBrainstormerSessionProgress(),
      brand_signals: brandSignals,
      user_message_count: 3,
    }),
    contract,
  );

  const built = buildBrainstormerOpenAIInput({
    brand_name: "Boringstore",
    session_title: "Lanzamiento digital",
    brand_context_status: "ready",
    brand_context_has_pending_updates: false,
    brand_context_blocking_reasons: [],
    session_summary_progress: emptyBrainstormerSessionProgress(),
    conversation_excerpt: args.conversation_excerpt,
    conversation_director: director,
    conversation_contract_turn: contract,
    knowledge_payload: args.knowledge_payload,
    limbic_payload: args.limbic_payload,
    working_brief: brief,
    working_brief_block: buildWorkingBriefPromptBlock(brief),
    conversation_contract_block: buildConversationContractPromptBlock(contract),
    thinking_model_block,
    last_user_message: args.last_user_message,
  });

  const full = built.full_input;
  const sharedPrefixEnd = full.indexOf("THINKING MODEL");
  const sharedPrefix = sharedPrefixEnd > 0 ? full.slice(0, sharedPrefixEnd) : "";

  return {
    thinking_model_key: args.thinking_model_key,
    public_name: args.thinking_model_key === "explorer" ? "Disruptor" : "Comercial",
    full_input: full,
    full_input_chars: full.length,
    thinking_model_block,
    thinking_model_block_chars: thinking_model_block.length,
    delta_only: getCompactThinkingModelDelta(args.thinking_model_key),
    delta_chars: getCompactThinkingModelDelta(args.thinking_model_key).length,
    brand_dna_block: built.brand_dna_block,
    brand_dna_chars: built.brand_dna_character_count,
    turn_contract_block: buildConversationContractPromptBlock(contract),
    last_user_message: args.last_user_message,
    positions: {
      brand_dna: full.indexOf("BRAND_DNA_FOR_BRAINSTORMER"),
      working_brief: full.indexOf("WORKING BRIEF"),
      this_turn: full.indexOf("THIS TURN"),
      thinking_model: full.indexOf("THINKING MODEL"),
      director: full.indexOf("DIRECTOR (compact)"),
      last_user_message: full.indexOf("LAST USER MESSAGE"),
    },
    generic_hits: {
      full_input: countGenericFamilyTerms(full),
      brand_dna: countGenericFamilyTerms(built.brand_dna_block),
      thinking_model: countGenericFamilyTerms(thinking_model_block),
      core_and_shared: countGenericFamilyTerms(sharedPrefix),
    },
  };
}

export type BoringstoreThinkingModelPromptComparison = {
  disruptor: ThinkingModelPromptSample;
  commercial: ThinkingModelPromptSample;
  shared_full_input_prefix_chars: number;
  dna_fields: ReturnType<typeof buildBrandDnaForBrainstormer>["fields"];
  dna_generic_analysis: {
    hits: GenericTermHits;
    contaminated_fields: string[];
    proposal: string[];
  };
};

export function auditBoringstoreThinkingModelPrompts(
  args: Omit<BoringstoreThinkingModelAuditArgs, "thinking_model_key">,
): BoringstoreThinkingModelPromptComparison {
  const disruptor = buildSample({ ...args, thinking_model_key: "explorer" });
  const commercial = buildSample({ ...args, thinking_model_key: "commercial" });

  let brief = emptyBrainstormerWorkingBrief();
  for (const line of args.conversation_excerpt.split("\n\n")) {
    const m = line.replace(/^user:\s*/i, "").trim();
    if (m) brief = updateBrainstormerWorkingBrief({ prior: brief, userMessage: m });
  }
  brief.confirmed_conceptual_umbrella = "No sabías que lo querías";
  const dnaWithBrief = buildBrandDnaForBrainstormer({
    knowledge_payload: args.knowledge_payload,
    limbic_payload: args.limbic_payload,
    working_brief: brief,
  });

  const dnaText = Object.entries(dnaWithBrief.fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const hits = countGenericFamilyTerms(dnaText);
  const contaminated_fields = Object.entries(dnaWithBrief.fields)
    .filter(([, v]) => Object.keys(countGenericFamilyTerms(v)).length > 0)
    .map(([k]) => k);

  const tmIdx = disruptor.full_input.indexOf("THINKING MODEL");
  const sharedPrefix =
    tmIdx > 0 ? disruptor.full_input.slice(0, tmIdx) : disruptor.full_input;

  return {
    disruptor,
    commercial,
    shared_full_input_prefix_chars: sharedPrefix.length,
    dna_fields: dnaWithBrief.fields,
    dna_generic_analysis: {
      hits,
      contaminated_fields,
      proposal: [
        "Separar brand_truth (hechos de marca) de desired_effect ('deseo inesperado', paraguas confirmado).",
        "Mover menciones de descubrimiento/curioso/extraordinario de promise/identity a weak_territories_to_avoid.",
        "No repetir en DNA frases que el delta Disruptor lista como prohibidas (evitar priming positivo).",
      ],
    },
  };
}

/** Formato legible para logs de auditoría (tests / debug). */
export function formatThinkingModelAuditReport(c: BoringstoreThinkingModelPromptComparison): string {
  const lines: string[] = [
    "=== BORINGSTORE — Disruptor vs Comercial (mismo ADN, brief, último mensaje) ===",
    "",
    "--- Brand DNA ---",
    `chars: ${c.disruptor.brand_dna_chars}`,
    `generic hits: ${JSON.stringify(c.dna_generic_analysis.hits)}`,
    `campos con términos genéricos: ${c.dna_generic_analysis.contaminated_fields.join(", ") || "(ninguno)"}`,
    "",
    "--- Disruptor ---",
    `full_input chars: ${c.disruptor.full_input_chars}`,
    `thinking block chars: ${c.disruptor.thinking_model_block_chars}`,
    `delta chars: ${c.disruptor.delta_chars}`,
    `generic en thinking: ${JSON.stringify(c.disruptor.generic_hits.thinking_model)}`,
    `generic en ADN (compartido): ${JSON.stringify(c.disruptor.generic_hits.brand_dna)}`,
    `posiciones: DNA@${c.disruptor.positions.brand_dna} brief@${c.disruptor.positions.working_brief} turn@${c.disruptor.positions.this_turn} TM@${c.disruptor.positions.thinking_model} dir@${c.disruptor.positions.director} user@${c.disruptor.positions.last_user_message}`,
    "",
    "DELTA DISRUPTOR:",
    c.disruptor.delta_only,
    "",
    "--- Comercial ---",
    `full_input chars: ${c.commercial.full_input_chars}`,
    `thinking block chars: ${c.commercial.thinking_model_block_chars}`,
    `delta chars: ${c.commercial.delta_chars}`,
    `generic en thinking: ${JSON.stringify(c.commercial.generic_hits.thinking_model)}`,
    "",
    "DELTA COMERCIAL:",
    c.commercial.delta_only,
    "",
    `Prefijo compartido (idéntico hasta THINKING MODEL): ${c.shared_full_input_prefix_chars} chars`,
    `Diferencia solo en bloque thinking: ${c.commercial.thinking_model_block_chars - c.disruptor.thinking_model_block_chars} chars`,
  ];
  return lines.join("\n");
}
