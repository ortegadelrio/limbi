/**
 * Tipos del flujo **«Actualizar conocimiento de marca»** (BRAND-U1).
 * Persistencia en `brand_knowledge_updates`; la entrada se clasifica, revisa y luego
 * entra en una futura **reconsolidación** (no en la base activa automáticamente).
 *
 * @see `docs/LIMBI_BRAND_KNOWLEDGE_UPDATE_PIPELINE.md`
 * @see `types/database.ts` — `BrandKnowledgeUpdateRow`
 */

export type {
  BrandKnowledgeUpdateImportanceLevel,
  BrandKnowledgeUpdateSectionKey,
  BrandKnowledgeUpdateStatus,
} from "@/lib/brands/brand-knowledge-update-types";

export type BrandKnowledgeUpdateSourceType =
  | "manual_addition"
  | "correction"
  | "replacement"
  | "brainstormer_suggestion"
  | "document_finding"
  | "other";
