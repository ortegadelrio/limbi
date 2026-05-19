import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("loadFrozenBrandPayloadsForBrainstormSession (contrato fuente)", () => {
  it("solo consulta consolidated_payload en tablas de bases, sin /bases ni brand_responses", () => {
    const p = path.join(__dirname, "load-frozen-brand-payloads-for-session.ts");
    const src = readFileSync(p, "utf8");
    expect(src).toContain('.from("brand_knowledge_bases")');
    expect(src).toContain('.from("brand_limbic_bases")');
    expect(src).toContain("consolidated_payload");
    expect(src).not.toContain("/bases");
    expect(src).not.toMatch(/\.from\(\s*["']brand_responses["']\s*\)/);
    expect(src).not.toMatch(/\.from\(\s*["']brand_knowledge_updates["']\s*\)/);
    expect(src).toContain("brand_knowledge_base_id_used");
    expect(src).toContain("brand_limbic_base_id_used");
  });
});
