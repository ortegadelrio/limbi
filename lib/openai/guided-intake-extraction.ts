import { getOpenAIClient } from "@/lib/openai/server";

export const FALLBACK_GUIDED_INTAKE_MODEL = "gpt-4o-mini";

export function resolveGuidedIntakeModel(): string {
  const fromEnv = process.env.OPENAI_GUIDED_INTAKE_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_GUIDED_INTAKE_MODEL;
}

export type GuidedIntakeExtractionJsonResult = {
  model_used: string;
  raw_json_text: string;
};

/**
 * OpenAI Responses API — JSON object output. Server-only.
 * Does not generate master document or public copy.
 *
 * Uses **prompt-based** `json_object` mode (not a bound JSON Schema). If you
 * need stricter shape guarantees, consider migrating this call to Responses
 * API `text.format` with a `json_schema` / structured-output definition that
 * mirrors `intakeExtractionOutputSchema` (and keep server-side Zod as defense).
 */
export async function generateGuidedIntakeExtractionJson(
  input: string,
): Promise<GuidedIntakeExtractionJsonResult> {
  const openai = getOpenAIClient();
  const model = resolveGuidedIntakeModel();

  const response = await openai.responses.create({
    model,
    input,
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
