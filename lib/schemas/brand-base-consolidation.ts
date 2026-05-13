import { z } from "zod";

export const BRAND_BASE_CONSOLIDATION_PROMPT_VERSION = "brand-base-consolidation-v1.1";

const pillarSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(6000),
});

const sectionInterpretationSchema = z.object({
  section_key: z.string().min(1).max(80),
  headline: z.string().min(1).max(220),
  interpretation: z.string().min(1).max(6000),
});

const finalHighlightsSchema = z.object({
  key_strengths: z.array(z.string().min(1).max(800)).min(2).max(8),
  strategic_tensions: z.array(z.string().min(1).max(800)).min(1).max(6),
  communication_opportunities: z.array(z.string().min(1).max(800)).min(2).max(8),
  key_limbic_signals: z.array(z.string().min(1).max(800)).min(2).max(8),
  narrative_care_and_avoids: z.array(z.string().min(1).max(800)).min(2).max(8),
});

/** Catálogo explícito de servicios/productos para piezas comerciales y consumo futuro por Limbi. */
const offerServiceCatalogEntrySchema = z.object({
  name: z.string().min(1).max(300),
  item_type: z.string().max(80),
  description: z.string().max(2000),
  strategic_role: z.string().max(800),
  main_value: z.string().max(800),
});

const offerArchitectureSchema = z.object({
  offer_nature: z.string().max(200),
  offer_summary: z.string().min(1).max(4000),
  service_catalog: z.array(offerServiceCatalogEntrySchema).max(40),
  commercial_use_guidance: z.string().min(1).max(2500),
});

export const brandKnowledgeBasePayloadSchema = z.object({
  curator_reading: z.string().min(1).max(16000),
  strategic_pillars: z.array(pillarSchema).min(1).max(12),
  restrictions_and_alerts: z.string().min(1).max(12000),
  evidence_narrative: z.string().min(1).max(12000),
  /** Lectura ejecutiva explícita (v1.1); en datos v1.0 ausente la UI usa `curator_reading`. */
  executive_reading: z.string().min(1).max(12000),
  /** Interpretación estratégica por sección; mínimo 8 entradas en v1.1. */
  section_interpretations: z.array(sectionInterpretationSchema).min(8).max(14),
  final_highlights: finalHighlightsSchema,
  internal_base_notice: z.string().min(1).max(2500),
  project_readiness_message: z.string().min(1).max(2500),
  /** Arquitectura de oferta: naturaleza, catálogo de ítems y guía para piezas comerciales (v1.1+). */
  offer_architecture: offerArchitectureSchema,
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
