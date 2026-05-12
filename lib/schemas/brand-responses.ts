import { z } from "zod";

export const patchBrandResponsesBodySchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            question_definition_id: z.string().uuid(),
            answer_value: z.unknown(),
          })
          .strict(),
      )
      .optional()
      .default([]),
  })
  .strict();

export type PatchBrandResponsesBody = z.infer<typeof patchBrandResponsesBodySchema>;
