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
  /** Qué detectó Limbi (brecha, ambigüedad o riesgo); español natural, sin slugs internos. */
  limbi_detection: z.string().min(1).optional(),
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
  answer_status: z
    .enum(["normal", "not_available_yet", "continue_with_base", "improve_later"])
    .optional(),
  should_update_master: z.boolean().optional(),
  confidence_level: z.enum(["low", "medium", "high"]).optional(),
  strategic_topic: z.string().optional(),
  target_master_fields: z.array(z.string()).optional(),
  claim_limits: z.string().optional(),
});

export const questionnaireClarificationsPayloadSchema = z
  .object({
    answers: z.array(clarificationAnswerSchema).optional(),
    follow_up_answers: z.array(clarificationAnswerSchema).min(1).max(2).optional(),
    client_generation_caution: z.string().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    const nInitial = data.answers?.length ?? 0;
    const nFollow = data.follow_up_answers?.length ?? 0;
    if (nInitial === 0 && nFollow === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Envía answers (primera ronda) o follow_up_answers (segunda ronda), al menos una respuesta.",
        path: ["answers"],
      });
    }
    if (nInitial > 0 && nFollow > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "No envíes answers y follow_up_answers en la misma petición: usa una u otra.",
      });
    }
  });

export type QuestionnaireClarificationsPayload = z.infer<
  typeof questionnaireClarificationsPayloadSchema
>;
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
