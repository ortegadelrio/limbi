import { z } from "zod";

export const BRAND_DOCUMENT_ANALYSIS_PROMPT_VERSION = "brand-document-analysis-v2.0";

/** Código estable para fallos de parseo/validación de la salida IA (UI y logs). */
export const BRAND_DOCUMENT_ANALYSIS_AI_OUTPUT_STRUCTURE_CODE =
  "ai_output_structure_invalid" as const;

function emptyStringToNull(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

const relationshipTypeSchema = z.enum([
  "new",
  "complements",
  "reinforces",
  "contradicts",
]);

const factTypeSchema = z.enum([
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
]);

export const brandDocumentAnalysisFindingSchema = z.object({
  section_key: z.string().trim().min(1).max(120),
  module_key: z.preprocess(
    emptyStringToNull,
    z.union([z.string().trim().min(1).max(120), z.null()]),
  ),
  question_key: z.preprocess(
    emptyStringToNull,
    z.union([z.string().trim().min(1).max(120), z.null()]),
  ),
  relationship_type: relationshipTypeSchema,
  fact_type: factTypeSchema,
  source_excerpt: z.preprocess(
    emptyStringToNull,
    z.union([z.string().max(800), z.null()]),
  ),
  source_reference: z.preprocess(
    emptyStringToNull,
    z.union([z.string().max(240), z.null()]),
  ),
  extracted_fact: z.string().trim().min(1).max(4000),
  ai_interpretation: z.preprocess(
    emptyStringToNull,
    z.union([z.string().max(4000), z.null()]),
  ),
  existing_response_summary: z.preprocess(
    emptyStringToNull,
    z.union([z.string().max(2000), z.null()]),
  ),
  proposed_inclusion: z.string().trim().min(1).max(4000),
  confidence_score: z.number().int().min(0).max(100).nullable(),
});

export const brandDocumentAnalysisResultSchema = z.enum([
  "findings_found",
  "no_useful_findings",
]);

export const brandDocumentAnalysisOutputSchema = z
  .object({
    analysis_summary: z.string().trim().max(1200),
    analysis_result: brandDocumentAnalysisResultSchema,
    findings: z.array(brandDocumentAnalysisFindingSchema).max(25),
    discarded_summary: z
      .object({
        duplicates: z.number().int().min(0),
        irrelevant: z.number().int().min(0),
        weak_evidence: z.number().int().min(0),
      })
      .strict(),
  })
  .superRefine((data, ctx) => {
    if (data.analysis_result === "no_useful_findings" && data.findings.length > 0) {
      ctx.addIssue({
        code: "custom",
        message:
          "Si analysis_result es no_useful_findings, findings debe ser un array vacío.",
        path: ["findings"],
      });
    }
    if (data.analysis_result === "findings_found") {
      if (data.findings.length === 0) {
        ctx.addIssue({
          code: "custom",
          message:
            "Si analysis_result es findings_found, findings debe incluir al menos un hallazgo completo.",
          path: ["findings"],
        });
      }
      for (let i = 0; i < data.findings.length; i += 1) {
        const f = data.findings[i];
        if (!f.extracted_fact.trim()) {
          ctx.addIssue({
            code: "custom",
            message: "extracted_fact no puede estar vacío cuando analysis_result es findings_found.",
            path: ["findings", i, "extracted_fact"],
          });
        }
        if (!f.proposed_inclusion.trim()) {
          ctx.addIssue({
            code: "custom",
            message:
              "proposed_inclusion no puede estar vacío cuando analysis_result es findings_found.",
            path: ["findings", i, "proposed_inclusion"],
          });
        }
      }
    }
  });

export type BrandDocumentAnalysisFindingParsed = z.infer<
  typeof brandDocumentAnalysisFindingSchema
>;
export type BrandDocumentAnalysisOutputParsed = z.infer<
  typeof brandDocumentAnalysisOutputSchema
>;
export type BrandDocumentAnalysisResultCode = z.infer<
  typeof brandDocumentAnalysisResultSchema
>;
