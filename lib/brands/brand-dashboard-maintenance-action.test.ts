import { describe, expect, it } from "vitest";
import {
  brandOverviewExecutiveStatusLabel,
  buildBrandDashboardMaintenanceSecondaryLinks,
  brandInformationQualityBandFromScore,
  brandInformationQualityBandHintEs,
  resolveBrandDashboardMaintenance,
} from "@/lib/brands/brand-dashboard-maintenance-action";

const baseInput = {
  brandId: "b1",
  pendingFactsCount: 0,
  consolidationRunning: false,
  hasActiveDiagnosis: true,
  diagnosisIsStale: false,
  hasActiveBases: true,
  basesStale: false,
};

describe("resolveBrandDashboardMaintenance", () => {
  it("prioriza actualizaciones de marca pendientes después de hallazgos", () => {
    const r = resolveBrandDashboardMaintenance({
      ...baseInput,
      pendingFactsCount: 0,
      pendingKnowledgeUpdatesCount: 1,
      diagnosisIsStale: true,
    });
    expect(r.primaryRole).toBe("review_pending_knowledge_updates");
    expect(r.primaryHref).toContain("/knowledge");
    expect(r.blockingReason).toBe("pending_knowledge_updates");
  });

  it("prioriza pending_review antes de update-all", () => {
    const r = resolveBrandDashboardMaintenance({
      ...baseInput,
      pendingFactsCount: 2,
      diagnosisIsStale: true,
      basesStale: true,
    });
    expect(r.primaryRole).toBe("review_pending_facts");
    expect(r.canRunUpdateAll).toBe(false);
    expect(r.blockingReason).toBe("pending_facts");
  });

  it("update-all no corre si hay pending_review", () => {
    const r = resolveBrandDashboardMaintenance({
      ...baseInput,
      pendingFactsCount: 1,
      diagnosisIsStale: true,
    });
    expect(r.primaryRole).not.toBe("update_all");
  });

  it("diagnosis stale + base stale → un solo CTA Actualizar todo", () => {
    const r = resolveBrandDashboardMaintenance({
      ...baseInput,
      diagnosisIsStale: true,
      basesStale: true,
    });
    expect(r.primaryRole).toBe("update_all");
    expect(r.primaryLabel).toBe("Actualizar todo");
    expect(r.combinedStaleNotice).not.toBeNull();
  });

  it("diagnosis vigente + base stale → Actualizar Base de Marca", () => {
    const r = resolveBrandDashboardMaintenance({
      ...baseInput,
      basesStale: true,
    });
    expect(r.primaryRole).toBe("update_base_only");
    expect(r.baseStaleNotice?.title).toContain("Base de Marca");
  });

  it("todo vigente → Marca lista (dashboard interno)", () => {
    const r = resolveBrandDashboardMaintenance(baseInput);
    expect(r.primaryRole).toBe("none_up_to_date");
    expect(r.upToDateHeadline).toContain("Marca lista");
  });

  it("forBrandsList + todo vigente → Ver marca (enlace al dashboard interno)", () => {
    const r = resolveBrandDashboardMaintenance({ ...baseInput, forBrandsList: true });
    expect(r.primaryRole).toBe("view_brand");
    expect(r.primaryLabel).toBe("Ver marca");
    expect(r.primaryHref).toBe("/brands/b1");
    expect(r.upToDateHeadline).toBeNull();
  });

  it("forBrandsList + sin bases → Consolidar Base de Marca", () => {
    const r = resolveBrandDashboardMaintenance({
      ...baseInput,
      hasActiveBases: false,
      forBrandsList: true,
    });
    expect(r.primaryRole).toBe("create_base");
    expect(r.primaryLabel).toBe("Consolidar Base de Marca");
  });

  it("muestra aviso de base stale con cuerpo esperado", () => {
    const r = resolveBrandDashboardMaintenance({
      ...baseInput,
      basesStale: true,
    });
    expect(r.baseStaleNotice?.title).toBe("La Base de Marca está desactualizada.");
    expect(r.baseStaleNotice?.body).toContain("última consolidación");
  });

  it("sin diagnóstico → Generar diagnóstico", () => {
    const r = resolveBrandDashboardMaintenance({
      ...baseInput,
      hasActiveDiagnosis: false,
    });
    expect(r.primaryRole).toBe("generate_diagnosis");
  });

  it("consolidación en curso bloquea acciones", () => {
    const r = resolveBrandDashboardMaintenance({
      ...baseInput,
      consolidationRunning: true,
    });
    expect(r.primaryRole).toBe("blocked_busy");
    expect(r.blockingReason).toBe("consolidation_running");
  });

  it("secondary links priorizan Gestionar información de marca", () => {
    const links = buildBrandDashboardMaintenanceSecondaryLinks("x");
    const hub = links.find((l) => l.label === "Gestionar información de marca");
    expect(hub?.href).toBe("/brands/x/knowledge");
    expect(hub?.emphasized).toBe(true);
    expect(hub?.description).toContain("incorporados en la Base de Marca");
    expect(links[0]?.label).toBe("Gestionar información de marca");
    expect(links.some((l) => l.label === "Editar cuestionario de marca")).toBe(false);
    expect(links.some((l) => l.label === "Actualizar conocimiento de marca")).toBe(false);
  });

  it("forBrandsList + base stale → Actualizar Base de Marca (misma prioridad que interno)", () => {
    const r = resolveBrandDashboardMaintenance({
      ...baseInput,
      basesStale: true,
      forBrandsList: true,
    });
    expect(r.primaryRole).toBe("update_base_only");
    expect(r.primaryLabel).toBe("Actualizar Base de Marca");
  });
});

