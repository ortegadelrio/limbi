/**
 * Auditoría de composición del prompt Brainstormer (tamaños por capa).
 */

import { buildCompactCanonPromptBlock } from "@/lib/brainstormer/brainstormer-core-behavior";
import { BRAND_DNA_PROMPT_HEADER } from "@/lib/brainstormer/build-brand-dna-for-brainstormer";
import { buildBrainstormerCorePromptLayers } from "@/lib/brainstormer/build-brainstormer-openai-input";
import type { BuildBrainstormerOpenAIInputArgs } from "@/lib/brainstormer/build-brainstormer-openai-input";

export type BrainstormerPromptLayerAudit = {
  layer: string;
  chars: number;
  approx_tokens: number;
  order: number;
};

export type BrainstormerPromptAudit = {
  layers: BrainstormerPromptLayerAudit[];
  full_input_chars: number;
  full_input_approx_tokens: number;
};

function approxTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

/** Desglosa el full_input en capas para auditoría y tests. */
export function auditBrainstormerPromptComposition(
  args: BuildBrainstormerOpenAIInputArgs,
): BrainstormerPromptAudit {
  const built = buildBrainstormerCorePromptLayers(args);
  const full = built.full_input;

  const markers: { layer: string; start: string; order: number }[] = [
    { layer: "core_behavior", start: "BRAINSTORMER CORE BEHAVIOR", order: 1 },
    { layer: "brand_dna", start: BRAND_DNA_PROMPT_HEADER, order: 2 },
    { layer: "brand_supplement", start: "BRAND_CONTEXT_SUPPLEMENT", order: 3 },
    { layer: "working_brief", start: "WORKING BRIEF", order: 4 },
    { layer: "turn_contract", start: "THIS TURN", order: 5 },
    { layer: "thinking_model_delta", start: "THINKING MODEL", order: 6 },
    { layer: "director_compact", start: "DIRECTOR (compact)", order: 7 },
    { layer: "session_context", start: "SESSION CONTEXT", order: 8 },
    { layer: "last_user_message", start: "LAST USER MESSAGE", order: 9 },
    { layer: "output", start: "OUTPUT", order: 10 },
  ];

  const positions = markers
    .map((m) => ({ ...m, index: full.indexOf(m.start) }))
    .filter((m) => m.index >= 0)
    .sort((a, b) => a.index - b.index);

  const layers: BrainstormerPromptLayerAudit[] = [];

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i]!.index;
    const end = i + 1 < positions.length ? positions[i + 1]!.index : full.length;
    const chars = Math.max(0, end - start);
    layers.push({
      layer: positions[i]!.layer,
      order: positions[i]!.order,
      chars,
      approx_tokens: approxTokens(chars),
    });
  }

  return {
    layers: layers.sort((a, b) => a.order - b.order),
    full_input_chars: full.length,
    full_input_approx_tokens: approxTokens(full.length),
  };
}

/** Canon standalone size (reference). */
export function auditCompactCanonOnly(): number {
  return buildCompactCanonPromptBlock().length;
}

/** Cuenta apariciones de DIRECTOR (compact) en el prompt. */
export function countDirectorCompactOccurrences(fullInput: string): number {
  const needle = "DIRECTOR (compact)";
  let count = 0;
  let i = 0;
  while ((i = fullInput.indexOf(needle, i)) !== -1) {
    count += 1;
    i += needle.length;
  }
  return count;
}
