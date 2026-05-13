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

const pillar = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    body: { type: "string", minLength: 1, maxLength: 6000 },
  },
  required: ["title", "body"],
} as const;

const sectionInterpretation = {
  type: "object",
  additionalProperties: false,
  properties: {
    section_key: { type: "string", minLength: 1, maxLength: 80 },
    headline: { type: "string", minLength: 1, maxLength: 220 },
    interpretation: { type: "string", minLength: 1, maxLength: 6000 },
  },
  required: ["section_key", "headline", "interpretation"],
} as const;

const finalHighlights = {
  type: "object",
  additionalProperties: false,
  properties: {
    key_strengths: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 800 },
    },
    strategic_tensions: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 800 },
    },
    communication_opportunities: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 800 },
    },
    key_limbic_signals: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 800 },
    },
    narrative_care_and_avoids: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 800 },
    },
  },
  required: [
    "key_strengths",
    "strategic_tensions",
    "communication_opportunities",
    "key_limbic_signals",
    "narrative_care_and_avoids",
  ],
} as const;

const offerServiceCatalogEntry = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 300 },
    item_type: { type: "string", minLength: 0, maxLength: 80 },
    description: { type: "string", minLength: 0, maxLength: 2000 },
    strategic_role: { type: "string", minLength: 0, maxLength: 800 },
    main_value: { type: "string", minLength: 0, maxLength: 800 },
  },
  required: ["name", "item_type", "description", "strategic_role", "main_value"],
} as const;

const offerArchitecture = {
  type: "object",
  additionalProperties: false,
  properties: {
    offer_nature: { type: "string", minLength: 0, maxLength: 200 },
    offer_summary: { type: "string", minLength: 1, maxLength: 4000 },
    service_catalog: {
      type: "array",
      minItems: 0,
      maxItems: 40,
      items: offerServiceCatalogEntry,
    },
    commercial_use_guidance: { type: "string", minLength: 1, maxLength: 2500 },
  },
  required: ["offer_nature", "offer_summary", "service_catalog", "commercial_use_guidance"],
} as const;

export function buildBrandBaseConsolidationOutputJsonSchema(): Record<string, unknown> {
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
      executive_reading: { type: "string", minLength: 1, maxLength: 12000 },
      section_interpretations: {
        type: "array",
        minItems: 8,
        maxItems: 14,
        items: sectionInterpretation,
      },
      final_highlights: finalHighlights,
      internal_base_notice: { type: "string", minLength: 1, maxLength: 2500 },
      project_readiness_message: { type: "string", minLength: 1, maxLength: 2500 },
      offer_architecture: offerArchitecture,
    },
    required: [
      "curator_reading",
      "strategic_pillars",
      "restrictions_and_alerts",
      "evidence_narrative",
      "executive_reading",
      "section_interpretations",
      "final_highlights",
      "internal_base_notice",
      "project_readiness_message",
      "offer_architecture",
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