describe("brandOverviewExecutiveStatusLabel", () => {
  it("prioriza hallazgos pendientes", () => {
    const m = resolveBrandDashboardMaintenance({
      ...baseInput,
      pendingFactsCount: 1,
      diagnosisIsStale: true,
      basesStale: true,
    });
    expect(brandOverviewExecutiveStatusLabel(m, { hasActiveDiagnosis: true, hasActiveBases: true })).toBe(
      "Hallazgos pendientes",
    );
  });

  it("sin diagnóstico", () => {
    const m = resolveBrandDashboardMaintenance({ ...baseInput, hasActiveDiagnosis: false });
    expect(brandOverviewExecutiveStatusLabel(m, { hasActiveDiagnosis: false, hasActiveBases: false })).toBe(
      "Sin diagnóstico",
    );
  });

  it("base desactualizada", () => {
    const m = resolveBrandDashboardMaintenance({ ...baseInput, basesStale: true });
    expect(brandOverviewExecutiveStatusLabel(m, { hasActiveDiagnosis: true, hasActiveBases: true })).toBe(
      "Base de Marca desactualizada",
    );
  });

  it("diagnóstico desactualizado (sin base stale simultáneo)", () => {
    const m = resolveBrandDashboardMaintenance({
      ...baseInput,
      diagnosisIsStale: true,
      basesStale: false,
    });
    expect(brandOverviewExecutiveStatusLabel(m, { hasActiveDiagnosis: true, hasActiveBases: true })).toBe(
      "Diagnóstico desactualizado",
    );
  });

  it("Marca lista cuando view_brand y hay diagnóstico + bases", () => {
    const m = resolveBrandDashboardMaintenance({ ...baseInput, forBrandsList: true });
    expect(brandOverviewExecutiveStatusLabel(m, { hasActiveDiagnosis: true, hasActiveBases: true })).toBe(
      "Marca lista",
    );
  });
});

describe("brandInformationQualityBandFromScore", () => {
  it("clasifica bandas 80 / 60", () => {
    expect(brandInformationQualityBandFromScore(85)).toBe("high");
    expect(brandInformationQualityBandFromScore(70)).toBe("medium");
    expect(brandInformationQualityBandFromScore(40)).toBe("low");
    expect(brandInformationQualityBandFromScore(null)).toBe("none");
  });

  it("hints en español mencionan información", () => {
    expect(brandInformationQualityBandHintEs("high")).toContain("información");
    expect(brandInformationQualityBandHintEs("low")).toContain("Información");
  });
});
