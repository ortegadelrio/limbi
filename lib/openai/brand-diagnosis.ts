import { getOpenAIClient } from "@/lib/openai/server";

export const FALLBACK_BRAND_DIAGNOSIS_MODEL = "gpt-4o-mini";

export function resolveBrandDiagnosisModel(): string {
  const fromEnv = process.env.OPENAI_BRAND_DIAGNOSIS_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_BRAND_DIAGNOSIS_MODEL;
}

export type BrandDiagnosisJsonResult = {
  model_used: string;
  raw_json_text: string;
};

const QUALITY_LEVELS = [
  "critical",
  "weak",
  "acceptable",
  "strong",
  "excellent",
] as const;

const NEXT_ACTIONS = [
  "improve_required",
  "improve_recommended",
  "ready_for_consolidation",
] as const;

const PRIORITIES = ["high", "medium", "low"] as const;

function stringListProp(maxItems: number, maxLen: number): Record<string, unknown> {
  return {
    type: "array",
    minItems: 0,
    maxItems,
    items: { type: "string", maxLength: maxLen },
  };
}

function sectionScoreItemProperties(sectionKeyEnum: string[]): Record<string, unknown> {
  return {
    section_key: { type: "string", enum: sectionKeyEnum },
    section_label: { type: "string", minLength: 1, maxLength: 200 },
    score: { type: "integer", minimum: 0, maximum: 100 },
    quality_level: { type: "string", enum: [...QUALITY_LEVELS] },
    diagnosis: { type: "string", minLength: 1, maxLength: 6000 },
    strengths: stringListProp(12, 800),
    gaps: stringListProp(12, 800),
    contradictions: stringListProp(12, 800),
    risks: stringListProp(12, 800),
    recommendations: stringListProp(12, 800),
    priority: { type: "string", enum: [...PRIORITIES] },
    can_generate_base: { type: "boolean" },
    should_improve_before_consolidation: { type: "boolean" },
  };
}

const SECTION_SCORE_REQUIRED = [
  "section_key",
  "section_label",
  "score",
  "quality_level",
  "diagnosis",
  "strengths",
  "gaps",
  "contradictions",
  "risks",
  "recommendations",
  "priority",
  "can_generate_base",
  "should_improve_before_consolidation",
] as const;

/**
 * JSON Schema estricto alineado con `brandDiagnosisRawOutputSchema` (Zod).
 * `section_scores` tiene longitud fija = número de secciones estratégicas.
 */
export function buildBrandDiagnosisOutputJsonSchema(
  strategicSectionKeys: string[],
): Record<string, unknown> {
  const n = strategicSectionKeys.length;
  const sectionKeyEnum = [...strategicSectionKeys];
  if (n === 0) {
    throw new Error("buildBrandDiagnosisOutputJsonSchema: se requiere al menos una sección.");
  }
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      overall_score: { type: "integer", minimum: 0, maximum: 100 },
      quality_level: { type: "string", enum: [...QUALITY_LEVELS] },
      strategic_reading: { type: "string", minLength: 1, maxLength: 12000 },
      section_scores: {
        type: "array",
        minItems: n,
        maxItems: n,
        items: {
          type: "object",
          additionalProperties: false,
          properties: sectionScoreItemProperties(sectionKeyEnum),
          required: [...SECTION_SCORE_REQUIRED],
        },
      },
      critical_gaps: {
        type: "array",
        minItems: 0,
        maxItems: 20,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            section_key: { type: "string", enum: sectionKeyEnum },
            gap: { type: "string", minLength: 1, maxLength: 2000 },
            why_it_matters: { type: "string", minLength: 1, maxLength: 2000 },
          },
          required: ["section_key", "gap", "why_it_matters"],
        },
      },
      contradictions: {
        type: "array",
        minItems: 0,
        maxItems: 20,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            section_key: { type: "string", enum: sectionKeyEnum },
            description: { type: "string", minLength: 1, maxLength: 3000 },
            suggested_resolution: { type: "string", minLength: 1, maxLength: 2000 },
          },
          required: ["section_key", "description", "suggested_resolution"],
        },
      },
      improvement_plan: {
        type: "array",
        minItems: 0,
        maxItems: 25,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            section_key: { type: "string", enum: sectionKeyEnum },
            priority: { type: "string", enum: [...PRIORITIES] },
            recommended_focus: { type: "string", minLength: 1, maxLength: 2000 },
          },
          required: ["section_key", "priority", "recommended_focus"],
        },
      },
      next_recommended_action: { type: "string", enum: [...NEXT_ACTIONS] },
    },
    required: [
      "overall_score",
      "quality_level",
      "strategic_reading",
      "section_scores",
      "critical_gaps",
      "contradictions",
      "improvement_plan",
      "next_recommended_action",
    ],
  };
}

export async function generateBrandDiagnosisJson(args: {
  input: string;
  strategicSectionKeys: string[];
}): Promise<BrandDiagnosisJsonResult> {
  const openai = getOpenAIClient();
  const model = resolveBrandDiagnosisModel();
  const schema = buildBrandDiagnosisOutputJsonSchema(args.strategicSectionKeys);

  const response = await openai.responses.create({
    model,
    input: args.input,
    stream: false,
    text: {
      format: {
        type: "json_schema",
        name: "brand_diagnosis_output",
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
