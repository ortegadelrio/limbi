import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Dashboard marca — contrato UI mantenimiento (sin RTL)", () => {
  it("página usa panel de mantenimiento y calidad", () => {
    const p = path.join(__dirname, "../../app/(dashboard)/brands/[brandId]/page.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("BrandDashboardMaintenanceClient");
    expect(src).toContain("resolveBrandDashboardMaintenance");
    expect(src).not.toContain("BrandPostDiagnosisNextStepCard");
    expect(src).not.toContain("buildBrandDashboardCascadeBanner");
  });

  it("cliente: update-all ejecuta diagnóstico antes que consolidación", () => {
    const p = path.join(
      __dirname,
      "../../components/brands/brand-dashboard-maintenance-client.tsx",
    );
    const src = readFileSync(p, "utf8");
    const idxDiag = src.indexOf("runDiagnosis()");
    const idxCons = src.indexOf("runConsolidate()");
    expect(idxDiag).toBeGreaterThan(-1);
    expect(idxCons).toBeGreaterThan(-1);
    expect(idxDiag).toBeLessThan(idxCons);
  });

  it("cliente muestra calidad, microcopy y Bogotá", () => {
    const p = path.join(
      __dirname,
      "../../components/brands/brand-dashboard-maintenance-client.tsx",
    );
    const src = readFileSync(p, "utf8");
    expect(src).toContain("Calidad de información de la marca");
    expect(src).toContain("Base de Marca confiable");
    expect(src).toContain("Generado el");
    expect(src).toContain("Diagnóstico desactualizado");
  });
});
