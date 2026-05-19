import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Listado /brands — contrato mantenimiento (sin RTL)", () => {
  it("página usa helper de overview y no reimplementa diagnóstico por marca", () => {
    const p = path.join(__dirname, "../../app/(dashboard)/brands/page.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("fetchBrandsOverviewMaintenanceRows");
    expect(src).not.toContain("fetchBrandDashboardDiagnosisState");
  });

  it("helper reutiliza resolver + fetch de estado (sin duplicar reglas)", () => {
    const p = path.join(__dirname, "../../lib/brands/fetch-brands-overview-maintenance.ts");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("resolveBrandDashboardMaintenance");
    expect(src).toContain("fetchBrandDashboardDiagnosisState");
    expect(src).toContain("fetchBrandDashboardBasesState");
    expect(src).toContain("formatBogotaDateTime");
    expect(src).toContain("forBrandsList: true");
  });

  it("tarjeta lista: calidad, sin diagnóstico, estado ejecutivo, CTA y cuestionario", () => {
    const p = path.join(__dirname, "../../components/brands/brand-list.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("Calidad de información");
    expect(src).toContain("QualityScoreRing");
    expect(src).toContain("BRAND_INFORMATION_QUALITY_MICROCOPY_ES");
    expect(src).toContain("Aún no hay diagnóstico");
    expect(src).toContain("executiveStatusLabel");
    expect(src).toContain("BrandOverviewCardCta");
    expect(src).toContain("Editar cuestionario de marca");
    expect(src).toContain("/questionnaire");
    expect(src).not.toContain("Gestionar información de marca");
    expect(src).not.toContain("/knowledge");
  });

  it("CTA tarjeta listado: update-all llama diagnóstico antes que consolidación", () => {
    const p = path.join(__dirname, "../../components/brands/brand-overview-card-cta.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("postBrandDiagnosis");
    expect(src).toContain("postBrandConsolidate");
    const idxDiag = src.indexOf("postBrandDiagnosis(brandId)");
    const idxCons = src.indexOf("postBrandConsolidate(brandId)");
    expect(idxDiag).toBeGreaterThan(-1);
    expect(idxCons).toBeGreaterThan(-1);
    expect(idxDiag).toBeLessThan(idxCons);
  });
});