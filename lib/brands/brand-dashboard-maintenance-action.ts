export type BrandDashboardMaintenanceWarningState =
  | "none"
  | "pending_facts"
  | "pending_knowledge_updates"
  | "consolidation_running"
  | "both_stale"
  | "base_stale_only"
  | "diagnosis_stale_only";

export type BrandDashboardPrimaryMaintenanceRole =
  | "review_pending_facts"
  | "review_pending_knowledge_updates"
  | "update_all"
  | "update_base_only"
  | "generate_diagnosis"
  | "create_base"
  | "none_up_to_date"
  | "blocked_busy"
  /** Listado general: marca al día, enlace al dashboard interno. */
  | "view_brand";

export type BrandDashboardMaintenanceBlockingReason =
  | "pending_facts"
  | "pending_knowledge_updates"
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

/** Microcopy compartido (dashboard interno + listado de marcas). */
export const BRAND_INFORMATION_QUALITY_MICROCOPY_ES =
  "Este porcentaje mide qué tan completa y útil es la información disponible para construir una Base de Marca confiable.";

/**
 * Etiqueta ejecutiva de una línea para el listado `/brands` (reutiliza `warningState` del resolver).
 */
export function brandOverviewExecutiveStatusLabel(
  maintenance: BrandDashboardMaintenanceResolved,
  ctx: { hasActiveDiagnosis: boolean; hasActiveBases: boolean },
): string {
  if (maintenance.warningState === "pending_facts") return "Hallazgos pendientes";
  if (maintenance.warningState === "pending_knowledge_updates") {
    return "Actualizaciones pendientes";
  }
  if (maintenance.warningState === "consolidation_running") return "Consolidación en curso";
  if (!ctx.hasActiveDiagnosis) return "Sin diagnóstico";
  if (maintenance.warningState === "both_stale") {
    return "Diagnóstico y Base de Marca desactualizados";
  }
  if (maintenance.warningState === "diagnosis_stale_only") return "Diagnóstico desactualizado";
  if (maintenance.warningState === "base_stale_only") return "Base de Marca desactualizada";
  if (
    ctx.hasActiveDiagnosis &&
    ctx.hasActiveBases &&
    (maintenance.primaryRole === "none_up_to_date" ||
      maintenance.primaryRole === "view_brand")
  ) {
    return "Marca lista";
  }
  if (ctx.hasActiveDiagnosis && !ctx.hasActiveBases) return "Sin Base de Marca";
  return "En progreso";
}

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
    {
      label: "Actualizar conocimiento de marca",
      href: `${base}/knowledge-updates`,
    },
  ];
}

/**
 * Un solo CTA principal de mantenimiento en el dashboard de marca + avisos de staleness.
 */
export function resolveBrandDashboardMaintenance(input: {
  brandId: string;
  pendingFactsCount: number;
  pendingKnowledgeUpdatesCount?: number;
  consolidationRunning: boolean;
  hasActiveDiagnosis: boolean;
  diagnosisIsStale: boolean;
  hasActiveBases: boolean;
  basesStale: boolean;
  /** Ajustes de copy/CTA para el listado general `/brands`. */
  forBrandsList?: boolean;
}): BrandDashboardMaintenanceResolved {
  const {
    brandId,
    pendingFactsCount,
    pendingKnowledgeUpdatesCount = 0,
    consolidationRunning,
    hasActiveDiagnosis,
    diagnosisIsStale,
    hasActiveBases,
    basesStale,
    forBrandsList = false,
  } = input;

  const sourceFactsHref = `/brands/${brandId}/source-facts`;
  const knowledgeUpdatesHref = `/brands/${brandId}/knowledge-updates`;

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
      primaryLabel: forBrandsList ? "Revisar hallazgos" : "Revisar hallazgos pendientes",
      primaryHref: sourceFactsHref,
      canRunUpdateAll: false,
      blockingReason: "pending_facts",
      upToDateHeadline: null,
    };
  }

  if (pendingKnowledgeUpdatesCount > 0) {
    return {
      warningState: "pending_knowledge_updates",
      baseStaleNotice,
      combinedStaleNotice,
      diagnosisStaleNotice,
      primaryRole: "review_pending_knowledge_updates",
      primaryLabel: forBrandsList
        ? "Revisar actualizaciones"
        : "Revisar actualizaciones de marca",
      primaryHref: knowledgeUpdatesHref,
      canRunUpdateAll: false,
      blockingReason: "pending_knowledge_updates",
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
      primaryLabel: forBrandsList ? "Consolidar Base de Marca" : "Generar Base de Marca",
      primaryHref: null,
      canRunUpdateAll: false,
      blockingReason: null,
      upToDateHeadline: null,
    };
  }

  if (forBrandsList) {
    return {
      warningState: "none",
      baseStaleNotice: null,
      combinedStaleNotice: null,
      diagnosisStaleNotice: null,
      primaryRole: "view_brand",
      primaryLabel: "Ver marca",
      primaryHref: `/brands/${brandId}`,
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
