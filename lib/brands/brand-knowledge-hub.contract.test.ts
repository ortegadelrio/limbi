import { describe, expect, it } from "vitest";
import {
  BRAND_KNOWLEDGE_HUB_INTRO_ES,
  BRAND_KNOWLEDGE_HUB_SECTIONS,
  brandKnowledgeHubStatusLabelEs,
} from "@/lib/brands/brand-knowledge-hub-sections";
import { buildBrandDashboardMaintenanceSecondaryLinks } from "@/lib/brands/brand-dashboard-maintenance-action";

describe("brand knowledge hub", () => {
  it("define nueve secciones de producto incluyendo límbico", () => {
    expect(BRAND_KNOWLEDGE_HUB_SECTIONS.length).toBe(9);
    expect(BRAND_KNOWLEDGE_HUB_SECTIONS.some((s) => s.updateSectionKey === "limbic")).toBe(true);
    expect(BRAND_KNOWLEDGE_HUB_SECTIONS.some((s) => s.updateSectionKey === "offer")).toBe(true);
  });

  it("microcopy principal menciona aprobación e incorporación", () => {
    expect(BRAND_KNOWLEDGE_HUB_INTRO_ES).toContain("aprobados");
    expect(BRAND_KNOWLEDGE_HUB_INTRO_ES).toContain("Base de Marca");
  });

  it("estados visibles en español", () => {
    expect(brandKnowledgeHubStatusLabelEs("pending_review")).toContain("revisión");
    expect(brandKnowledgeHubStatusLabelEs("pending_consolidation")).toContain("consolidar");
  });

  it("dashboard enlaza al hub /knowledge como acción principal", () => {
    const links = buildBrandDashboardMaintenanceSecondaryLinks("abc");
    expect(links[0]?.href).toBe("/brands/abc/knowledge");
    expect(links[0]?.label).toBe("Gestionar información de marca");
  });
});
