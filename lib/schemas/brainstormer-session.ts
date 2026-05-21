import { z } from "zod";
import { THINKING_MODEL_SELECTOR_OPTIONS } from "@/lib/ai/thinking-models";
import { brainstormerWorkingBriefSchema } from "@/lib/brainstormer/conversation-contract";

/** Versión del prompt de sesión Brainstormer (persistido en mensajes / trazabilidad). */
export const BRAINSTORMER_SESSION_PROMPT_VERSION = "brainstormer-session-v3.0" as const;

export { brainstormerWorkingBriefSchema };

export const thinkingModelKeySchema = z.enum(THINKING_MODEL_SELECTOR_OPTIONS);

export const postBrainstormerSessionBodySchema = z.object({
  brand_id: z.string().uuid(),
  title: z.string().min(1).max(500).optional().nullable(),
  initial_user_message: z.string().min(1).max(20_000).optional(),
  thinking_model_key: thinkingModelKeySchema.optional(),
});

export const patchBrainstormerSessionBodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum(["open", "paused", "closed"]).optional(),
});

export const postBrainstormerMessageBodySchema = z.object({
  content: z.string().min(1).max(100_000),
});

export const brainstormerProjectReadinessSchema = z.enum(["low", "medium", "high"]);

export const brainstormerSuggestedProjectTypeSchema = z.enum([
  "campaign_360",
  "content_generation",
  "brand_activation",
  "audiovisual",
  "event_promotion",
  "other",
]);

/** Hallazgo de investigación externa — pendiente de aprobación para el brief de sesión. */
export const externalResearchFindingSchema = z.object({
  query: z.string().max(500),
  source_title: z.string().max(300),
  source_url: z.string().max(2000),
  finding: z.string().max(2000),
  strategic_reading: z.string().max(2000),
  relevance: z.string().max(1000),
  approved_for_session: z.boolean().default(false),
});

export type ExternalResearchFinding = z.infer<typeof externalResearchFindingSchema>;

/** Preview estructurado para handoff Brainstormer → Proyecto (sin crear proyecto en DB). */
export const projectHandoffPreviewSchema = z.object({
  project_type: z.string().max(200),
  objective: z.string().max(2000),
  confirmed_umbrella: z.string().max(300),
  audience_initial: z.string().max(2000),
  campaign_mechanism: z.string().max(2000),
  conversion_bridge: z.string().max(2000),
  suggested_deliverables: z.array(z.string().max(300)).max(12),
  pending_questions: z.array(z.string().max(500)).max(8),
});

export type ProjectHandoffPreview = z.infer<typeof projectHandoffPreviewSchema>;

/** Salida estructurada del modelo (resumen operativo de sesión + señales hacia proyecto). */
export const brainstormerSessionProgressSchema = z.object({
  session_summary: z.string().max(8000),
  current_challenge: z.string().max(8000),
  preliminary_objective: z.string().max(8000),
  audience_notes: z.string().max(8000),
  tension_or_pain: z.string().max(8000),
  opportunities: z.string().max(8000),
  ideas_explored: z.string().max(8000),
  recommended_routes: z.string().max(8000),
  open_questions: z.string().max(8000),
  next_step: z.string().max(8000),
  project_readiness: brainstormerProjectReadinessSchema,
  suggested_project_type: brainstormerSuggestedProjectTypeSchema,
  should_suggest_project_conversion: z.boolean(),
  project_seed_summary: z.string().max(4000),
  missing_project_inputs: z.array(z.string().max(500)).max(24),
  /** Brief vivo: restricciones, correcciones, rutas rechazadas (Conversation Contract). */
  working_brief: brainstormerWorkingBriefSchema.optional(),
  /** Investigación externa bajo demanda; no modifica Brand DNA ni paraguas sin aprobación. */
  external_research_findings: z.array(externalResearchFindingSchema).max(40).optional(),
  /** Último preview de handoff a Proyecto (cuando el usuario pide pasar a proyecto). */
  project_handoff_preview: projectHandoffPreviewSchema.nullable().optional(),
});

export const brainstormerTurnOutputSchema = z.object({
  assistant_message: z.string().min(1).max(16_000),
  session_progress: brainstormerSessionProgressSchema,
});

export type BrainstormerTurnOutputParsed = z.infer<typeof brainstormerTurnOutputSchema>;

export type BrainstormerProjectReadiness = z.infer<typeof brainstormerProjectReadinessSchema>;
export type BrainstormerSuggestedProjectType = z.infer<typeof brainstormerSuggestedProjectTypeSchema>;

export type BrainstormerSessionProgressPayload = z.infer<
  typeof brainstormerSessionProgressSchema
>;

export function emptyBrainstormerSessionProgress(): BrainstormerSessionProgressPayload {
  return {
    session_summary: "",
    current_challenge: "",
    preliminary_objective: "",
    audience_notes: "",
    tension_or_pain: "",
    opportunities: "",
    ideas_explored: "",
    recommended_routes: "",
    open_questions: "",
    next_step: "",
    project_readiness: "low",
    suggested_project_type: "other",
    should_suggest_project_conversion: false,
    project_seed_summary: "",
    missing_project_inputs: [],
    external_research_findings: [],
    project_handoff_preview: null,
  };
}

/** Une snapshots antiguos (sin campos de proyecto) con defaults para parseo seguro. */
export function coerceBrainstormerSessionProgress(raw: unknown): BrainstormerSessionProgressPayload {
  const base = emptyBrainstormerSessionProgress();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const merged = { ...base, ...(raw as Record<string, unknown>) };
  const parsed = brainstormerSessionProgressSchema.safeParse(merged);
  return parsed.success ? parsed.data : base;
}
