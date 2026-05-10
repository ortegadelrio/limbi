import { getOpenAIClient } from "@/lib/openai/server";
import { resolveQuestionnaireEvalModel } from "@/lib/openai/questionnaire-evaluation";
import { stripJsonFence } from "@/lib/master-document/validate-openai-json";
import { z } from "zod";

const coachReplySchema = z.object({
  strategist_reply: z.string().min(1),
  /** Optional improved answer draft for this clarification (Spanish, one paragraph). */
  suggested_answer: z.union([z.string().min(1), z.null()]).optional(),
});

export type ClarificationCoachResult = {
  model_used: string;
  strategist_reply: string;
  suggested_answer: string | null;
};

export async function generateClarificationCoachReply(
  prompt: string,
): Promise<ClarificationCoachResult> {
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

  const raw_json_text = stripJsonFence(response.output_text?.trim() ?? "");
  if (!raw_json_text) {
    throw new Error("OpenAI no devolvió texto JSON en output_text.");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw_json_text);
  } catch {
    throw new Error("OpenAI devolvió JSON inválido.");
  }

  const parsed = coachReplySchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("La respuesta del coach no tiene el formato esperado.");
  }

  const suggested =
    parsed.data.suggested_answer === undefined || parsed.data.suggested_answer === null
      ? null
      : parsed.data.suggested_answer.trim();

  return {
    model_used: String(response.model ?? model),
    strategist_reply: parsed.data.strategist_reply.trim(),
    suggested_answer: suggested && suggested.length > 0 ? suggested : null,
  };
}
