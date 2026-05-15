import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Migración trazabilidad marca en brainstorm_sessions", () => {
  const migrationPath = path.join(
    __dirname,
    "../../supabase/migrations/20260602130000_brainstorm_sessions_brand_truth_traceability.sql",
  );

  it("define columnas y check de brand_context_status", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("brand_knowledge_base_id_used");
    expect(sql).toContain("brand_limbic_base_id_used");
    expect(sql).toContain("brand_context_generated_at");
    expect(sql).toContain("brand_context_status");
    expect(sql).toContain("brand_context_blocking_reasons");
    expect(sql).toContain("brand_context_has_pending_updates");
    expect(sql).toContain("CHECK (brand_context_status IN ('ready', 'advisory', 'blocked'))");
  });
});
