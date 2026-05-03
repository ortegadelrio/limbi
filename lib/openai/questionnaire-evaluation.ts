import { getOpenAIClient } from "@/lib/openai/server";

export const FALLBACK_QUESTIONNAIRE_EVAL_MODEL = "gpt-4o";

export function resolveQuestionnaireEvalModel(): string {
  const fromEnv = process.env.OPENAI_QUESTIONNAIRE_EVAL_MODEL?.trim();
  return fromEnv && fromEnv.length > 0
    ? fromEnv
    : FALLBACK_QUESTIONNAIRE_EVAL_MODEL;
}

export type GenerateQuestionnaireEvaluationJsonResult = {
  model_used: string;
  raw_json_text: string;
};

export async function generateQuestionnaireEvaluationJson(
  prompt: string,
): Promise<GenerateQuestionnaireEvaluationJsonResult> {
  const openai = getOpenAIClient();
  const model = resolveQuestionnaireEvalModel();

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
