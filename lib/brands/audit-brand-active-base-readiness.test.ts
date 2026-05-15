import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { auditBrandActiveBaseReadiness } from "@/lib/brands/audit-brand-active-base-readiness";
import * as loadCtx from "@/lib/brands/load-active-brand-context-for-project";

vi.mock("@/lib/brands/load-active-brand-context-for-project", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/brands/load-active-brand-context-for-project")>();
  return {
    ...actual,
    loadActiveBrandContextForProject: vi.fn(),
  };
});

describe("auditBrandActiveBaseReadiness", () => {
  const supabase = {} as SupabaseClient;

  beforeEach(() => {
    vi.mocked(loadCtx.loadActiveBrandContextForProject).mockReset();
  });

  it("mapea flags de loadActiveBrandContextForProject", async () => {
    vi.mocked(loadCtx.loadActiveBrandContextForProject).mockResolvedValue({
      ok: true,
      brand: { id: "b1", name: "Acme" },
      active_knowledge_base: null,
      active_limbic_base: null,
      knowledge_payload: null,
      limbic_payload: null,
      source_metadata: {
        brand_id: "b1",
        brand_name: "Acme",
        active_brand_knowledge_base_id: null,
        active_brand_limbic_base_id: null,
        knowledge_consolidated_at: null,
        limbic_consolidated_at: null,
        prompt_version: null,
        source_snapshot: null,
        source_trace: null,
      },
      is_stale: false,
      blocking_reasons: ["no_active_knowledge_base", "no_active_limbic_base"],
      knowledge_payload_contract_gaps: ["missing_knowledge_payload"],
      limbic_payload_contract_gaps: ["missing_limbic_payload"],
      consolidation_running: false,
      knowledge_base_is_stale: false,
      limbic_base_is_stale: false,
      pending_source_facts_review: true,
      diagnosis_is_stale_blocking: false,
      generated_at_bogota: "x",
      interpretive_rules: [],
    });

    const audit = await auditBrandActiveBaseReadiness(supabase, "b1", {
      assertUserId: "u1",
    });
    expect("alerts" in audit).toBe(true);
    expect(audit).toMatchObject({
      has_pending_source_facts: true,
      active_pair_present: false,
      meets_minimum_ia_contract: false,
    });
  });
});
