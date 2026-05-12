import { z } from "zod";

export const BRAND_BASE_CONSOLIDATION_PROMPT_VERSION = "brand-base-consolidation-v1.0";

const pillarSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(6000),
});

export const brandKnowledgeBasePayloadSchema = z.object({
  curator_reading: z.string().min(1).max(16000),
  strategic_pillars: z.array(pillarSchema).min(1).max(12),
  restrictions_and_alerts: z.string().min(1).max(12000),
  evidence_narrative: z.string().min(1).max(12000),
});

export const brandLimbicBasePayloadSchema = z.object({
  symbolic_reading: z.string().min(1).max(16000),
  atmosphere_and_metaphor: z.string().min(1).max(12000),
  rhythm_and_energy: z.string().min(1).max(12000),
  expressive_codes: z.string().min(1).max(12000),
  non_literal_guidance: z.string().min(1).max(8000),
  symbolic_restrictions: z.string().min(1).max(8000),
});

export const brandBaseConsolidationRawOutputSchema = z.object({
  knowledge_base: brandKnowledgeBasePayloadSchema,
  limbic_base: brandLimbicBasePayloadSchema,
});

export type BrandKnowledgeBasePayloadParsed = z.infer<typeof brandKnowledgeBasePayloadSchema>;
export type BrandLimbicBasePayloadParsed = z.infer<typeof brandLimbicBasePayloadSchema>;
export type BrandBaseConsolidationRawOutputParsed = z.infer<
  typeof brandBaseConsolidationRawOutputSchema
>;
