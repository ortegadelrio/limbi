import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("BRAIN-1 — migración brainstormer (contrato SQL)", () => {
  const migrationPath = path.join(
    __dirname,
    "../../supabase/migrations/20260601120000_brainstormer_tables.sql",
  );

  it("existe el archivo de migración", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql.length).toBeGreaterThan(100);
  });

  it("define tablas, RLS y checks esperados", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("CREATE TABLE public.brainstorm_sessions");
    expect(sql).toContain("CREATE TABLE public.brainstorm_messages");
    expect(sql).toContain("CREATE TABLE public.brainstorm_session_snapshots");
    expect(sql).toContain("CREATE TABLE public.brainstorm_project_bases");

    expect(sql).toContain("source_brand_knowledge_base_id");
    expect(sql).toContain("source_brand_limbic_base_id");
    expect(sql).toContain("user_id");
    expect(sql).toContain("brand_id");

    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("brainstorm_sessions_select_own");
    expect(sql).toContain("CHECK (status IN ('open', 'paused', 'closed', 'converted_to_project_base'))");
    expect(sql).toContain("CHECK (role IN ('user', 'assistant', 'system'))");
    expect(sql).toContain(
      "CHECK (snapshot_kind IN ('live_map', 'strategic_summary', 'conversion_candidate'))",
    );
    expect(sql).toContain("CHECK (status IN ('draft', 'sent_to_project', 'archived'))");

    expect(sql).toContain("brainstorm_sessions_set_updated_at");
    expect(sql).toContain("brainstorm_project_bases_set_updated_at");
    expect(sql).toContain("EXECUTE FUNCTION public.set_updated_at()");
  });
});
