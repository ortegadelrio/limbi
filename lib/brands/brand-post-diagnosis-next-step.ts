import type { BrandDashboardBasesState } from "@/lib/brands/fetch-brand-dashboard-bases-state";
import type { BrandDiagnosisNextRecommendedAction } from "@/types/database";

export const BRAND_NEXT_STEP_CARD_TITLE_ES = "Siguiente paso recomendado";

export const BRAND_NEXT_STEP_CONSOLIDATE_BODY_ES =
  "Tu diagnóstico ya tiene información suficiente para consolidar la Base de Marca. Esta base será la fuente de verdad que Limbi usará más adelante para crear proyectos y contenidos.";

export const BRAND_NEXT_STEP_IMPROVE_OPTIONAL_ES =
  "Puedes mejorar secciones antes de consolidar si quieres más precisión, pero no es obligatorio si la base ya es suficiente.";

export const BRAND_NEXT_STEP_CRITICAL_BEFORE_CONSOLIDATE_ES =
  "Para consolidar la base, primero fortalece las secciones críticas.";

export const BRAND_NEXT_STEP_IMPROVE_NON_BLOCKING_ES =
  "También puedes mejorar secciones antes de consolidar, si quieres mayor precisión.";

export const BRAND_NEXT_STEP_BRAND_READY_PROJECTS_ES =
  "Marca lista para crear proyectos. Diagnóstico y bases curadas activas al día con la información aprobada.";

export type BrandPostDiagnosisNextStepPrimary =
  | { kind: "link"; href: string; label: string }
  | { kind: "regenerate_diagnosis"; label: string };

export type BrandPostDiagnosisNextStepResolved = {
  title: string;
  body: string;
  primary: BrandPostDiagnosisNextStepPrimary;
  /** Párrafos opcionales bajo el cuerpo principal (p. ej. vacíos críticos o mejora opcional). */
  secondaryLines?: string[];
};

export type BrandPostDiagnosisNextStepInput = {
  brandId: string;
  pendingFactsCount: number;
  hasActiveSucceededDiagnosis: boolean;
  diagnosisIsStale: boolean;
  bases: BrandDashboardBasesState;
  /** Solo afecta al ramo “consolidar” (textos de apoyo). */
  diagnosisHints?: {
    criticalGapsCount: number;
    nextRecommendedAction: BrandDiagnosisNextRecommendedAction | null;
  };
  /**
   * En el dashboard, si no hay diagnóstico activo y no hay bloqueo por hallazgos,
   * el siguiente paso es generar evaluación. En la página de diagnóstico con resultado,
   * pasar false para no ofrecer ese CTA duplicado.
   */
  offerDiagnosisGenerationCta: boolean;
  /**
   * En la página de diagnóstico, “Actualizar diagnóstico” debe ser acción local (POST),
   * no solo enlace al mismo URL.
   */
  staleDiagnosisPrimaryIsRegenerate: boolean;
};

function basesHref(brandId: string) {
  return `/brands/${brandId}/bases`;
}

function diagnosisHref(brandId: string) {
  return `/brands/${brandId}/diagnosis`;
}

function sourceFactsHref(brandId: string) {
  return `/brands/${brandId}/source-facts`;
}

function consolidateSecondaryLines(
  hints: BrandPostDiagnosisNextStepInput["diagnosisHints"],
): string[] | undefined {
  if (!hints) return undefined;
  const lines: string[] = [];
  if (hints.criticalGapsCount > 0) {
    lines.push(BRAND_NEXT_STEP_CRITICAL_BEFORE_CONSOLIDATE_ES);
  }
  if (hints.nextRecommendedAction === "improve_recommended") {
    lines.push(BRAND_NEXT_STEP_IMPROVE_NON_BLOCKING_ES);
  } else if (
    hints.criticalGapsCount === 0 &&
    (hints.nextRecommendedAction === "improve_required" ||
      hints.nextRecommendedAction === "ready_for_consolidation")
  ) {
    lines.push(BRAND_NEXT_STEP_IMPROVE_OPTIONAL_ES);
  }
  return lines.length ? lines : undefined;
}

