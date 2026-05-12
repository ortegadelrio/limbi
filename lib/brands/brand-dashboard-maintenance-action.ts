export type BrandDashboardMaintenanceWarningState =
  | "none"
  | "pending_facts"
  | "consolidation_running"
  | "both_stale"
  | "base_stale_only"
  | "diagnosis_stale_only";

export type BrandDashboardPrimaryMaintenanceRole =
  | "review_pending_facts"
  | "update_all"
  | "update_base_only"
  | "generate_diagnosis"
  | "create_base"
  | "none_up_to_date"
  | "blocked_busy";

export type BrandDashboardMaintenanceBlockingReason =
  | "pending_facts"
  | "consolidation_running"
  | null;

export type BrandDashboardMaintenanceResolved = {
  warningState: BrandDashboardMaintenanceWarningState;
  /** Aviso explícito de base desactualizada (diagnóstico vigente). */
  baseStaleNotice: { title: string; body: string } | null;
  /** Diagnóstico y base obsoletos a la vez. */
  combinedStaleNotice: { title: string; body: string } | null;
  /** Diagnóstico obsoleto sin bases o sin base stale aún. */
  diagnosisStaleNotice: { title: string; body: string } | null;
  primaryRole: BrandDashboardPrimaryMaintenanceRole;
  primaryLabel: string;
  /** Destino si el CTA principal es un link (hallazgos pendientes). */
  primaryHref: string | null;
  canRunUpdateAll: boolean;
  blockingReason: BrandDashboardMaintenanceBlockingReason;
  /** Estado cuando no hay acción de actualización (todo vigente). */
  upToDateHeadline: string | null;
};

export function buildBrandDashboardMaintenanceSecondaryLinks(brandId: string): {
  label: string;
  href: string;
}[] {
  const base = `/brands/${brandId}`;
  return [
    { label: "Editar información de marca", href: `${base}/questionnaire` },
    { label: "Ver diagnóstico", href: `${base}/diagnosis` },
    { label: "Ver Base de Marca", href: `${base}/bases` },
    { label: "Ver hallazgos", href: `${base}/source-facts` },
  ];
}

/**
 * Un solo CTA principal de mantenimiento en el dashboard de marca + avisos de staleness.
 */
export function resolveBrandDashboardMaintenance(input: {
  brandId: string;
  pendingFactsCount: number;
  consolidationRunning: boolean;
  hasActiveDiagnosis: boolean;
  diagnosisIsStale: boolean;
  hasActiveBases: boolean;
  basesStale: boolean;
}): BrandDashboardMaintenanceResolved {
  const {
    brandId,
    pendingFactsCount,
    consolidationRunning,
    hasActiveDiagnosis,
    diagnosisIsStale,
    hasActiveBases,
    basesStale,
  } = input;

  const sourceFactsHref = `/brands/${brandId}/source-facts`;

  const baseStaleNotice =
    !diagnosisIsStale && hasActiveBases && basesStale
      ? {
          title: "La Base de Marca está desactualizada.",
          body: "Hay información nueva después de la última consolidación. Actualiza la base para que Limbi trabaje con la versión más reciente de la marca.",
        }
      : null;

  const combinedStaleNotice =
    diagnosisIsStale && hasActiveBases && basesStale
      ? {
          title: "Hay información nueva en la marca.",
          body: "Actualiza el diagnóstico y la Base de Marca para trabajar con información vigente.",
        }
      : null;

  const diagnosisStaleNotice =
    diagnosisIsStale && hasActiveDiagnosis && !(hasActiveBases && basesStale)
      ? {
          title: "El diagnóstico está desactualizado.",
          body: "Hay información nueva después del último diagnóstico. Actualizá para alinear la lectura estratégica con la marca.",
        }
      : null;

  if (pendingFactsCount > 0) {
    return {
      warningState: "pending_facts",
      baseStaleNotice,
      combinedStaleNotice,
      diagnosisStaleNotice,
      primaryRole: "review_pending_facts",
      primaryLabel: "Revisar hallazgos pendientes",
      primaryHref: sourceFactsHref,
      canRunUpdateAll: false,
      blockingReason: "pending_facts",
      upToDateHeadline: null,
    };
  }

  if (consolidationRunning) {
    return {
      warningState: "consolidation_running",
      baseStaleNotice,
      combinedStaleNotice,
      diagnosisStaleNotice,
      primaryRole: "blocked_busy",
      primaryLabel: "Consolidación en curso…",
      primaryHref: null,
      canRunUpdateAll: false,
      blockingReason: "consolidation_running",
      upToDateHeadline: null,
    };
  }

  if (!hasActiveDiagnosis) {
    return {
      warningState: "none",
      baseStaleNotice,
      combinedStaleNotice,
      diagnosisStaleNotice: null,
      primaryRole: "generate_diagnosis",
      primaryLabel: "Generar diagnóstico",
      primaryHref: null,
      canRunUpdateAll: false,
      blockingReason: null,
      upToDateHeadline: null,
    };
  }

  if (diagnosisIsStale) {
    return {
      warningState:
        hasActiveBases && basesStale ? "both_stale" : "diagnosis_stale_only",
      baseStaleNotice,
      combinedStaleNotice,
      diagnosisStaleNotice,
      primaryRole: "update_all",
      primaryLabel: "Actualizar todo",
      primaryHref: null,
      canRunUpdateAll: true,
      blockingReason: null,
      upToDateHeadline: null,
    };
  }

  if (hasActiveBases && basesStale) {
    return {
      warningState: "base_stale_only",
      baseStaleNotice,
      combinedStaleNotice,
      diagnosisStaleNotice: null,
      primaryRole: "update_base_only",
      primaryLabel: "Actualizar Base de Marca",
      primaryHref: null,
      canRunUpdateAll: false,
      blockingReason: null,
      upToDateHeadline: null,
    };
  }

  if (!hasActiveBases) {
    return {
      warningState: "none",
      baseStaleNotice: null,
      combinedStaleNotice: null,
      diagnosisStaleNotice: null,
      primaryRole: "create_base",
      primaryLabel: "Generar Base de Marca",
      primaryHref: null,
      canRunUpdateAll: false,
      blockingReason: null,
      upToDateHeadline: null,
    };
  }

  return {
    warningState: "none",
    baseStaleNotice: null,
    combinedStaleNotice: null,
    diagnosisStaleNotice: null,
    primaryRole: "none_up_to_date",
    primaryLabel: "",
    primaryHref: null,
    canRunUpdateAll: false,
    blockingReason: null,
    upToDateHeadline: "Marca lista para crear proyectos.",
  };
}

export type BrandInformationQualityBand = "high" | "medium" | "low" | "none";

export function brandInformationQualityBandFromScore(
  score: number | null,
): BrandInformationQualityBand {
  if (score == null || Number.isNaN(score)) return "none";
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export function brandInformationQualityBandHintEs(
  band: BrandInformationQualityBand,
): string {
  switch (band) {
    case "high":
      return "Buena base de información";
    case "medium":
      return "Base aprovechable con oportunidades de mejora";
    case "low":
      return "Información insuficiente o frágil";
    default:
      return "";
  }
}
