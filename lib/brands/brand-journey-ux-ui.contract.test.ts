import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Journey marca — contrato UX/UI (sin RTL)", () => {
  it("listado /brands: anillo de calidad y empty state ejecutivo", () => {
    const p = path.join(__dirname, "../../components/brands/brand-list.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("QualityScoreRing");
    expect(src).toContain("brand-list-empty");
    expect(src).toContain("Empezá con tu primera marca");
  });

  it("material de contexto: subir archivo y sitio en grid en modo standalone", () => {
    const p = path.join(__dirname, "../../components/brands/brand-documents-client.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("grid gap-6 lg:grid-cols-2");
    expect(src).toContain("Subir archivo");
    expect(src).toContain("BRAND_MATERIAL_WEB_SECTION_HEADING");
  });

  it("errores de subida sin anexos técnicos automáticos", () => {
    const p = path.join(__dirname, "../../components/brands/brand-documents-client.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("function formatUploadError");
    expect(src).toContain("return j.error?.trim() || fallback");
    expect(src).not.toContain("Referencia:");
  });

  it("diagnóstico: bloque de score con anillo y etiqueta de calidad", () => {
    const p = path.join(__dirname, "../../components/brands/diagnosis/brand-diagnosis-client.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("rounded-2xl border border-limbi-border/80 bg-limbi-bg-soft/50");
    expect(src).toContain("Calidad de información");
    expect(src).toContain("QualityScoreRing");
  });

  it("dashboard interno: material de contexto con icono y ancho alineado", () => {
    const p = path.join(__dirname, "../../app/(dashboard)/brands/[brandId]/page.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("FolderOpen");
    expect(src).toContain("max-w-3xl");
  });
});
