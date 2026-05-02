import { z } from "zod";

export const nameStatusSchema = z.enum([
  "definitive",
  "provisional",
  "unnamed",
]);

export const challengeTypeSchema = z.enum([
  "brand",
  "product",
  "service",
  "event",
  "personal_brand",
  "project_venture",
  "corporate_communication",
]);

export const mainChallengeSchema = z.enum([
  "explain_better",
  "differentiate",
  "sell_convert",
  "attract_audience",
  "change_perception",
  "coherent_content",
]);

export const createProjectBodySchema = z.object({
  name_or_descriptor: z.string().min(1).max(2000),
  name_status: nameStatusSchema.optional(),
});

/** PATCH /api/projects/:id — solo campos permitidos */
export const patchProjectBodySchema = z
  .object({
    name_or_descriptor: z.string().min(1).max(2000).optional(),
    name_status: nameStatusSchema.optional(),
    challenge_type: challengeTypeSchema.nullable().optional(),
    main_challenge: mainChallengeSchema.nullable().optional(),
  })
  .refine(
    (data) =>
      data.name_or_descriptor !== undefined ||
      data.name_status !== undefined ||
      data.challenge_type !== undefined ||
      data.main_challenge !== undefined,
    { message: "Envía al menos un campo para actualizar" },
  );

export const patchProjectResponsesBodySchema = z
  .object({
    responses: z.record(z.string(), z.any()).optional(),
    completed_steps: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (data) => data.responses !== undefined || data.completed_steps !== undefined,
    { message: "Debes enviar al menos responses o completed_steps" },
  );

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type PatchProjectBody = z.infer<typeof patchProjectBodySchema>;
export type PatchProjectResponsesBody = z.infer<
  typeof patchProjectResponsesBodySchema
>;
