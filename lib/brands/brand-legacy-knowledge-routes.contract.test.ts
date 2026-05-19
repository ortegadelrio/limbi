import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("rutas legacy knowledge → cuestionario", () => {
  it("/knowledge redirige al cuestionario", () => {
    const page = read("app/(dashboard)/brands/[brandId]/knowledge/page.tsx");
    expect(page).toContain("redirect(");
    expect(page).toContain("/questionnaire");
    expect(page).not.toContain("BrandKnowledgeHubClient");
  });

  it("/knowledge-updates redirige al cuestionario", () => {
    const page = read("app/(dashboard)/brands/[brandId]/knowledge-updates/page.tsx");
    expect(page).toContain("redirect(");
    expect(page).toContain("/questionnaire");
    expect(page).not.toContain("BrandKnowledgeUpdatesClient");
  });
});
