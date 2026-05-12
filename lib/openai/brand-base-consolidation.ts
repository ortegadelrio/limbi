import { getOpenAIClient } from "@/lib/openai/server";

export const FALLBACK_BRAND_BASE_CONSOLIDATION_MODEL = "gpt-4o-mini";

export function resolveBrandBaseConsolidationModel(): string {
  const fromEnv = process.env.OPENAI_BRAND_BASE_CONSOLIDATION_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_BRAND_BASE_CONSOLIDATION_MODEL;
}

export type BrandBaseConsolidationJsonResult = {
  model_used: string;
  raw_json_text: string;
};

export function buildBrandBaseConsolidationOutputJsonSchema(): Record<string, unknown> {
  const pillar = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      body: { type: "string", minLength: 1, maxLength: 6000 },
    },
    required: ["title", "body"],
  } as const;

  const knowledge = {
    type: "object",
    additionalProperties: false,
    properties: {
      curator_reading: { type: "string", minLength: 1, maxLength: 16000 },
      strategic_pillars: {
        type: "array",
        minItems: 1,
        maxItems: 12,
        items: pillar,
      },
      restrictions_and_alerts: { type: "string", minLength: 1, maxLength: 12000 },
      evidence_narrative: { type: "string", minLength: 1, maxLength: 12000 },
    },
    required: [
      "curator_reading",
      "strategic_pillars",
      "restrictions_and_alerts",
      "evidence_narrative",
    ],
  } as const;

  const limbic = {
    type: "object",
    additionalProperties: false,
    properties: {
      symbolic_reading: { type: "string", minLength: 1, maxLength: 16000 },
      atmosphere_and_metaphor: { type: "string", minLength: 1, maxLength: 12000 },
      rhythm_and_energy: { type: "string", minLength: 1, maxLength: 12000 },
      expressive_codes: { type: "string", minLength: 1, maxLength: 12000 },
      non_literal_guidance: { type: "string", minLength: 1, maxLength: 8000 },
      symbolic_restrictions: { type: "string", minLength: 1, maxLength: 8000 },
    },
    required: [
      "symbolic_reading",
      "atmosphere_and_metaphor",
      "rhythm_and_energy",
      "expressive_codes",
      "non_literal_guidance",
      "symbolic_restrictions",
    ],
  } as const;

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      knowledge_base: knowledge,
      limbic_base: limbic,
    },
    required: ["knowledge_base", "limbic_base"],
  };
}

export async function generateBrandBaseConsolidationJson(args: {
  input: string;
}): Promise<BrandBaseConsolidationJsonResult> {
  const openai = getOpenAIClient();
  const model = resolveBrandBaseConsolidationModel();
  const schema = buildBrandBaseConsolidationOutputJsonSchema();

  const response = await openai.responses.create({
    model,
    input: args.input,
    stream: false,
    text: {
      format: {
        type: "json_schema",
        name: "brand_base_consolidation_output",
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
