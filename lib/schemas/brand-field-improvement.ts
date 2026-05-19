import { z } from "zod";

export const BRAND_FIELD_IMPROVE_PROMPT_VERSION = "brand-field-improvement-v1.0";

export const brandFieldImproveConversationStateSchema = z.enum([
  "asking",
  "proposal_ready",
]);

export const brandFieldImproveTurnOutputSchema = z
  .object({
    assistant_message: z.string().min(1).max(8000),
    conversation_state: brandFieldImproveConversationStateSchema,
    clarifying_question: z.string().max(2000).nullable(),
    proposed_answer_text: z.string().max(8000).nullable(),
    rationale: z.string().max(4000).nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.conversation_state === "proposal_ready") {
      if (!data.proposed_answer_text?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "proposal_ready requiere proposed_answer_text.",
          path: ["proposed_answer_text"],
        });
      }
    }
  });

export type BrandFieldImproveTurnOutputParsed = z.infer<
  typeof brandFieldImproveTurnOutputSchema
>;

export const brandFieldImproveCoachBodySchema = z.object({
  user_message: z.string().trim().min(1).max(4000),
  conversation_excerpt: z.string().max(12000).optional(),
});

export const brandFieldImproveApplyBodySchema = z.object({
  proposed_answer_text: z.string().trim().min(1).max(8000),
});
