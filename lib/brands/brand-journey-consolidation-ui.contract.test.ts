import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND_BASES_EXECUTIVE_DISCLAIMER_ES } from "@/lib/brands/brand-bases-consolidated-ui";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Journey marca — contrato UI consolidación (sin RTL)", () => {
  it("diagnóstico: metadata Bogotá y refresh de fecha", () => {
    const p = path.join(__dirname, "../../components/brands/diagnosis/brand-diagnosis-client.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("Diagnóstico generado el");
    expect(src).toContain("diagnosis_generated_at_bogota");
    expect(src).toContain("Desactualizado");
    expect(src).toContain("Diagnóstico vigente");
  });

  it("/bases: metadata consolidación Bogotá y diagnóstico stale", () => {
    const p = path.join(__dirname, "../../components/brands/bases/brand-bases-client.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("Última consolidación (Hora Bogotá)");
    expect(src).toContain("knowledge_consolidated_at_bogota");
    expect(src).toContain("Actualiza primero el diagnóstico");
    expect(src).toContain("Base desactualizada");
  });

  it("dashboard: centro de mantenimiento", () => {
    const p = path.join(__dirname, "../../app/(dashboard)/brands/[brandId]/page.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("BrandDashboardMaintenanceClient");
    expect(src).toContain("resolveBrandDashboardMaintenance");
  });

  it("diagnóstico: POST consolidate y dos tarjetas de siguiente paso", () => {
    const p = path.join(__dirname, "../../components/brands/diagnosis/brand-diagnosis-client.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("/bases/consolidate");
    expect(src).toContain('method: "POST"');
    expect(src).toContain("BrandPostDiagnosisNextStepCard");
    expect(src.split("BrandPostDiagnosisNextStepCard").length - 1).toBeGreaterThanOrEqual(3);
    expect(src).toContain('variant="footer"');
    expect(src).toContain("consolidate_direct");
  });

  it("/bases: lectura ejecutiva disclaimer y proyectos", () => {
    const p = path.join(__dirname, "../../components/brands/bases/brand-bases-client.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("BrandBasesInterpretiveReading");
    expect(src).toContain("Base de Conocimiento");
    expect(src).toContain("BrandBasesLimbicReading");
    expect(src).toContain("/projects");
    expect(src).toContain("Ir al dashboard de proyectos");
  });

  it("copy estable de disclaimer ejecutivo", () => {
    expect(BRAND_BASES_EXECUTIVE_DISCLAIMER_ES).toContain("lectura ejecutiva");
    expect(BRAND_BASES_EXECUTIVE_DISCLAIMER_ES).toContain("internamente");
  });

  it("/bases: sección explícita de oferta y servicios", () => {
    const p = path.join(
      __dirname,
      "../../components/brands/bases/brand-bases-interpretive-reading.tsx",
    );
    const src = readFileSync(p, "utf8");
    expect(src).toContain("BrandBasesOfferSection");
    expect(src).toContain("offerPreview");
  });

  it("schema OpenAI de consolidación incluye offer_architecture", () => {
    const p = path.join(__dirname, "../../lib/openai/brand-base-consolidation.ts");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("offer_architecture");
    expect(src).toContain("service_catalog");
  });

  it("dashboard interno: Ver Base de Marca cuando hay bases", () => {
    const p = path.join(
      __dirname,
      "../../components/brands/brand-dashboard-maintenance-client.tsx",
    );
    const src = readFileSync(p, "utf8");
    expect(src).toContain("Ver Base de Marca");
    expect(src).toContain("/bases");
  });
});
