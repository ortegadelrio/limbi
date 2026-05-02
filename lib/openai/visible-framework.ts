import { getOpenAIClient } from "@/lib/openai/server";

/**
 * Model used when `OPENAI_VISIBLE_FRAMEWORK_MODEL` is unset or empty.
 * Override via env (recommended) or change this constant.
 *
 * @see https://platform.openai.com/docs/models
 */
export const FALLBACK_VISIBLE_FRAMEWORK_MODEL = "gpt-4o";

export function resolveVisibleFrameworkModel(): string {
  const fromEnv = process.env.OPENAI_VISIBLE_FRAMEWORK_MODEL?.trim();
  return fromEnv && fromEnv.length > 0
    ? fromEnv
    : FALLBACK_VISIBLE_FRAMEWORK_MODEL;
}

export type GenerateVisibleFrameworkJsonResult = {
  model_used: string;
  raw_json_text: string;
};

/**
 * OpenAI **Responses** API with JSON object mode. Server-only.
 */
export async function generateVisibleFrameworkJson(
  prompt: string,
): Promise<GenerateVisibleFrameworkJsonResult> {
  const openai = getOpenAIClient();
  const model = resolveVisibleFrameworkModel();

  const response = await openai.responses.create({
    model,
    input: prompt,
    stream: false,
    text: {
      format: { type: "json_object" },
    },
  });

  if (response.error) {
    throw new Error(
      response.error.message ?? "OpenAI devolvió un error en la respuesta.",
    );
  }

  if (response.status && response.status !== "completed") {
    const reason = response.incomplete_details?.reason ?? response.status;
    throw new Error(
      `La respuesta de OpenAI no está completa (estado: ${String(reason)}).`,
    );
  }

  const raw_json_text = response.output_text?.trim() ?? "";
  if (!raw_json_text) {
    throw new Error("OpenAI no devolvió texto JSON en output_text.");
  }

  return { model_used: String(response.model ?? model), raw_json_text };
}
