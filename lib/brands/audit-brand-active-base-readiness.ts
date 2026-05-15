import type { SupabaseClient } from "@supabase/supabase-js";
import { formatBogotaDateTime } from "@/lib/datetime/format-bogota-date-time";
import { loadActiveBrandContextForProject } from "@/lib/brands/load-active-brand-context-for-project";

/**
 * Auditoría mínima post-consolidación (o en cualquier chequeo de salud de marca).
 * Responde: pendientes humanos, staleness, contrato de payload y si el par activo está listo para IA.
 */
export type BrandActiveBaseReadinessAudit = {
  checked_at_bogota: string;
  has_pending_source_facts: boolean;
  active_knowledge_base_id: string | null;
  active_limbic_base_id: string | null;
  active_pair_present: boolean;
  knowledge_base_is_stale: boolean;
  limbic_base_is_stale: boolean;
  diagnosis_stale_blocking: boolean;
  consolidation_running: boolean;
  knowledge_contract_gaps: string[];
  limbic_contract_gaps: string[];
  meets_minimum_ia_contract: boolean;
  /** Mensajes cortos para UI o logs (sin payloads). */
  alerts: string[];
};

export async function auditBrandActiveBaseReadiness(
  supabase: SupabaseClient,
  brandId: string,
  options?: { assertUserId?: string },
): Promise<BrandActiveBaseReadinessAudit | { ok: false; code: string; message: string }> {
  const ctx = await loadActiveBrandContextForProject(supabase, brandId, {
    assertUserId: options?.assertUserId,
  });
  if (!ctx.ok) {
    return { ok: false, code: ctx.code, message: ctx.message };
  }

  const alerts: string[] = [];
  if (ctx.pending_source_facts_review) {
    alerts.push("Hay hallazgos de documentos pendientes de revisión humana.");
  }
  if (ctx.diagnosis_is_stale_blocking) {
    alerts.push("El diagnóstico activo está obsoleto; conviene regenerarlo antes de confiar en la base.");
  }
  if (ctx.knowledge_base_is_stale || ctx.limbic_base_is_stale) {
    alerts.push("Al menos una base consolidada está desactualizada respecto al diagnóstico o al cuestionario.");
  }
  if (ctx.consolidation_running) {
    alerts.push("Hay consolidación en curso.");
  }
  const meets_minimum_ia_contract =
    ctx.knowledge_payload_contract_gaps.length === 0 &&
    ctx.limbic_payload_contract_gaps.length === 0;
  if (!meets_minimum_ia_contract) {
    alerts.push("El JSON consolidado no cumple el contrato mínimo esperado para consumo por IA.");
  }

  const active_pair_present = Boolean(ctx.active_knowledge_base && ctx.active_limbic_base);

  return {
    checked_at_bogota: formatBogotaDateTime(new Date().toISOString()),
    has_pending_source_facts: ctx.pending_source_facts_review,
    active_knowledge_base_id: ctx.source_metadata.active_brand_knowledge_base_id,
    active_limbic_base_id: ctx.source_metadata.active_brand_limbic_base_id,
    active_pair_present,
    knowledge_base_is_stale: ctx.knowledge_base_is_stale,
    limbic_base_is_stale: ctx.limbic_base_is_stale,
    diagnosis_stale_blocking: ctx.diagnosis_is_stale_blocking,
    consolidation_running: ctx.consolidation_running,
    knowledge_contract_gaps: [...ctx.knowledge_payload_contract_gaps],
    limbic_contract_gaps: [...ctx.limbic_payload_contract_gaps],
    meets_minimum_ia_contract,
    alerts,
  };
}
