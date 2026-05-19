import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("brand field improve contract", () => {
  it("cuestionario recibe hasActiveDiagnosis desde el servidor", () => {
    const page = read("app/(dashboard)/brands/[brandId]/questionnaire/page.tsx");
    expect(page).toContain("fetchBrandDashboardDiagnosisState");
    expect(page).toContain("hasActiveDiagnosis={diagnosisState.hasActiveDiagnosis}");
  });

  it("BrandQuestionBlock gatea Mejorar con Limbi", () => {
    const block = read("components/brands/questionnaire/brand-question-block.tsx");
    expect(block).toContain("canShowLimbiFieldImprove");
    expect(block).toContain("Mejorar con Limbi");
    expect(block).toContain("hasActiveDiagnosis");
  });

  it("apply escribe en brand_responses y no en brand_knowledge_updates", () => {
    const route = read("app/api/brands/[brandId]/field-improve/[questionKey]/route.ts");
    expect(route).toContain('from("brand_responses").upsert');
    expect(route).not.toContain("brand_knowledge_updates");
  });

  it("coach exige diagnóstico activo", () => {
    const route = read("app/api/brands/[brandId]/field-improve/[questionKey]/route.ts");
    expect(route).toContain("diagnosis_required");
    expect(route).toContain("buildBrandFieldImprovementContext");
  });
});
