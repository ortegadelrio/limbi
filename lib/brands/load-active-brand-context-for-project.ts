import type { SupabaseClient } from "@supabase/supabase-js";
import { formatBogotaDateTime } from "@/lib/datetime/format-bogota-date-time";
import { loadBrandBasesDetailState } from "@/lib/brands/load-brand-bases-state";
import type { BrandKnowledgeBaseRow, BrandLimbicBaseRow } from "@/types/database";

/**
 * Reglas de interpretación que todo consumidor de este contexto (p. ej. proyectos)
 * debe aplicar al usar bases curadas. No sustituyen el payload; alinean lectura humana e IA.
 */
export const BRAND_CONTEXT_INTERPRETIVE_RULES_FOR_PROJECTS_ES: readonly string[] = [
  "Las restricciones, alertas, riesgos y tensiones del JSON de conocimiento son guardrails y límites estratégicos: no son claims comerciales positivos ni copy público obligatorio.",
  "Lo negativo o delicado del diagnóstico o de la base no debe convertirse en mensaje visible hacia audiencias externas salvo instrucción explícita del usuario y revisión humana.",
  "La Base Límbica es simbólica y atmosférica: metáforas, ritmo y códigos expresivos guían tono y sensación; no son instrucciones literales de diseño ni hechos clínicos.",
  "La oferta estructurada (`offer_architecture`, `service_catalog`) es insumo operativo para piezas comerciales (brochures, landings, presentaciones): debe listarse con fidelidad al catálogo consolidado, sin inventar servicios.",
  "Para piezas comerciales futuras, `service_catalog` es la lista canónica de servicios/productos tal como quedó consolidada en la Base de Conocimiento activa.",
  "Las piezas generadas deben respetar palabras, temas y enfoques a evitar indicados en restricciones, avisos y guías simbólicas de la base.",
] as const;

/** Alineado al prompt `brand-base-consolidation-v1.1` (secciones mínimas en `section_interpretations`). */
const SECTION_KEYS_EXPECTED_IN_KNOWLEDGE = [
  "identity",
  "offer",
  "audiences",
  "value_proposition",
  "differentiators",
  "evidence",
  "voice_tone",
  "restrictions",
] as const;

export type ActiveBrandContextBlockingReason =
  | "no_active_knowledge_base"
  | "no_active_limbic_base"
  | "pending_source_facts_review"
  | "diagnosis_stale"
  | "knowledge_base_stale"
  | "limbic_base_stale";

export function deriveActiveBrandContextBlockingReasons(args: {
  has_knowledge: boolean;
  has_limbic: boolean;
  knowledge_stale: boolean;
  limbic_stale: boolean;
  pending_source_facts_review: boolean;
  diagnosis_stale: boolean;
}): ActiveBrandContextBlockingReason[] {
  const out: ActiveBrandContextBlockingReason[] = [];
  if (args.pending_source_facts_review) out.push("pending_source_facts_review");
  if (args.diagnosis_stale) out.push("diagnosis_stale");
  if (!args.has_knowledge) out.push("no_active_knowledge_base");
  if (!args.has_limbic) out.push("no_active_limbic_base");
  if (args.has_knowledge && args.knowledge_stale) out.push("knowledge_base_stale");
  if (args.has_limbic && args.limbic_stale) out.push("limbic_base_stale");
  return out;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Trazas de origen si el snapshot de consolidación las incluye (p. ej. heredadas del diagnóstico). */
export function pickSourceTraceFromSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
): unknown {
  if (!snapshot) return null;
  if ("source_trace" in snapshot) return snapshot.source_trace;
  if ("sourceTrace" in snapshot) return snapshot.sourceTrace;
  return null;
}

/**
 * Contrato mínimo de lectura para proyectos respecto al JSON `brand-base-consolidation-v1.1`.
 * Algunos conceptos de producto viven bajo nombres distintos en el schema actual:
 * p. ej. `restrictions_and_alerts` cubre guardrails; `section_interpretations` cubre propuesta/audiencias/diferenciación/voz.
 */
