import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveBrandContextBlockingReason } from "@/lib/brands/load-active-brand-context-for-project";
import { loadActiveBrandContextForProject } from "@/lib/brands/load-active-brand-context-for-project";
import {
  BRAND_PENDING_INCORPORATION_BRAINSTORMER_ES,
} from "@/lib/brands/brand-active-base-source-of-truth";
import type { BrainstormBrandContextStatus } from "@/types/database";

export type PrepareBrainstormSessionContextOk = {
  ok: true;
  brand: { id: string; name: string };
  /** Título persistible (el usuario lo pasó o se deriva de la marca). */
  title: string;
  source_brand_knowledge_base_id: string | null;
  source_brand_limbic_base_id: string | null;
  /** Igual que `source_brand_*`: ids de filas activas cuyo `consolidated_payload` es la fuente profunda de IA. */
  brand_knowledge_base_id_used: string | null;
  brand_limbic_base_id_used: string | null;
  /** ISO 8601: instante en que se capturó el contexto de marca para persistir en sesión. */
  brand_context_generated_at: string;
  brand_context_status: BrainstormBrandContextStatus;
  /** Códigos de bloqueo al momento de captura (vacío si `ready`). */
  brand_context_blocking_reasons: ActiveBrandContextBlockingReason[];
  /** True si había staleness, hallazgos pendientes o gaps de contrato respecto a la base activa. */
  brand_context_has_pending_updates: boolean;
  /**
   * Metadatos de la base usada al iniciar (staleness, versiones, reglas interpretativas).
   * Complementa las columnas `source_brand_*_id` en `brainstorm_sessions`.
   */
  source_brand_context: Record<string, unknown>;
  blocking_reasons: ActiveBrandContextBlockingReason[];
  /**
   * Puede iniciarse sesión con payloads profundos de ambas bases y sin bloqueos duros
   * (diagnóstico obsoleto bloqueante o consolidación en curso bloquean).
   */
  can_start: boolean;
  /** Avisos no bloqueantes o mensaje de incorporación pendiente (producto). */
  recommended_warning: string | null;
  /** Si no se puede iniciar con fuente curada válida. */
  must_consolidate_or_update_first_es: string | null;
  interpretive_rules: readonly string[];
};

export type PrepareBrainstormSessionContextResult =
  | PrepareBrainstormSessionContextOk
  | { ok: false; code: "brand_not_found"; message: string };

const MUST_FIX_BRAND_FIRST_ES =
  "Limbi no inventa contexto de marca: necesitás la Base de Conocimiento activa y la Base Límbica activa alineadas al diagnóstico vigente. Consolidá o actualizá la marca antes de brainstormear.";

/**
 * Prepara el contexto inicial de una sesión Brainstormer sin persistir ni tocar la Base de Marca.
 * Usa solo `loadActiveBrandContextForProject` (payload profundo de bases activas); no lee cuestionario crudo ni documentos.
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
  const blockedHard =
    !hasKnowledge ||
    !hasLimbic ||
    ctx.diagnosis_is_stale_blocking ||
    ctx.consolidation_running;

  const contractIssues =
    ctx.knowledge_payload_contract_gaps.length > 0 ||
    ctx.limbic_payload_contract_gaps.length > 0;

  const brand_context_has_pending_updates =
    ctx.pending_source_facts_review ||
    ctx.is_stale ||
    contractIssues;

  const brand_context_status: BrainstormBrandContextStatus = blockedHard
    ? "blocked"
    : brand_context_has_pending_updates
      ? "advisory"
      : "ready";

  const brand_context_blocking_reasons: ActiveBrandContextBlockingReason[] = blockedHard
    ? [...ctx.blocking_reasons]
    : [];

  const can_start = !blockedHard;

  const warnings: string[] = [];
  if (!can_start) {
    if (!hasKnowledge || !hasLimbic) {
      warnings.push(
        "Para iniciar Brainstormer con fuentes curadas se requieren la Base de Conocimiento activa y la Base Límbica activa.",
      );
    }
    if (ctx.diagnosis_is_stale_blocking) {
      warnings.push(
        "Actualizá el diagnóstico de marca antes de usar Brainstormer con contexto fiable.",
      );
    }
    if (ctx.consolidation_running) {
      warnings.push(
        "Hay una consolidación en curso; esperá a que termine antes de iniciar una sesión nueva.",
      );
    }
  } else if (ctx.pending_source_facts_review || ctx.is_stale || contractIssues) {
    warnings.push(BRAND_PENDING_INCORPORATION_BRAINSTORMER_ES);
  }

  const promptVersion =
    ctx.active_knowledge_base?.prompt_version ?? ctx.active_limbic_base?.prompt_version ?? null;

  const brand_context_generated_at = new Date().toISOString();

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
    brand_context_status_at_prepare: brand_context_status,
    brand_context_generated_at_iso: brand_context_generated_at,
    knowledge_payload_contract_gaps_at_start: [...ctx.knowledge_payload_contract_gaps],
    limbic_payload_contract_gaps_at_start: [...ctx.limbic_payload_contract_gaps],
  };

  const trimmed = typeof input.title === "string" ? input.title.trim() : "";
  const title =
    trimmed.length > 0 ? trimmed : `Sesión Brainstormer — ${ctx.brand.name}`;

  const kid = ctx.source_metadata.active_brand_knowledge_base_id;
  const lid = ctx.source_metadata.active_brand_limbic_base_id;

  return {
    ok: true,
    brand: ctx.brand,
    title,
    source_brand_knowledge_base_id: kid,
    source_brand_limbic_base_id: lid,
    brand_knowledge_base_id_used: kid,
    brand_limbic_base_id_used: lid,
    brand_context_generated_at,
    brand_context_status,
    brand_context_blocking_reasons,
    brand_context_has_pending_updates,
    source_brand_context,
    blocking_reasons: ctx.blocking_reasons,
    can_start,
    recommended_warning: warnings.length > 0 ? warnings.join("\n\n") : null,
    must_consolidate_or_update_first_es: blockedHard ? MUST_FIX_BRAND_FIRST_ES : null,
    interpretive_rules: ctx.interpretive_rules,
  };
}
