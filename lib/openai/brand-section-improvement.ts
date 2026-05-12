import { getOpenAIClient } from "@/lib/openai/server";

export const FALLBACK_BRAND_SECTION_IMPROVE_MODEL = "gpt-4o-mini";

export function resolveBrandSectionImproveModel(): string {
  const fromEnv = process.env.OPENAI_BRAND_SECTION_IMPROVE_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_BRAND_SECTION_IMPROVE_MODEL;
}

export type BrandSectionImproveJsonResult = {
  model_used: string;
  raw_json_text: string;
};

const CONV_STATES = [
  "asking_questions",
  "draft_ready",
  "needs_user_decision",
  "completed",
  "blocked",
] as const;

const SUGGESTED_NEXT = [
  "answer_questions",
  "refine",
  "approve",
  "leave_pending",
  "return_to_diagnosis",
] as const;

const CONFIDENCE = ["low", "medium", "high"] as const;

export function buildBrandSectionImproveTurnJsonSchema(
  allowedQuestionKeys: string[],
): Record<string, unknown> {
  if (allowedQuestionKeys.length === 0) {
    throw new Error("Se requiere al menos un question_key para el schema.");
  }
  const qEnum = [...allowedQuestionKeys];
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      assistant_message: { type: "string", minLength: 1, maxLength: 12000 },
      conversation_state: { type: "string", enum: [...CONV_STATES] },
      questions: {
        type: "array",
        minItems: 0,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            question: { type: "string", minLength: 1, maxLength: 1200 },
            why_it_matters: { type: "string", minLength: 1, maxLength: 1200 },
          },
          required: ["question", "why_it_matters"],
        },
      },
      proposed_changes: {
        type: "array",
        maxItems: 20,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            question_key: { type: "string", enum: qEnum },
            current_summary: { type: "string", minLength: 1, maxLength: 4000 },
            proposed_improved_text: { type: "string", minLength: 1, maxLength: 8000 },
            rationale: { type: "string", minLength: 1, maxLength: 4000 },
            confidence: { type: "string", enum: [...CONFIDENCE] },
          },
          required: [
            "question_key",
            "current_summary",
            "proposed_improved_text",
            "rationale",
            "confidence",
          ],
        },
      },
      remaining_gaps: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            gap: { type: "string", minLength: 1, maxLength: 2000 },
            why_it_matters: { type: "string", minLength: 1, maxLength: 2000 },
          },
          required: ["gap", "why_it_matters"],
        },
      },
      suggested_next_step_for_user: { type: "string", enum: [...SUGGESTED_NEXT] },
      should_warn_max_turns: { type: "boolean" },
    },
    required: [
      "assistant_message",
      "conversation_state",
      "questions",
      "proposed_changes",
      "remaining_gaps",
      "suggested_next_step_for_user",
      "should_warn_max_turns",
    ],
  };
}

export async function generateBrandSectionImproveTurnJson(args: {
  input: string;
  allowedQuestionKeys: string[];
}): Promise<BrandSectionImproveJsonResult> {
  const openai = getOpenAIClient();
  const model = resolveBrandSectionImproveModel();
  const schema = buildBrandSectionImproveTurnJsonSchema(args.allowedQuestionKeys);

  const response = await openai.responses.create({
    model,
    input: args.input,
    stream: false,
    text: {
      format: {
        type: "json_schema",
        name: "brand_section_improve_turn",
        strict: true,
        schema,
      },
    },
  });

  if (response.error) {
    throw new Error(response.error.message ?? "OpenAI devolvió un error en la respuesta.");
  }

  if (response.status && response.status !== "completed") {
    const reason = response.incomplete_details?.reason ?? response.status;
    throw new Error(`La respuesta de OpenAI no está completa (estado: ${String(reason)}).`);
  }

  const raw_json_text = response.output_text?.trim() ?? "";
  if (!raw_json_text) {
    throw new Error("OpenAI no devolvió texto JSON en output_text.");
  }

  return { model_used: String(response.model ?? model), raw_json_text };
}
