import { getOpenAIClient } from "@/lib/openai/server";

/**
 * Model used for master document generation when `OPENAI_MASTER_DOCUMENT_MODEL`
 * is unset or empty. Change here or set the env var (recommended).
 *
 * @see https://platform.openai.com/docs/models
 */
export const FALLBACK_MASTER_DOCUMENT_MODEL = "gpt-4o";

/**
 * Resolves the OpenAI model id from the environment (server-only).
 * Does not read `OPENAI_API_KEY`; use `getOpenAIClient()` for that.
 */
export function resolveMasterDocumentModel(): string {
  const fromEnv = process.env.OPENAI_MASTER_DOCUMENT_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_MASTER_DOCUMENT_MODEL;
}

export type GenerateMasterDocumentJsonResult = {
  /** Model id actually sent to the API (from env or fallback). */
  model_used: string;
  /** Raw JSON string from the Responses API (`output_text`). */
  raw_json_text: string;
};

/**
 * Calls the OpenAI **Responses** API (not Chat Completions) with JSON object mode.
 * Must run only on the server.
 */
export async function generateMasterDocumentJson(
  prompt: string,
): Promise<GenerateMasterDocumentJsonResult> {
  const openai = getOpenAIClient();
  const model = resolveMasterDocumentModel();

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
