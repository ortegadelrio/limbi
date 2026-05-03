import { generateQuestionnaireEvaluationJson } from "@/lib/openai/questionnaire-evaluation";
import { parseQuestionnaireEvaluationJson } from "@/lib/questionnaire-evaluation/parse-evaluation";
import { finalizeEvaluationPayload } from "@/lib/questionnaire-evaluation/clarification-questions-sanitize";
import type { QuestionnaireEvaluationPayload } from "@/lib/questionnaire-evaluation/schema";
import { buildQuestionnaireEvaluationPrompt } from "@/lib/prompts/questionnaire-evaluation";

export type RunQuestionnaireEvaluationOnceResult =
  | {
      ok: true;
      evaluation: QuestionnaireEvaluationPayload;
      model_used: string;
    }
  | { ok: false; message: string };

/**
 * Una pasada de evaluación del cuestionario (OpenAI + parse + finalize/sanitize).
 */
export async function runQuestionnaireEvaluationOnce(params: {
  project_summary: Record<string, unknown>;
  responses: Record<string, unknown>;
  /** JSON o texto estructurado con respuestas de aclaración ya dadas por el usuario. */
  post_clarification_block?: string | null;
}): Promise<RunQuestionnaireEvaluationOnceResult> {
  const prompt = buildQuestionnaireEvaluationPrompt({
    project_summary: params.project_summary,
    responses_json: JSON.stringify(params.responses, null, 2),
    post_clarification_block: params.post_clarification_block ?? null,
  });

  let raw_json_text: string;
  let model_used: string;
  try {
    const gen = await generateQuestionnaireEvaluationJson(prompt);
    raw_json_text = gen.raw_json_text;
    model_used = gen.model_used;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al llamar a OpenAI.";
    return { ok: false, message: msg };
  }

  const parsed = parseQuestionnaireEvaluationJson(raw_json_text);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message };
  }

  const evaluation = finalizeEvaluationPayload(parsed.data, params.responses);
  return { ok: true, evaluation, model_used };
}
