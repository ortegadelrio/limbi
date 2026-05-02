import OpenAI from "openai";

let cached: OpenAI | null = null;

/**
 * Returns a singleton OpenAI client. Validates OPENAI_API_KEY only when invoked.
 * Safe to import from Server Components / Route Handlers without a key set.
 */
export function getOpenAIClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY no está configurada.");
  }
  cached ??= new OpenAI({ apiKey: key });
  return cached;
}
