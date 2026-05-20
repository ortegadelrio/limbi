/** Límites usados al armar el input de OpenAI para Brainstormer (debe coincidir con auditoría). */
export const BRAINSTORMER_BRAND_DNA_MAX_CHARS = 1_500;
export const BRAINSTORMER_SUPPLEMENTAL_BRAND_CONTEXT_MAX_CHARS = 6_000;
/** @deprecated JSON completo ya no va por defecto al prompt; reservado para rutas legacy/tests. */
export const BRAINSTORMER_KNOWLEDGE_PROMPT_MAX_CHARS = 42_000;
/** @deprecated JSON completo ya no va por defecto al prompt; reservado para rutas legacy/tests. */
export const BRAINSTORMER_LIMBIC_PROMPT_MAX_CHARS = 24_000;
export const BRAINSTORMER_CONVERSATION_EXCERPT_MAX_CHARS = 18_000;

export function truncateForBrainstormerPrompt(json: unknown, max: number): {
  text: string;
  truncated: boolean;
  full_character_count: number;
} {
  const s = JSON.stringify(json ?? {});
  if (s.length <= max) {
    return { text: s, truncated: false, full_character_count: s.length };
  }
  return {
    text: `${s.slice(0, max)}\n…(truncado por límite de contexto)`,
    truncated: true,
    full_character_count: s.length,
  };
}
