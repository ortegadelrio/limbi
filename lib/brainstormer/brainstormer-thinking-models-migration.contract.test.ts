import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Migración modelos de pensamiento en brainstorm_sessions", () => {
  const migrationPath = path.join(
    __dirname,
    "../../supabase/migrations/20260618120000_brainstorm_sessions_thinking_models.sql",
  );

  it("agrega columnas de trazabilidad y checks", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("thinking_model_key");
    expect(sql).toContain("resolved_primary_model_key");
    expect(sql).toContain("resolved_secondary_model_key");
    expect(sql).toContain("creative_orientation_summary");
    expect(sql).toContain("DEFAULT 'limbi'");
  });
});
