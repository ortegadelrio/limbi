import { z } from "zod";

/** Estados persistidos en `brainstorm_sessions.status`. */
export const brainstormSessionStatusSchema = z.enum([
  "open",
  "paused",
  "closed",
  "converted_to_project_base",
]);

/** `brainstorm_sessions.brand_context_status` (fuente de verdad / salud al iniciar). */
export const brainstormBrandContextStatusSchema = z.enum([
  "ready",
  "advisory",
  "blocked",
]);

/** Rol en `brainstorm_messages.role`. */
export const brainstormMessageRoleSchema = z.enum(["user", "assistant", "system"]);

/** `brainstorm_session_snapshots.snapshot_kind`. */
export const brainstormSnapshotKindSchema = z.enum([
  "live_map",
  "strategic_summary",
  "conversion_candidate",
]);

/** Estados en `brainstorm_project_bases.status`. */
export const brainstormProjectBaseStatusSchema = z.enum([
  "draft",
  "sent_to_project",
  "archived",
]);

export const brainstormFieldStatusSchema = z.enum(["defined", "hypothesis", "pending"]);

/** Campo clave de `common_base` (valor + estado). */
export const brainstormPreliminaryFieldSchema = z.object({
  value: z.string(),
  status: brainstormFieldStatusSchema,
});

export const brainstormSuggestedProjectTypeSchema = z.object({
  type: z.string().min(1).max(120),
  confidence: z.enum(["low", "medium", "high"]),
  alternative_types: z.array(z.string().min(1).max(120)).max(20).default([]),
  reasoning: z.string().min(1).max(8000),
});

export const brainstormCommonBaseSchema = z
  .object({
    working_title: brainstormPreliminaryFieldSchema.optional(),
    challenge: brainstormPreliminaryFieldSchema.optional(),
    preliminary_objective: brainstormPreliminaryFieldSchema.optional(),
    main_audience: brainstormPreliminaryFieldSchema.optional(),
    secondary_audiences: brainstormPreliminaryFieldSchema.optional(),
    tension_or_barrier: brainstormPreliminaryFieldSchema.optional(),
    strategic_opportunity: brainstormPreliminaryFieldSchema.optional(),
    possible_insight: brainstormPreliminaryFieldSchema.optional(),
    available_evidence: brainstormPreliminaryFieldSchema.optional(),
    brand_assets_to_use: brainstormPreliminaryFieldSchema.optional(),
    restrictions: brainstormPreliminaryFieldSchema.optional(),
    ideas_explored: brainstormPreliminaryFieldSchema.optional(),
    recommended_route: brainstormPreliminaryFieldSchema.optional(),
    why_this_route: brainstormPreliminaryFieldSchema.optional(),
    pending_information: brainstormPreliminaryFieldSchema.optional(),
    maturity_level: brainstormPreliminaryFieldSchema.optional(),
    recommended_next_step: brainstormPreliminaryFieldSchema.optional(),
  })
  .strict();

export const brainstormConversionReadinessSchema = z.object({
  level: z.enum(["low", "medium", "high"]),
  can_convert: z.boolean(),
  reason: z.string().min(1).max(8000),
});

const brainstormPendingInformationItemSchema = z.object({
  label: z.string().min(1).max(300),
  detail: z.string().max(8000).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

/** Base preliminar persistida en `brainstorm_project_bases` (validación de forma; JSONB puede evolucionar). */
export const brainstormProjectBaseSchema = z.object({
  common_base: brainstormCommonBaseSchema.default({}),
  suggested_project_type: brainstormSuggestedProjectTypeSchema
    .partial()
    .passthrough()
    .default({}),
  specific_module: z.record(z.string(), z.unknown()).default({}),
  pending_information: z.array(brainstormPendingInformationItemSchema).default([]),
  conversion_readiness: brainstormConversionReadinessSchema.default({
    level: "low",
    can_convert: false,
    reason: "Sin evaluación aún.",
  }),
  status: brainstormProjectBaseStatusSchema.optional(),
});

export const createBrainstormSessionSchema = z.object({
  brand_id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
});

export const updateBrainstormSessionSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    status: brainstormSessionStatusSchema.optional(),
    summary: z.string().max(20000).nullable().optional(),
    recommended_route: z.string().max(20000).nullable().optional(),
    maturity_level: z.enum(["low", "medium", "high"]).nullable().optional(),
    suggested_project_type: z.record(z.string(), z.unknown()).optional(),
    source_brand_context: z.record(z.string(), z.unknown()).optional(),
    closed_at: z.string().datetime().nullable().optional(),
    converted_at: z.string().datetime().nullable().optional(),
  })
  .strict();

export const createBrainstormMessageSchema = z.object({
  session_id: z.string().uuid(),
  role: brainstormMessageRoleSchema,
  content: z.string().min(1).max(100_000),
  structured_extraction: z.record(z.string(), z.unknown()).optional(),
});

export const createBrainstormSnapshotSchema = z.object({
  session_id: z.string().uuid(),
  snapshot_payload: z.record(z.string(), z.unknown()).default({}),
  snapshot_kind: brainstormSnapshotKindSchema.optional(),
});

export const createBrainstormProjectBaseSchema = z.object({
  session_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  source_brand_knowledge_base_id: z.string().uuid().nullable().optional(),
  source_brand_limbic_base_id: z.string().uuid().nullable().optional(),
  common_base: brainstormCommonBaseSchema.default({}),
  suggested_project_type: brainstormSuggestedProjectTypeSchema.partial().default({}),
  specific_module: z.record(z.string(), z.unknown()).default({}),
  pending_information: z.array(brainstormPendingInformationItemSchema).default([]),
  conversion_readiness: brainstormConversionReadinessSchema.default({
    level: "low",
    can_convert: false,
    reason: "Sin evaluación aún.",
  }),
  status: brainstormProjectBaseStatusSchema.optional(),
});
