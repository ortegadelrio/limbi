import { describe, expect, it } from "vitest";
import {
  BRAND_NEXT_STEP_BRAND_READY_PROJECTS_ES,
  BRAND_NEXT_STEP_CONSOLIDATE_BODY_ES,
  resolveBrandPostDiagnosisNextStep,
} from "@/lib/brands/brand-post-diagnosis-next-step";
import type { BrandDashboardBasesState } from "@/lib/brands/fetch-brand-dashboard-bases-state";

const brandId = "b1";

function emptyBases(over: Partial<BrandDashboardBasesState> = {}): BrandDashboardBasesState {
  return {
    pendingFactsCount: 0,
    consolidationRunning: false,
    hasActiveKnowledgeBase: false,
    hasActiveLimbicBase: false,
    activeKnowledgeCreatedAt: null,
    activeLimbicCreatedAt: null,
    knowledgeBaseIsStale: false,
    limbicBaseIsStale: false,
    ...over,
  };
}

describe("resolveBrandPostDiagnosisNextStep", () => {
  it("prioriza hallazgos pendientes", () => {
    const r = resolveBrandPostDiagnosisNextStep({
      brandId,
      pendingFactsCount: 2,
      hasActiveSucceededDiagnosis: true,
      diagnosisIsStale: false,
      bases: emptyBases({ hasActiveKnowledgeBase: true, hasActiveLimbicBase: true }),
      offerDiagnosisGenerationCta: true,
      staleDiagnosisPrimaryIsRegenerate: false,
    });
    expect(r.primary).toEqual({
      kind: "link",
      href: `/brands/${brandId}/source-facts`,
      label: "Revisar hallazgos pendientes",
    });
  });

  it("dashboard: sin diagnóstico activo ofrece generar", () => {
    const r = resolveBrandPostDiagnosisNextStep({
      brandId,
      pendingFactsCount: 0,
      hasActiveSucceededDiagnosis: false,
      diagnosisIsStale: false,
      bases: emptyBases(),
      offerDiagnosisGenerationCta: true,
      staleDiagnosisPrimaryIsRegenerate: false,
    });
    expect(r.primary).toEqual({
      kind: "link",
      href: `/brands/${brandId}/diagnosis`,
      label: "Generar diagnóstico",
    });
  });

  it("diagnóstico obsoleto: enlace en dashboard", () => {
    const r = resolveBrandPostDiagnosisNextStep({
      brandId,
      pendingFactsCount: 0,
      hasActiveSucceededDiagnosis: true,
      diagnosisIsStale: true,
      bases: emptyBases(),
      offerDiagnosisGenerationCta: true,
      staleDiagnosisPrimaryIsRegenerate: false,
    });
    expect(r.primary).toEqual({
      kind: "link",
      href: `/brands/${brandId}/diagnosis`,
      label: "Actualizar diagnóstico",
    });
  });

  it("diagnóstico obsoleto: acción regenerar en página de diagnóstico", () => {
    const r = resolveBrandPostDiagnosisNextStep({
      brandId,
      pendingFactsCount: 0,
      hasActiveSucceededDiagnosis: true,
      diagnosisIsStale: true,
      bases: emptyBases(),
      offerDiagnosisGenerationCta: false,
      staleDiagnosisPrimaryIsRegenerate: true,
    });
    expect(r.primary).toEqual({ kind: "regenerate_diagnosis", label: "Actualizar diagnóstico" });
  });

  it("consolidación en curso enlaza a bases", () => {
    const r = resolveBrandPostDiagnosisNextStep({
      brandId,
      pendingFactsCount: 0,
      hasActiveSucceededDiagnosis: true,
      diagnosisIsStale: false,
      bases: emptyBases({ consolidationRunning: true }),
      offerDiagnosisGenerationCta: false,
      staleDiagnosisPrimaryIsRegenerate: true,
    });
    expect(r.primary).toMatchObject({
      kind: "link",
      href: `/brands/${brandId}/bases`,
      label: "Ver bases de marca",
    });
  });

  it("sin bases activas: CTA consolidar con cuerpo esperado", () => {
    const r = resolveBrandPostDiagnosisNextStep({
      brandId,
      pendingFactsCount: 0,
      hasActiveSucceededDiagnosis: true,
      diagnosisIsStale: false,
      bases: emptyBases(),
      diagnosisHints: { criticalGapsCount: 0, nextRecommendedAction: "ready_for_consolidation" },
      offerDiagnosisGenerationCta: false,
      staleDiagnosisPrimaryIsRegenerate: true,
    });
    expect(r.body).toBe(BRAND_NEXT_STEP_CONSOLIDATE_BODY_ES);
    expect(r.primary).toEqual({
      kind: "link",
      href: `/brands/${brandId}/bases`,
      label: "Consolidar Base de Marca",
    });
    expect(r.secondaryLines?.length).toBeGreaterThan(0);
  });

  it("añade aviso de vacíos críticos al ramo consolidar", () => {
    const r = resolveBrandPostDiagnosisNextStep({
      brandId,
      pendingFactsCount: 0,
      hasActiveSucceededDiagnosis: true,
      diagnosisIsStale: false,
      bases: emptyBases(),
      diagnosisHints: { criticalGapsCount: 2, nextRecommendedAction: "improve_required" },
      offerDiagnosisGenerationCta: false,
      staleDiagnosisPrimaryIsRegenerate: true,
    });
    expect(r.primary.label).toBe("Consolidar Base de Marca");
    expect(r.secondaryLines?.[0]).toContain("secciones críticas");
  });

  it("bases activas y al día: mensaje marca lista", () => {
    const r = resolveBrandPostDiagnosisNextStep({
      brandId,
      pendingFactsCount: 0,
      hasActiveSucceededDiagnosis: true,
      diagnosisIsStale: false,
      bases: emptyBases({
        hasActiveKnowledgeBase: true,
        hasActiveLimbicBase: true,
      }),
      offerDiagnosisGenerationCta: false,
      staleDiagnosisPrimaryIsRegenerate: true,
    });
    expect(r.body).toBe(BRAND_NEXT_STEP_BRAND_READY_PROJECTS_ES);
    expect(r.primary.href).toBe(`/brands/${brandId}/bases`);
  });
});
