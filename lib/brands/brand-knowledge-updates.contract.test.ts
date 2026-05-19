import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("brand knowledge updates (BRAND-U1)", () => {
  it("migration define tabla y RLS", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260602140000_brand_knowledge_updates.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE public.brand_knowledge_updates");
    expect(sql).toContain("pending_review");
    expect(sql).toContain("brand_knowledge_updates_select_own");
  });

  it("API routes existen", () => {
    const getRoute = readFileSync(
      join(process.cwd(), "app/api/brands/[brandId]/knowledge-updates/route.ts"),
      "utf8",
    );
    expect(getRoute).toContain("classifyBrandKnowledgeUpdate");
    expect(getRoute).toContain("pending_review");

    const patchRoute = readFileSync(
      join(
        process.cwd(),
        "app/api/brands/[brandId]/knowledge-updates/[updateId]/route.ts",
      ),
      "utf8",
    );
    expect(patchRoute).toContain('status: "approved"');
    expect(patchRoute).toContain('status: "discarded"');
  });

  it("staleness considera actualizaciones aprobadas", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/brands/brand-bases-staleness.ts"),
      "utf8",
    );
    expect(src).toContain("hasKnowledgeUpdatesApprovedAfterBase");
    expect(src).toContain("brand_knowledge_updates");
  });
});
