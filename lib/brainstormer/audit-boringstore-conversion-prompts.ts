/**
 * Auditoría runtime — conversión en página (Disruptor vs Comercial, mismo hilo).
 */

import { buildBrandDnaForBrainstormer } from "@/lib/brainstormer/build-brand-dna-for-brainstormer";
import { buildBrainstormerOpenAIInput } from "@/lib/brainstormer/build-brainstormer-openai-input";
import {
  applyConversationContractToDirector,
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  buildWorkingBriefPromptBlock,
  classifyBrainstormerTurnIntent,
  updateBrainstormerWorkingBrief,
  emptyBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import {
  buildConversionBridgeObligation,
  CONVERSION_BRIDGE_TEMPLATE_ES,
} from "@/lib/brainstormer/working-brief-memory";
import {
  auditBoringstoreThinkingModelPrompts,
  countGenericFamilyTerms,
  type ThinkingModelPromptSample,
} from "@/lib/brainstormer/audit-boringstore-thinking-model-prompts";
import {
  BORINGSTORE_KNOWLEDGE_FIXTURE,
  BORINGSTORE_LIMBIC_FIXTURE,
} from "@/lib/brainstormer/boringstore-thinking-model-audit.fixture";
import {
  buildCompactThinkingModelPromptBlock,
  getCompactThinkingModelDelta,
  resolveThinkingModelForBrainstormer,
} from "@/lib/ai/thinking-models";
import { extractDetectedBrandSignalsFromPayloads } from "@/lib/brainstormer/brand-signals-from-active-base";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";
import type { BrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";
import type { ThinkingModelKey } from "@/lib/ai/thinking-models";

/** Hilo previo compartido (paraguas confirmado + sketch expectativa). */
export const BORINGSTORE_CONVERSION_THREAD_MESSAGES = [
  "No sabías que lo querías",
  "Ese sería el paraguas",
  "¿Cuál es la ruta a seguir?",
  "¿Esto qué etapa de campaña es? Tenemos un sketch de producto falso para expectativa.",
] as const;

/** Mensaje del usuario en la prueba observada. */
export const BORINGSTORE_CONVERSION_LAST_MESSAGE =
  "¿Cómo convertimos ese concepto en compras dentro de la página?";

/** Variante que sí matchea patrones actuales de conversion_bridge. */
export const BORINGSTORE_CONVERSION_LAST_MESSAGE_MATCHING =
  "¿Cómo lo convertimos en compras en la página?";

const LITERAL_CLICHE_CHECKS = [
  "Descubre lo inesperado",
  "Explora lo extraordinario",
  "Viaje de descubrimiento",
  "Momentos mágicos",
  "Experiencia única",
  "experiencia unica",
] as const;

export function buildBoringstoreConversionThreadExcerpt(): string {
  return BORINGSTORE_CONVERSION_THREAD_MESSAGES.map((m) => `user: ${m}`).join("\n\n");
}

export function simulateBoringstoreConversionBrief(): BrainstormerWorkingBrief {
  return simulateBoringstoreConversionBriefForMessage(BORINGSTORE_CONVERSION_LAST_MESSAGE);
}

export function simulateBoringstoreConversionBriefForMessage(
  lastMessage: string,
): BrainstormerWorkingBrief {
  let brief = emptyBrainstormerWorkingBrief();
  const excerptParts: string[] = [];
  for (const msg of BORINGSTORE_CONVERSION_THREAD_MESSAGES) {
    brief = updateBrainstormerWorkingBrief({
      prior: brief,
      userMessage: msg,
      conversationExcerpt: excerptParts.join("\n\n"),
    });
    excerptParts.push(`user: ${msg}`);
  }
  return updateBrainstormerWorkingBrief({
    prior: brief,
    userMessage: lastMessage,
    conversationExcerpt: buildBoringstoreConversionThreadExcerpt(),
  });
}

export type ConversionPromptAuditSlice = {
  thinking_model_key: "explorer" | "commercial";
  public_name: string;
  classified_intent: string;
  conversion_obligation_raw: string;
  this_turn_block: string;
  thinking_model_block: string;
  delta_only: string;
  working_brief_block: string;
  brand_dna_block: string;
  brief_snapshot: Pick<
    BrainstormerWorkingBrief,
    | "confirmed_conceptual_umbrella"
    | "conversion_bridge"
    | "campaign_stage"
    | "confirmed_decisions"
    | "current_request_type"
  >;
  literal_cliches_in_prompt: string[];
  generic_hits: ReturnType<typeof countGenericFamilyTerms>;
};

export type BoringstoreConversionPromptAudit = {
  last_user_message: string;
  conversation_excerpt: string;
  intent_disruptor: string;
  intent_commercial: string;
  intent_match: boolean;
  conversion_obligation_identical: boolean;
  conversion_obligation_text: string;
  conversion_bridge_template: string;
  dna_fields: ReturnType<typeof buildBrandDnaForBrainstormer>["fields"];
  dna_generic_hits: ReturnType<typeof countGenericFamilyTerms>;
  dna_literal_cliches: string[];
  disruptor: ConversionPromptAuditSlice;
  commercial: ConversionPromptAuditSlice;
  flattening_findings: string[];
};

function buildSlice(
  thinking_model_key: "explorer" | "commercial",
  brief: BrainstormerWorkingBrief,
  excerpt: string,
  lastUserMessage: string,
): ConversionPromptAuditSlice {
  const resolved = resolveThinkingModelForBrainstormer({
    selectedKey: thinking_model_key,
    challengeText: lastUserMessage,
  });
  const contract = buildConversationContractForTurn({
    brief,
    userMessage: lastUserMessage,
    conversationExcerpt: excerpt,
    thinkingPrimaryKey: resolved.primaryKey,
  });
  const thinking_model_block = buildCompactThinkingModelPromptBlock({ resolved });
  const brandSignals = extractDetectedBrandSignalsFromPayloads(
    BORINGSTORE_KNOWLEDGE_FIXTURE,
    BORINGSTORE_LIMBIC_FIXTURE,
  );
  const director = applyConversationContractToDirector(
    resolveConversationDirector({
      user_message: lastUserMessage,
      conversation_excerpt: excerpt,
      session_progress: emptyBrainstormerSessionProgress(),
      brand_signals: brandSignals,
      user_message_count: BORINGSTORE_CONVERSION_THREAD_MESSAGES.length + 1,
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
    conversation_excerpt: excerpt,
    conversation_director: director,
    conversation_contract_turn: contract,
    knowledge_payload: BORINGSTORE_KNOWLEDGE_FIXTURE,
    limbic_payload: BORINGSTORE_LIMBIC_FIXTURE,
    working_brief: brief,
    working_brief_block: buildWorkingBriefPromptBlock(brief),
    conversation_contract_block: buildConversationContractPromptBlock(contract),
    thinking_model_block,
    last_user_message: lastUserMessage,
  });

  const full = built.full_input;
  const literal_cliches_in_prompt = LITERAL_CLICHE_CHECKS.filter((p) =>
    full.toLowerCase().includes(p.toLowerCase()),
  );

  return {
    thinking_model_key,
    public_name: thinking_model_key === "explorer" ? "Disruptor" : "Comercial",
    classified_intent: contract.turn_intent,
    conversion_obligation_raw: contract.response_obligation,
    this_turn_block: buildConversationContractPromptBlock(contract),
    thinking_model_block,
    delta_only: getCompactThinkingModelDelta(thinking_model_key),
    working_brief_block: buildWorkingBriefPromptBlock(brief),
    brand_dna_block: built.brand_dna_block,
    brief_snapshot: {
      confirmed_conceptual_umbrella: brief.confirmed_conceptual_umbrella,
      conversion_bridge: brief.conversion_bridge,
      campaign_stage: brief.campaign_stage,
      confirmed_decisions: [...brief.confirmed_decisions],
      current_request_type: brief.current_request_type,
    },
    literal_cliches_in_prompt,
    generic_hits: countGenericFamilyTerms(full),
  };
}

export function auditBoringstoreConversionPrompts(
  lastUserMessage: string = BORINGSTORE_CONVERSION_LAST_MESSAGE,
): BoringstoreConversionPromptAudit {
  return auditWithLastMessage(lastUserMessage);
}

function auditWithLastMessage(lastMessage: string): BoringstoreConversionPromptAudit {
  const excerpt = buildBoringstoreConversionThreadExcerpt();
  const brief = simulateBoringstoreConversionBriefForMessage(lastMessage);
  const disruptor = buildSlice("explorer", brief, excerpt, lastMessage);
  const commercial = buildSlice("commercial", brief, excerpt, lastMessage);

  const intentD = classifyBrainstormerTurnIntent(lastMessage, excerpt);
  const intentC = intentD;
  const obligationD = disruptor.conversion_obligation_raw;
  const obligationC = commercial.conversion_obligation_raw;
  const conversion_obligation_identical = obligationD === obligationC;

  const dna = buildBrandDnaForBrainstormer({
    knowledge_payload: BORINGSTORE_KNOWLEDGE_FIXTURE,
    limbic_payload: BORINGSTORE_LIMBIC_FIXTURE,
    working_brief: brief,
  });
  const dnaText = Object.entries(dna.fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const dna_generic_hits = countGenericFamilyTerms(dnaText);
  const dna_literal_cliches = LITERAL_CLICHE_CHECKS.filter((p) =>
    dnaText.toLowerCase().includes(p.toLowerCase()),
  );

  const flattening_findings: string[] = [];

  if (intentD !== "conversion_bridge") {
    flattening_findings.push(
      `Clasificación: el último mensaje NO es conversion_bridge sino «${intentD}» — la obligación puede ser genérica.`,
    );
  }
  if (conversion_obligation_identical && intentD === "conversion_bridge") {
    flattening_findings.push(
      "THIS TURN: buildConversionBridgeObligation sigue idéntica entre Disruptor y Comercial.",
    );
  }
  if (
    /landing.*CTA|CTA.*landing/i.test(obligationD) &&
    !/producto falso|gancho creativo|esto no existe/i.test(obligationD)
  ) {
    flattening_findings.push(
      "Obligación conversión empuja landing/CTA sin mecanismo creativo disruptor explícito.",
    );
  }
  const dDisruptor = disruptor.delta_only;
  const dCommercial = commercial.delta_only;
  if (!/deseo inesperado|ruptura|ironía/i.test(dDisruptor)) {
    flattening_findings.push("Delta Disruptor no enfatiza ruptura/deseo inesperado en el bloque thinking.");
  }
  if (!/compra|CTA|landing|conversión/i.test(dCommercial)) {
    flattening_findings.push("Delta Comercial no enfatiza conversión/compra en el bloque thinking.");
  }
  if (dna_literal_cliches.length > 0) {
    flattening_findings.push(
      `Brand DNA contiene clichés literales: ${dna_literal_cliches.join(", ")}`,
    );
  }
  if (Object.keys(dna_generic_hits).length > 0) {
    flattening_findings.push(
      `Brand DNA contiene términos familia genérica: ${JSON.stringify(dna_generic_hits)}`,
    );
  }
  if (disruptor.literal_cliches_in_prompt.length > 0) {
    flattening_findings.push(
      `Prompt Disruptor incluye frases cliché: ${disruptor.literal_cliches_in_prompt.join(", ")}`,
    );
  }
  const sharedPrefix = auditBoringstoreThinkingModelPrompts({
    knowledge_payload: BORINGSTORE_KNOWLEDGE_FIXTURE,
    limbic_payload: BORINGSTORE_LIMBIC_FIXTURE,
    conversation_excerpt: excerpt,
    last_user_message: lastMessage,
  });
  const wbEnd = sharedPrefix.disruptor.positions.working_brief;
  if (
    sharedPrefix.disruptor.full_input.slice(0, wbEnd) ===
    sharedPrefix.commercial.full_input.slice(0, wbEnd)
  ) {
    flattening_findings.push(
      `Prefijo compartido hasta WORKING BRIEF: ${wbEnd} chars (DNA + core + brief idénticos).`,
    );
  }

  return {
    last_user_message: lastMessage,
    conversation_excerpt: excerpt,
    intent_disruptor: intentD,
    intent_commercial: intentC,
    intent_match: intentD === intentC,
    conversion_obligation_identical,
    conversion_obligation_text: buildConversionBridgeObligation(brief, false),
    conversion_bridge_template: CONVERSION_BRIDGE_TEMPLATE_ES,
    dna_fields: dna.fields,
    dna_generic_hits,
    dna_literal_cliches,
    disruptor,
    commercial,
    flattening_findings,
  };
}

function formatSlice(label: string, s: ConversionPromptAuditSlice): string[] {
  return [
    `### ${label} (${s.public_name})`,
    "",
    `Intent clasificado: **${s.classified_intent}**`,
    "",
    "#### Working brief (snapshot)",
    "```json",
    JSON.stringify(s.brief_snapshot, null, 2),
    "```",
    "",
    "#### Brand DNA (bloque enviado)",
    "```",
    s.brand_dna_block,
    "```",
    "",
    `Términos familia genérica en prompt completo: ${JSON.stringify(s.generic_hits) || "{}"}`,
    `Clichés literales en prompt: ${s.literal_cliches_in_prompt.length ? s.literal_cliches_in_prompt.join(", ") : "(ninguno)"}`,
    "",
    "#### THIS TURN",
    "```",
    s.this_turn_block,
    "```",
    "",
    "#### THINKING MODEL (bloque completo)",
    "```",
    s.thinking_model_block,
    "```",
    "",
    "#### Delta only",
    "```",
    s.delta_only,
    "```",
    "",
    "#### WORKING BRIEF (bloque prompt)",
    "```",
    s.working_brief_block,
    "```",
    "",
  ];
}

export function formatConversionAuditReport(a: BoringstoreConversionPromptAudit): string {
  const lines: string[] = [
    "# Auditoría runtime — conversión en página (Boringstore)",
    "",
    `**Último mensaje:** ${a.last_user_message}`,
    "",
    "**Hilo previo:**",
    ...a.conversation_excerpt.split("\n\n").map((l) => `- ${l}`),
    "",
    "---",
    "",
    "## 1. Clasificación de intent",
    "",
    `- Disruptor / Comercial: \`${a.intent_disruptor}\` (¿match? ${a.intent_match})`,
    "",
    "## 2. conversion_bridge — ¿aplana ambos modelos?",
    "",
    `- Obligación THIS TURN idéntica entre modelos: **${a.conversion_obligation_identical ? "SÍ" : "NO"}**`,
    `- Template por defecto: \`${a.conversion_bridge_template}\``,
    "",
    "**Texto buildConversionBridgeObligation (compartido):**",
    "```",
    a.conversion_obligation_text,
    "```",
    "",
    "## 3. Brand DNA (campos)",
    "",
    ...Object.entries(a.dna_fields).map(([k, v]) => `- **${k}:** ${v}`),
    "",
    `- Términos familia genérica en DNA: ${JSON.stringify(a.dna_generic_hits)}`,
    `- Clichés literales en DNA: ${a.dna_literal_cliches.length ? a.dna_literal_cliches.join(", ") : "(ninguno)"}`,
    "",
    "## 4. Hallazgos de aplanamiento",
    "",
    ...(a.flattening_findings.length
      ? a.flattening_findings.map((f) => `- ${f}`)
      : ["- (ninguno automático)"]),
    "",
    "---",
    "",
  ];

  lines.push(...formatSlice("Sesión A", a.disruptor));
  lines.push(...formatSlice("Sesión B", a.commercial));

  lines.push(
    "## 5. Comparativa deltas",
    "",
    "| Aspecto | Disruptor | Comercial |",
    "|---------|-----------|-----------|",
    `| Delta chars | ${a.disruptor.delta_only.length} | ${a.commercial.delta_only.length} |`,
    `| Ruptura/ironía/deseo | ${/ruptura|ironía|deseo inesperado/i.test(a.disruptor.delta_only) ? "sí" : "no"} | ${/ruptura|ironía|deseo inesperado/i.test(a.commercial.delta_only) ? "sí" : "no"} |`,
    `| Compra/CTA/landing | ${/compra|CTA|landing/i.test(a.disruptor.delta_only) ? "sí" : "no"} | ${/compra|CTA|landing/i.test(a.commercial.delta_only) ? "sí" : "no"} |`,
    "",
    "**Disruptor esperado:** producto falso → deseo inesperado → producto real → compra (mecanismo creativo).",
    "**Comercial esperado:** sketch → landing → CTA → carrito con objeción y prueba.",
    "",
  );

  return lines.join("\n");
}
