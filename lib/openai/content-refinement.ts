import { generateContentGenerationJson } from "@/lib/openai/content-generation";

export type GenerateContentRefinementJsonResult = {
  model_used: string;
  raw_json_text: string;
};

/**
 * Misma API Responses + JSON que generación de contenidos; modelo configurable vía entorno.
 */
export async function generateContentRefinementJson(
  prompt: string,
): Promise<GenerateContentRefinementJsonResult> {
  return generateContentGenerationJson(prompt);
}