export function assessKnowledgePayloadForProjectContract(
  payload: Record<string, unknown> | null | undefined,
): { gaps: string[]; service_catalog_length: number } {
  const gaps: string[] = [];
  if (!payload) {
    return { gaps: ["missing_knowledge_payload"], service_catalog_length: 0 };
  }
  const offer = asRecord(payload.offer_architecture);
  if (!offer) gaps.push("missing_offer_architecture");
  const catalog = offer?.service_catalog;
  const service_catalog_length = Array.isArray(catalog) ? catalog.length : 0;
  if (!offer || !Array.isArray(catalog)) {
    gaps.push("missing_or_invalid_service_catalog");
  }
  if (typeof payload.restrictions_and_alerts !== "string" || !payload.restrictions_and_alerts) {
    gaps.push("missing_restrictions_and_alerts");
  }
  const sections = payload.section_interpretations;
  const keys = new Set<string>();
  if (Array.isArray(sections)) {
    for (const row of sections) {
      const r = asRecord(row);
      const sk = typeof r?.section_key === "string" ? r.section_key : "";
      if (sk) keys.add(sk);
    }
  } else {
    gaps.push("missing_section_interpretations");
  }
  for (const req of SECTION_KEYS_EXPECTED_IN_KNOWLEDGE) {
    if (!keys.has(req)) gaps.push(`missing_section_interpretation:${req}`);
  }
  return { gaps, service_catalog_length };
}

const LIMBIC_KEYS_REQUIRED = [
  "symbolic_reading",
  "atmosphere_and_metaphor",
  "rhythm_and_energy",
  "expressive_codes",
  "non_literal_guidance",
  "symbolic_restrictions",
] as const;

/**
 * Contrato de Base Límbica consolidada (`brand-base-consolidation-v1.1`).
 * Mapeo conceptual a nombres de producto: `rhythm_and_energy` ↔ energía/movimiento;
 * `atmosphere_and_metaphor` ↔ atmósfera visual/emocional; `non_literal_guidance` ↔ cómo usar (simbólico);
 * `symbolic_restrictions` ↔ cómo no usar / palabras a evitar en lectura simbólica.
 */
export function assessLimbicPayloadForProjectContract(
  payload: Record<string, unknown> | null | undefined,
): { gaps: string[] } {
  if (!payload) return { gaps: ["missing_limbic_payload"] };
  const gaps: string[] = [];
  for (const k of LIMBIC_KEYS_REQUIRED) {
    if (typeof payload[k] !== "string" || !(payload[k] as string).trim()) {
      gaps.push(`missing_limbic_field:${k}`);
    }
  }
  return { gaps };
}

export type ActiveBrandContextSourceMetadata = {
  brand_id: string;
  brand_name: string;
  active_brand_knowledge_base_id: string | null;
  active_brand_limbic_base_id: string | null;
  knowledge_consolidated_at: string | null;
  limbic_consolidated_at: string | null;
  prompt_version: string | null;
  source_snapshot: Record<string, unknown> | null;
  source_trace: unknown;
};

export type ActiveBrandContextForProjectOk = {
  ok: true;
  brand: { id: string; name: string };
  active_knowledge_base: BrandKnowledgeBaseRow | null;
  active_limbic_base: BrandLimbicBaseRow | null;
  knowledge_payload: Record<string, unknown> | null;
  limbic_payload: Record<string, unknown> | null;
  source_metadata: ActiveBrandContextSourceMetadata;
  is_stale: boolean;
  blocking_reasons: ActiveBrandContextBlockingReason[];
  knowledge_payload_contract_gaps: string[];
  limbic_payload_contract_gaps: string[];
  consolidation_running: boolean;
  knowledge_base_is_stale: boolean;
  limbic_base_is_stale: boolean;
  pending_source_facts_review: boolean;
  diagnosis_is_stale_blocking: boolean;
  generated_at_bogota: string;
  interpretive_rules: readonly string[];
};

export type LoadActiveBrandContextForProjectResult =
  | ActiveBrandContextForProjectOk
  | { ok: false; code: "brand_not_found"; message: string };

