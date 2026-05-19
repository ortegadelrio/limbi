import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("diagnóstico UI — sin mejora por sección visible", () => {
  it("tarjetas enlazan al cuestionario, no a /improve", () => {
    const card = read("components/brands/diagnosis/brand-diagnosis-section-card.tsx");
    expect(card).toContain("brandQuestionnaireSectionHref");
    expect(card).toContain("Editar esta sección en el cuestionario");
    expect(card).not.toContain("/improve/");
    expect(card).not.toContain("Mejorar esta sección con la IA de Limbi");
  });

  it("cliente muestra guía y CTA al cuestionario", () => {
    const client = read("components/brands/diagnosis/brand-diagnosis-client.tsx");
    expect(client).toContain("BRAND_DIAGNOSIS_QUESTIONNAIRE_GUIDANCE_ES");
    expect(client).toContain("Mejorar respuestas en el cuestionario");
    expect(client).toContain("brandQuestionnaireHref");
    expect(client).not.toContain("/improve/");
    expect(client).not.toContain("Mejorar esta sección con la IA de Limbi");
  });
});
