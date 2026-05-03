import { z } from "zod";

export const recommendedNextActionSchema = z.enum([
  "generate_now",
  "ask_clarifications",
  "needs_minimum_context",
]);

export const clarificationOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const clarificationQuestionSchema = z.object({
  id: z.string().min(1),
  referenced_user_answer: z.string().min(1),
  why_it_matters: z.string().min(1),
  question_text: z.string().min(1),
  options: z
    .array(clarificationOptionSchema)
    .optional()
    .nullable()
    .transform((v) => (Array.isArray(v) && v.length > 0 ? v : undefined)),
  allow_free_text: z.boolean().optional().default(true),
});

export const questionnaireEvaluationPayloadSchema = z
  .object({
    overall_quality_score: z.number().int().min(0).max(100),
    dimension_scores: z.record(z.string(), z.number().int().min(0).max(100)),
    critical_gaps: z.array(z.string().min(1)),
    contradictions: z.array(z.string().min(1)),
    missing_information: z.array(z.string().min(1)),
    clarification_questions: z.array(clarificationQuestionSchema),
    recommended_next_action: recommendedNextActionSchema,
  })
  .superRefine((val, ctx) => {
    if (Object.keys(val.dimension_scores).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dimension_scores no puede estar vacío.",
      });
    }
  });

export type QuestionnaireEvaluationPayload = z.infer<
  typeof questionnaireEvaluationPayloadSchema
>;
export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;
export type RecommendedNextAction = z.infer<typeof recommendedNextActionSchema>;

export const clarificationAnswerSchema = z.object({
  question_id: z.string().min(1),
  selected_option_id: z.string().min(1).optional(),
  free_text: z.string().optional(),
});

export const questionnaireClarificationsPayloadSchema = z.object({
  answers: z.array(clarificationAnswerSchema).min(1),
});

export type ClarificationAnswer = z.infer<typeof clarificationAnswerSchema>;

export function shouldRequireClarificationScreen(
  evaluation: QuestionnaireEvaluationPayload,
): boolean {
  if (evaluation.recommended_next_action === "generate_now") {
    return false;
  }
  if (evaluation.overall_quality_score >= 80) {
    return false;
  }
  if (evaluation.clarification_questions.length === 0) {
    return false;
  }
  return true;
}
