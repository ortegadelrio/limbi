import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandEvaluationRow } from "@/types/database";

type TimestampRow = {
  updated_at?: string | null;
  reviewed_at?: string | null;
  approved_at?: string | null;
};

type ImprovementStalenessRow = Pick<TimestampRow, "approved_at" | "updated_at">;

type DiagnosisStalenessInput = {
  evaluation: Pick<BrandEvaluationRow, "created_at"> | null;
  responseRows?: Pick<TimestampRow, "updated_at">[];
  /** Cualquier cambio en `brand_source_facts` tras el diagnóstico (aprobación, rechazo, edición). */
  hasSourceFactsUpdatedAfterEvaluation?: boolean;
  /** @deprecated Preferir hasSourceFactsUpdatedAfterEvaluation; se mantiene por compatibilidad. */
  sourceFactRows?: Pick<TimestampRow, "reviewed_at" | "updated_at">[];
  /** Mejoras aprobadas activas: `approved_at` o `updated_at` posteriores al diagnóstico. */
  improvementRows?: ImprovementStalenessRow[];
  /** `brand_offer_profiles.updated_at` (p. ej. cambio de `offer_nature`). */
  offerProfileUpdatedAt?: string | null;
  /** Hay filas en `brand_offer_items` creadas o actualizadas después del diagnóstico. */
  hasStaleOfferItems?: boolean;
  /** Hay filas en `brand_audience_territories` creadas o actualizadas después del diagnóstico. */
  hasStaleAudienceTerritories?: boolean;
  /**
   * `brands.updated_at`: cambios de marca y “touch” tras guardar oferta estructurada o territorios
   * (Ticket D.1: borrado total sin filas hijas con timestamps nuevos).
   */
  brandRowUpdatedAt?: string | null;
};

export function isAfterEvaluationCreatedAt(
  evaluation: Pick<BrandEvaluationRow, "created_at"> | null,
  timestamp: string | null | undefined,
): boolean {
  return Boolean(evaluation?.created_at && timestamp && timestamp > evaluation.created_at);
}

export function isBrandDiagnosisStale({
  evaluation,
  responseRows = [],
  hasSourceFactsUpdatedAfterEvaluation = false,
  sourceFactRows = [],
  improvementRows = [],
  offerProfileUpdatedAt,
  hasStaleOfferItems = false,
  hasStaleAudienceTerritories = false,
  brandRowUpdatedAt,
}: DiagnosisStalenessInput): boolean {
  if (!evaluation) return false;

  if (hasStaleOfferItems || hasStaleAudienceTerritories) return true;
  if (hasSourceFactsUpdatedAfterEvaluation) return true;
  if (isAfterEvaluationCreatedAt(evaluation, offerProfileUpdatedAt ?? undefined)) {
    return true;
  }
  if (isAfterEvaluationCreatedAt(evaluation, brandRowUpdatedAt ?? undefined)) {
    return true;
  }

  return (
    responseRows.some((row) => isAfterEvaluationCreatedAt(evaluation, row.updated_at)) ||
    sourceFactRows.some(
      (row) =>
        isAfterEvaluationCreatedAt(evaluation, row.reviewed_at) ||
        isAfterEvaluationCreatedAt(evaluation, row.updated_at),
    ) ||
    improvementRows.some(
      (row) =>
        isAfterEvaluationCreatedAt(evaluation, row.approved_at) ||
        isAfterEvaluationCreatedAt(evaluation, row.updated_at),
    )
  );
}

/**
 * Señales de cuestionario estructural (oferta / territorios / perfil) posteriores al diagnóstico.
 * Incluye `brands.updated_at` para cubrir borrado total de ítems o territorios (touch en PUT).
 */
export async function fetchStructuralQuestionnaireStaleness(
  supabase: SupabaseClient,
  brandId: string,
  evaluationCreatedAt: string,
): Promise<{
  offerProfileUpdatedAt: string | null;
  brandRowUpdatedAt: string | null;
  hasStaleOfferItems: boolean;
  hasStaleAudienceTerritories: boolean;
}> {
  const t = evaluationCreatedAt;
  const [profileRes, itemsRes, terrRes, brandRes] = await Promise.all([
    supabase
      .from("brand_offer_profiles")
      .select("updated_at")
      .eq("brand_id", brandId)
      .maybeSingle(),
    supabase
      .from("brand_offer_items")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .or(`created_at.gt.${t},updated_at.gt.${t}`),
    supabase
      .from("brand_audience_territories")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .or(`created_at.gt.${t},updated_at.gt.${t}`),
    supabase.from("brands").select("updated_at").eq("id", brandId).maybeSingle(),
  ]);

  return {
    offerProfileUpdatedAt: profileRes.data?.updated_at ?? null,
    brandRowUpdatedAt: brandRes.data?.updated_at ?? null,
    hasStaleOfferItems: (itemsRes.count ?? 0) > 0,
    hasStaleAudienceTerritories: (terrRes.count ?? 0) > 0,
  };
}

/**
 * Misma lógica que el dashboard y la página de diagnóstico: obsolescencia del diagnóstico activo
 * frente a cuestionario, hallazgos, mejoras, oferta/territorios y toques de marca.
 */
export async function fetchActiveBrandDiagnosisIsStale(
  supabase: SupabaseClient,
  brandId: string,
  evaluation: Pick<BrandEvaluationRow, "created_at"> | null,
): Promise<boolean> {
  if (!evaluation?.created_at) return false;

  const t = evaluation.created_at;

  const [
    responseStaleness,
    sourceFactStaleness,
    improvementStaleness,
    structuralStaleness,
  ] = await Promise.all([
    supabase
      .from("brand_responses")
      .select("updated_at")
      .eq("brand_id", brandId)
      .gt("updated_at", t),
    supabase
      .from("brand_source_facts")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .gt("updated_at", t),
    supabase
      .from("brand_section_improvements")
      .select("approved_at, updated_at")
      .eq("brand_id", brandId)
      .eq("status", "approved")
      .eq("is_active", true)
      .or(`approved_at.gt.${t},updated_at.gt.${t}`),
    fetchStructuralQuestionnaireStaleness(supabase, brandId, t),
  ]);

  return isBrandDiagnosisStale({
    evaluation,
    responseRows: responseStaleness.data ?? [],
    hasSourceFactsUpdatedAfterEvaluation: (sourceFactStaleness.count ?? 0) > 0,
    improvementRows: improvementStaleness.data ?? [],
    offerProfileUpdatedAt: structuralStaleness.offerProfileUpdatedAt ?? null,
    hasStaleOfferItems: structuralStaleness.hasStaleOfferItems,
    hasStaleAudienceTerritories: structuralStaleness.hasStaleAudienceTerritories,
    brandRowUpdatedAt: structuralStaleness.brandRowUpdatedAt ?? null,
  });
}
