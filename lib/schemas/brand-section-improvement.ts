import { z } from "zod";

export const BRAND_SECTION_IMPROVE_PROMPT_VERSION = "brand-section-improve-v1.0";

export const brandSectionImproveConversationStateSchema = z.enum([
  "asking_questions",
  "draft_ready",
  "needs_user_decision",
  "completed",
  "blocked",
]);

export const brandSectionImproveConfidenceSchema = z.enum(["low", "medium", "high"]);

export const brandSectionImproveSuggestedNextSchema = z.enum([
  "answer_questions",
  "refine",
  "approve",
  "leave_pending",
  "return_to_diagnosis",
]);

const improveQuestionSchema = z.object({
  question: z.string().min(1).max(1200),
  why_it_matters: z.string().min(1).max(1200),
});

const proposedChangeSchema = z.object({
  question_key: z.string().min(1).max(120),
  current_summary: z.string().min(1).max(4000),
  proposed_improved_text: z.string().min(1).max(8000),
  rationale: z.string().min(1).max(4000),
  confidence: brandSectionImproveConfidenceSchema,
});

const remainingGapSchema = z.object({
  gap: z.string().min(1).max(2000),
  why_it_matters: z.string().min(1).max(2000),
});

export const brandSectionImproveTurnOutputSchema = z
  .object({
    assistant_message: z.string().min(1).max(12000),
    conversation_state: brandSectionImproveConversationStateSchema,
    questions: z.array(improveQuestionSchema).max(3),
    proposed_changes: z.array(proposedChangeSchema).max(20),
    remaining_gaps: z.array(remainingGapSchema).max(12),
    suggested_next_step_for_user: brandSectionImproveSuggestedNextSchema,
    should_warn_max_turns: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.conversation_state === "draft_ready" && data.proposed_changes.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Si conversation_state es draft_ready, proposed_changes no puede estar vacío.",
        path: ["proposed_changes"],
      });
    }
  });

export type BrandSectionImproveTurnOutputParsed = z.infer<
  typeof brandSectionImproveTurnOutputSchema
>;

export const brandSectionImproveCreateSessionBodySchema = z.object({
  section_key: z.string().min(1).max(120),
});

export const brandSectionImprovePostMessageBodySchema = z.object({
  content: z.string().min(1).max(12000),
});

export const brandSectionImproveApproveBodySchema = z.object({}).strict();

/** Valida que cada question_key de proposed_changes pertenezca al conjunto permitido. */
export function validateProposedChangeQuestionKeys(
  parsed: BrandSectionImproveTurnOutputParsed,
  allowedQuestionKeys: Set<string>,
): { ok: true } | { ok: false; message: string } {
  for (const p of parsed.proposed_changes) {
    if (!allowedQuestionKeys.has(p.question_key)) {
      return {
        ok: false,
        message: `question_key no pertenece a esta sección: ${p.question_key}`,
      };
    }
  }
  return { ok: true };
}
