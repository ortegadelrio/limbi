import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveBrandContextBlockingReason } from "@/lib/brands/load-active-brand-context-for-project";
import { loadActiveBrandContextForProject } from "@/lib/brands/load-active-brand-context-for-project";

export type PrepareBrainstormSessionContextOk = {
  ok: true;
  brand: { id: string; name: string };
  /** Título persistible (el usuario lo pasó o se deriva de la marca). */
  title: string;
  source_brand_knowledge_base_id: string | null;
  source_brand_limbic_base_id: string | null;
  /**
   * Metadatos de la base usada al iniciar (staleness, versiones, reglas interpretativas).
   * Complementa las columnas `source_brand_*_id` en `brainstorm_sessions`.
   */
  source_brand_context: Record<string, unknown>;
  blocking_reasons: ActiveBrandContextBlockingReason[];
  /** Requiere par de bases curadas activas (conocimiento + límbica). */
  can_start: boolean;
  /** Avisos no bloqueantes (staleness, hallazgos pendientes, etc.). */
  recommended_warning: string | null;
  interpretive_rules: readonly string[];
};

export type PrepareBrainstormSessionContextResult =
  | PrepareBrainstormSessionContextOk
  | { ok: false; code: "brand_not_found"; message: string };

/**
 * Prepara el contexto inicial de una sesión Brainstormer sin persistir ni tocar la Base de Marca.
 * Usa solo `loadActiveBrandContextForProject` (bases curadas activas); no lee `brand_responses` ni documentos crudos.
 */
export async function prepareBrainstormSessionContext(
  supabase: SupabaseClient,
  input: { userId: string; brandId: string; title?: string | null },
): Promise<PrepareBrainstormSessionContextResult> {
  const ctx = await loadActiveBrandContextForProject(supabase, input.brandId, {
    assertUserId: input.userId,
  });

  if (!ctx.ok) {
    return { ok: false, code: ctx.code, message: ctx.message };
  }

  const hasKnowledge = Boolean(ctx.active_knowledge_base);
  const hasLimbic = Boolean(ctx.active_limbic_base);
  const can_start = hasKnowledge && hasLimbic;

  const warnings: string[] = [];
  if (ctx.pending_source_facts_review) {
    warnings.push(
      "Hay hallazgos de documentos pendientes de revisión. Conviene revisarlos antes de tomar decisiones públicas.",
    );
  }
  if (ctx.is_stale) {
    warnings.push(
      "La base consolidada puede estar desactualizada respecto al diagnóstico o al cuestionario de marca.",
    );
  }
  if (!can_start) {
    warnings.push(
      "Para iniciar Brainstormer con fuentes curadas se requieren la Base de Conocimiento activa y la Base Límbica activa.",
    );
  }

  const promptVersion =
    ctx.active_knowledge_base?.prompt_version ?? ctx.active_limbic_base?.prompt_version ?? null;

  const source_brand_context: Record<string, unknown> = {
    source_brand_base_prompt_version: promptVersion,
    knowledge_consolidated_at: ctx.source_metadata.knowledge_consolidated_at,
    limbic_consolidated_at: ctx.source_metadata.limbic_consolidated_at,
    bases_stale_at_session_start: ctx.is_stale,
    knowledge_base_was_stale: ctx.knowledge_base_is_stale,
    limbic_base_was_stale: ctx.limbic_base_is_stale,
    diagnosis_stale_blocking_at_start: ctx.diagnosis_is_stale_blocking,
    pending_source_facts_review_at_start: ctx.pending_source_facts_review,
    consolidation_running_at_start: ctx.consolidation_running,
    interpretive_rules: [...ctx.interpretive_rules],
    blocking_reasons_at_start: [...ctx.blocking_reasons],
    generated_at_bogota_at_context_build: ctx.generated_at_bogota,
  };

  const trimmed = typeof input.title === "string" ? input.title.trim() : "";
  const title =
    trimmed.length > 0 ? trimmed : `Brainstorm · ${ctx.brand.name}`;

  return {
    ok: true,
    brand: ctx.brand,
    title,
    source_brand_knowledge_base_id: ctx.source_metadata.active_brand_knowledge_base_id,
    source_brand_limbic_base_id: ctx.source_metadata.active_brand_limbic_base_id,
    source_brand_context,
    blocking_reasons: ctx.blocking_reasons,
    can_start,
    recommended_warning: warnings.length > 0 ? warnings.join("\n\n") : null,
    interpretive_rules: ctx.interpretive_rules,
  };
}
