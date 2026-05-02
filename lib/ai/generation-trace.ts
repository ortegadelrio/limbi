/**
 * Forma esperada del registro de trazabilidad por generación (persistencia futura en BD).
 * No implica tablas ni migraciones en esta fase.
 */

export type PromptVersion = string;

/** Payload de entrada enviado al modelo (interpretación + contexto, sin OpenAI aquí). */
export type GenerationInputPayload = {
  /** Versión del ensamblador de prompts / interpretación */
  prompt_version: PromptVersion;
  /** Interpretación simbólica determinística (p. ej. salida de buildLimbicInterpretation) */
  symbolic_interpretation?: unknown;
  /** Resto del contexto crudo o ya procesado que defina el producto */
  context?: unknown;
};

export type GenerationTraceRecord = {
  project_id: string;
  master_document_id: string | null;
  visible_framework_id: string | null;
  prompt_version: PromptVersion;
  model_used: string;
  input_payload: GenerationInputPayload | unknown;
  output: unknown;
  created_at: string;
  master_document_version: number | null;
};
