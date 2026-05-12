export type BrandDashboardCascadeCta = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export type BrandDashboardCascadeBanner = {
  variant: "success" | "warning";
  headline: string;
  body?: string;
  actions: BrandDashboardCascadeCta[];
};

export type BrandDashboardCascadeInput = {
  pendingFactsCount: number;
  consolidationRunning: boolean;
  hasActiveDiagnosis: boolean;
  diagnosisIsStale: boolean;
  hasActiveBases: boolean;
  basesStale: boolean;
  diagnosisHref: string;
  basesHref: string;
};

/**
 * Copy del dashboard de marca (Ticket H.3): prioriza actualizar diagnóstico antes que bases.
 */
export function buildBrandDashboardCascadeBanner(
  input: BrandDashboardCascadeInput,
): BrandDashboardCascadeBanner | null {
  if (input.pendingFactsCount > 0) return null;
  if (input.consolidationRunning) return null;

  const {
    hasActiveDiagnosis,
    diagnosisIsStale,
    hasActiveBases,
    basesStale,
    diagnosisHref,
    basesHref,
  } = input;

  if (diagnosisIsStale && hasActiveDiagnosis) {
    if (hasActiveBases) {
      return {
        variant: "warning",
        headline:
          "Actualiza primero el diagnóstico para que la nueva Base de Marca se consolide con información vigente.",
        body: "Hay información nueva después del último diagnóstico. La Base de Marca fue consolidada antes de esos cambios.",
        actions: [
          { label: "Actualizar diagnóstico", href: diagnosisHref, variant: "primary" },
          { label: "Ir a Base de Marca", href: basesHref, variant: "secondary" },
        ],
      };
    }
    return {
      variant: "warning",
      headline: "Hay información nueva después del último diagnóstico.",
      actions: [{ label: "Actualizar diagnóstico", href: diagnosisHref, variant: "primary" }],
    };
  }

  if (hasActiveDiagnosis && hasActiveBases && basesStale) {
    return {
      variant: "warning",
      headline: "La Base de Marca fue consolidada antes de los últimos cambios.",
      actions: [{ label: "Actualizar Base de Marca", href: basesHref, variant: "primary" }],
    };
  }

  if (
    hasActiveDiagnosis &&
    hasActiveBases &&
    !basesStale &&
    !diagnosisIsStale
  ) {
    return {
      variant: "success",
      headline: "Marca lista para crear proyectos.",
      actions: [],
    };
  }

  return null;
}
