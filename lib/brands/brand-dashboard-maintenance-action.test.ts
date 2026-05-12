import { describe, expect, it } from "vitest";
import {
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

  it("todo vigente → Marca lista", () => {
    const r = resolveBrandDashboardMaintenance(baseInput);
    expect(r.primaryRole).toBe("none_up_to_date");
    expect(r.upToDateHeadline).toContain("Marca lista");
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

  it("secondary links incluyen Editar información de marca", () => {
    const links = buildBrandDashboardMaintenanceSecondaryLinks("x");
    expect(links.some((l) => l.label === "Editar información de marca")).toBe(true);
    expect(links.find((l) => l.label === "Editar información de marca")?.href).toBe(
      "/brands/x/questionnaire",
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
