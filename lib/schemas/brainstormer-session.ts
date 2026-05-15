import { z } from "zod";

/** Versión del prompt de sesión Brainstormer (persistido en mensajes / trazabilidad). */
export const BRAINSTORMER_SESSION_PROMPT_VERSION = "brainstormer-session-v1.2" as const;

export const postBrainstormerSessionBodySchema = z.object({
  brand_id: z.string().uuid(),
  title: z.string().min(1).max(500).optional().nullable(),
  initial_user_message: z.string().min(1).max(20_000).optional(),
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
