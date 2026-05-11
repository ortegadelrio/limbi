import { getOpenAIClient } from "@/lib/openai/server";

export const FALLBACK_BRAND_DOCUMENT_ANALYSIS_MODEL = "gpt-4o-mini";

export function resolveBrandDocumentAnalysisModel(): string {
  const fromEnv = process.env.OPENAI_BRAND_DOCUMENT_ANALYSIS_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_BRAND_DOCUMENT_ANALYSIS_MODEL;
}

export type BrandDocumentAnalysisJsonResult = {
  model_used: string;
  raw_json_text: string;
};

/**
 * JSON Schema para Structured Outputs (strict) en Responses API.
 * Debe mantenerse alineado con `brandDocumentAnalysisOutputSchema` (Zod en servidor).
 */
export const BRAND_DOCUMENT_ANALYSIS_OUTPUT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    analysis_summary: { type: "string", maxLength: 1200 },
    analysis_result: {
      type: "string",
      enum: ["findings_found", "no_useful_findings"],
    },
    findings: {
      type: "array",
      maxItems: 25,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          section_key: { type: "string", minLength: 1, maxLength: 120 },
          module_key: {
            anyOf: [
              { type: "string", minLength: 1, maxLength: 120 },
              { type: "null" },
            ],
          },
          question_key: {
            anyOf: [
              { type: "string", minLength: 1, maxLength: 120 },
              { type: "null" },
            ],
          },
          relationship_type: {
            type: "string",
            enum: ["new", "complements", "reinforces", "contradicts"],
          },
          fact_type: {
            type: "string",
            enum: [
              "identity",
              "audience",
              "value_proposition",
              "differentiator",
              "evidence",
              "tone",
              "restriction",
              "limbic_signal",
              "offer_detail",
              "positioning",
              "purpose",
              "approved_message",
              "other",
            ],
          },
          source_excerpt: {
            anyOf: [{ type: "string", maxLength: 800 }, { type: "null" }],
          },
          source_reference: {
            anyOf: [{ type: "string", maxLength: 240 }, { type: "null" }],
          },
          extracted_fact: { type: "string", minLength: 1, maxLength: 4000 },
          ai_interpretation: {
            anyOf: [{ type: "string", maxLength: 4000 }, { type: "null" }],
          },
          existing_response_summary: {
            anyOf: [{ type: "string", maxLength: 2000 }, { type: "null" }],
          },
          proposed_inclusion: { type: "string", minLength: 1, maxLength: 4000 },
          confidence_score: {
            anyOf: [
              { type: "integer", minimum: 0, maximum: 100 },
              { type: "null" },
            ],
          },
        },
        required: [
          "section_key",
          "module_key",
          "question_key",
          "relationship_type",
          "fact_type",
          "source_excerpt",
          "source_reference",
          "extracted_fact",
          "ai_interpretation",
          "existing_response_summary",
          "proposed_inclusion",
          "confidence_score",
        ],
      },
    },
    discarded_summary: {
      type: "object",
      additionalProperties: false,
      properties: {
        duplicates: { type: "integer", minimum: 0 },
        irrelevant: { type: "integer", minimum: 0 },
        weak_evidence: { type: "integer", minimum: 0 },
      },
      required: ["duplicates", "irrelevant", "weak_evidence"],
    },
  },
  required: ["analysis_summary", "analysis_result", "findings", "discarded_summary"],
};

/**
 * Análisis de documento de marca — salida JSON (server-only).
 * Structured Outputs estrictos + validación Zod en la ruta.
 */
export async function generateBrandDocumentAnalysisJson(
  input: string,
): Promise<BrandDocumentAnalysisJsonResult> {
  const openai = getOpenAIClient();
  const model = resolveBrandDocumentAnalysisModel();

  const response = await openai.responses.create({
    model,
    input,
    stream: false,
    text: {
      format: {
        type: "json_schema",
        name: "brand_document_analysis_output",
        strict: true,
        schema: BRAND_DOCUMENT_ANALYSIS_OUTPUT_JSON_SCHEMA,
      },
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