/**
 * Fuente de verdad de marca para construcción futura de proyectos: solo bases curadas activas
 * (`brand_knowledge_bases` / `brand_limbic_bases`) y metadatos de consolidación.
 *
 * No usa `brand_responses`, documentos, facts pendientes ni chats como fuente de contenido.
 * (La detección de staleness en el sistema reutiliza timestamps agregados en otros módulos;
 * este módulo no selecciona filas de cuestionario ni extracciones para armar el contexto.)
 */
export async function loadActiveBrandContextForProject(
  supabase: SupabaseClient,
  brandId: string,
  options?: { assertUserId?: string },
): Promise<LoadActiveBrandContextForProjectResult> {
  let brandQuery = supabase.from("brands").select("id, name").eq("id", brandId);
  if (options?.assertUserId) {
    brandQuery = brandQuery.eq("user_id", options.assertUserId);
  }
  const { data: brandRow, error: brandErr } = await brandQuery.maybeSingle();
  if (brandErr || !brandRow) {
    return { ok: false, code: "brand_not_found", message: "Marca no encontrada o no accesible." };
  }

  const brand = {
    id: brandRow.id,
    name: String(brandRow.name ?? "").trim() || "Marca",
  };

  const bases = await loadBrandBasesDetailState(supabase, brandId);
  const k = bases.knowledge_base;
  const l = bases.limbic_base;

  const knowledge_payload = k?.consolidated_payload
    ? asRecord(k.consolidated_payload)
    : null;
  const limbic_payload = l?.consolidated_payload ? asRecord(l.consolidated_payload) : null;

  const kSnap = k?.source_snapshot ? asRecord(k.source_snapshot) : null;
  const source_snapshot = kSnap ?? (l?.source_snapshot ? asRecord(l.source_snapshot) : null);
  const source_trace = pickSourceTraceFromSnapshot(source_snapshot);

  const pending = bases.pending_review_count > 0;
  const diagnosisStaleBlocking = bases.has_active_diagnosis && bases.diagnosis_is_stale;

  const blocking_reasons = deriveActiveBrandContextBlockingReasons({
    has_knowledge: Boolean(k),
    has_limbic: Boolean(l),
    knowledge_stale: bases.knowledge_base_is_stale,
    limbic_stale: bases.limbic_base_is_stale,
    pending_source_facts_review: pending,
    diagnosis_stale: diagnosisStaleBlocking,
  });

  const kContract = assessKnowledgePayloadForProjectContract(knowledge_payload);
  const lContract = assessLimbicPayloadForProjectContract(limbic_payload);

  const is_stale =
    bases.knowledge_base_is_stale ||
    bases.limbic_base_is_stale ||
    diagnosisStaleBlocking;

  const prompt_version = k?.prompt_version ?? l?.prompt_version ?? null;

  return {
    ok: true,
    brand,
    active_knowledge_base: k,
    active_limbic_base: l,
    knowledge_payload,
    limbic_payload,
    source_metadata: {
      brand_id: brand.id,
      brand_name: brand.name,
      active_brand_knowledge_base_id: k?.id ?? null,
      active_brand_limbic_base_id: l?.id ?? null,
      knowledge_consolidated_at: k?.created_at ?? null,
      limbic_consolidated_at: l?.created_at ?? null,
      prompt_version,
      source_snapshot,
      source_trace,
    },
    is_stale,
    blocking_reasons,
    knowledge_payload_contract_gaps: kContract.gaps,
    limbic_payload_contract_gaps: lContract.gaps,
    consolidation_running: bases.consolidation_running,
    knowledge_base_is_stale: bases.knowledge_base_is_stale,
    limbic_base_is_stale: bases.limbic_base_is_stale,
    pending_source_facts_review: pending,
    diagnosis_is_stale_blocking: diagnosisStaleBlocking,
    generated_at_bogota: formatBogotaDateTime(new Date().toISOString()),
    interpretive_rules: BRAND_CONTEXT_INTERPRETIVE_RULES_FOR_PROJECTS_ES,
  };
}
