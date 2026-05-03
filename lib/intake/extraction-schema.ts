import { z } from "zod";

/** Allowed partial updates under `responses.strategic_base` for the pilot. */
export const strategicBasePatchSchema = z
  .object({
    simple_description: z.string().optional(),
    offering_type: z.string().optional(),
    problem_category: z.string().optional(),
    problem_description_optional: z.string().nullable().optional(),
    transformation_type: z.string().optional(),
    transformation_from: z.string().nullable().optional(),
    transformation_to: z.string().nullable().optional(),
    guided_intake_limitations_optional: z.array(z.string()).optional(),
  })
  .strict();

export const extractedResponseUpdatesSchema = z
  .object({
    /** Model may suggest extra keys; `sanitizeStrategicBasePatch` drops unknowns. */
    strategic_base: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const intakeExtractionOutputSchema = z
  .object({
    extracted_response_updates: extractedResponseUpdatesSchema.default({}),
    confidence_by_field: z.record(z.string(), z.number()).default({}),
    needs_follow_up: z.boolean(),
    follow_up_question: z.string().nullable(),
    suggested_answer_chips: z.array(z.string()).default([]),
    answer_status: z.enum(["clear", "weak", "missing_choice", "skipped"]),
    target_response_paths: z.array(z.string()).default([]),
    internal_notes: z.string().default(""),
    public_copy_allowed: z.boolean(),
  })
  .strict();

export type IntakeExtractionOutput = z.infer<typeof intakeExtractionOutputSchema>;

export function parseIntakeExtractionOutput(
  raw: unknown,
): { ok: true; data: IntakeExtractionOutput } | { ok: false; error: string } {
  const parsed = intakeExtractionOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().toString(),
    };
  }
  return { ok: true, data: parsed.data };
}