/**
 * Orden de prioridad alineado con el journey de marca (hallazgos → diagnóstico vigente → bases).
 */
export function resolveBrandPostDiagnosisNextStep(
  input: BrandPostDiagnosisNextStepInput,
): BrandPostDiagnosisNextStepResolved {
  const { brandId, bases } = input;
  const pending = input.pendingFactsCount > 0;

  if (pending) {
    return {
      title: BRAND_NEXT_STEP_CARD_TITLE_ES,
      body: "Hay información sugerida por documentos que debes aprobar, editar o descartar antes de generar el diagnóstico, actualizarlo o consolidar la Base de Marca.",
      primary: {
        kind: "link",
        href: sourceFactsHref(brandId),
        label: "Revisar hallazgos pendientes",
      },
    };
  }

  if (input.offerDiagnosisGenerationCta && !input.hasActiveSucceededDiagnosis) {
    return {
      title: BRAND_NEXT_STEP_CARD_TITLE_ES,
      body: "La marca ya tiene información suficiente para generar una primera evaluación estratégica.",
      primary: {
        kind: "link",
        href: diagnosisHref(brandId),
        label: "Generar diagnóstico",
      },
    };
  }

  if (input.hasActiveSucceededDiagnosis && input.diagnosisIsStale) {
    const body = input.staleDiagnosisPrimaryIsRegenerate
      ? "Hay información más reciente después de este diagnóstico (respuestas, oferta, audiencias/territorios, hallazgos de documentos o mejoras aprobadas). Actualizá la evaluación para reflejar la información más reciente."
      : "Hay cambios recientes en la información de la marca. Actualizá la evaluación antes de confiar en el diagnóstico o en bases curadas nuevas.";
    const label = "Actualizar diagnóstico";
    return {
      title: BRAND_NEXT_STEP_CARD_TITLE_ES,
      body,
      primary: input.staleDiagnosisPrimaryIsRegenerate
        ? { kind: "regenerate_diagnosis", label }
        : { kind: "link", href: diagnosisHref(brandId), label },
    };
  }

  if (bases.consolidationRunning) {
    return {
      title: BRAND_NEXT_STEP_CARD_TITLE_ES,
      body: "Se están generando la Base de Conocimiento y la Base Límbica curadas. Podés ver el detalle y recargar el estado en la pantalla de bases.",
      primary: { kind: "link", href: basesHref(brandId), label: "Ver bases de marca" },
    };
  }

  if (!bases.hasActiveKnowledgeBase || !bases.hasActiveLimbicBase) {
    return {
      title: BRAND_NEXT_STEP_CARD_TITLE_ES,
      body: BRAND_NEXT_STEP_CONSOLIDATE_BODY_ES,
      primary: {
        kind: "link",
        href: basesHref(brandId),
        label: "Consolidar Base de Marca",
      },
      secondaryLines: consolidateSecondaryLines(input.diagnosisHints),
    };
  }

  if (bases.knowledgeBaseIsStale || bases.limbicBaseIsStale) {
    return {
      title: BRAND_NEXT_STEP_CARD_TITLE_ES,
      body: "Cambiaron fuentes aprobadas o el diagnóstico desde la última consolidación. Regenerá las bases para que reflejen la marca actual.",
      primary: {
        kind: "link",
        href: basesHref(brandId),
        label: "Actualizar bases de marca",
      },
    };
  }

  return {
    title: BRAND_NEXT_STEP_CARD_TITLE_ES,
    body: BRAND_NEXT_STEP_BRAND_READY_PROJECTS_ES,
    primary: { kind: "link", href: basesHref(brandId), label: "Ver bases de marca" },
  };
}
