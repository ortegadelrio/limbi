/**
 * Esqueleto de tipos para el flujo futuro **«Actualizar conocimiento de marca»**.
 * No persiste en base todavía: evita que información nueva entre como edición libre del cuestionario
 * cerrado; la entrada será clasificada, revisada y luego **reconsolidación** → nueva fila activa.
 *
 * @see `docs/LIMBI_BRAND_KNOWLEDGE_UPDATE_PIPELINE.md`
 */

export type BrandKnowledgeUpdateSourceType =
  | "manual_addition"
  | "correction"
  | "replacement"
  | "brainstormer_suggestion"
  | "document_finding"
  | "other";

export type BrandKnowledgeUpdateImportanceLevel =
  | "critical"
  | "high"
  | "medium"
  | "low";

export type BrandKnowledgeUpdateStatus =
  | "pending_review"
  | "approved"
  | "incorporated"
  | "reference_only"
  | "discarded"
  | "excluded_with_reason";

export type BrandKnowledgeUpdateAffectedOutputs =
  | "brand_knowledge_base"
  | "brand_limbic_base"
  | "project_context"
  | "generation_rules";

/**
 * Fila conceptual futura (tabla `brand_knowledge_update_items` o similar en migración posterior).
 */
export type BrandKnowledgeUpdateItemStub = {
  id: string;
  brand_id: string;
  source_type: BrandKnowledgeUpdateSourceType;
  raw_text: string;
  interpreted_summary: string | null;
  section_key: string | null;
  importance_level: BrandKnowledgeUpdateImportanceLevel;
  must_include: boolean;
  requires_user_review: boolean;
  status: BrandKnowledgeUpdateStatus;
  user_decision: string | null;
  reason_for_exclusion: string | null;
  affected_outputs: BrandKnowledgeUpdateAffectedOutputs[];
  created_at: string;
  approved_at: string | null;
  incorporated_at: string | null;
  created_by: string;
};
