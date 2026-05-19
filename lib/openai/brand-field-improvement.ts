import { getOpenAIClient } from "@/lib/openai/server";

export const FALLBACK_BRAND_FIELD_IMPROVE_MODEL = "gpt-4o-mini";

export function resolveBrandFieldImproveModel(): string {
  const fromEnv = process.env.OPENAI_BRAND_FIELD_IMPROVE_MODEL?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const section = process.env.OPENAI_BRAND_SECTION_IMPROVE_MODEL?.trim();
  return section && section.length > 0 ? section : FALLBACK_BRAND_FIELD_IMPROVE_MODEL;
}

export type BrandFieldImproveJsonResult = {
  model_used: string;
  raw_json_text: string;
};

export function buildBrandFieldImproveTurnJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      assistant_message: { type: "string", minLength: 1, maxLength: 8000 },
      conversation_state: { type: "string", enum: ["asking", "proposal_ready"] },
      clarifying_question: { type: ["string", "null"], maxLength: 2000 },
      proposed_answer_text: { type: ["string", "null"], maxLength: 8000 },
      rationale: { type: ["string", "null"], maxLength: 4000 },
    },
    required: [
      "assistant_message",
      "conversation_state",
      "clarifying_question",
      "proposed_answer_text",
      "rationale",
    ],
  };
}

export async function generateBrandFieldImproveTurnJson(args: {
  system: string;
  user: string;
}): Promise<BrandFieldImproveJsonResult> {
  const client = getOpenAIClient();
  const model = resolveBrandFieldImproveModel();
  const schema = buildBrandFieldImproveTurnJsonSchema();

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "brand_field_improve_turn",
        strict: true,
        schema,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("OpenAI no devolvió contenido para mejora de campo.");
  }
  return { model_used: model, raw_json_text: raw };
}
