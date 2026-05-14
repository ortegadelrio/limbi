import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareBrainstormSessionContext } from "@/lib/brainstormer/create-brainstorm-session-context";
import * as loadCtx from "@/lib/brands/load-active-brand-context-for-project";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

vi.mock("@/lib/brands/load-active-brand-context-for-project", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/brands/load-active-brand-context-for-project")>();
  return {
    ...actual,
    loadActiveBrandContextForProject: vi.fn(),
  };
});

describe("prepareBrainstormSessionContext", () => {
  const supabase = {} as SupabaseClient;

  beforeEach(() => {
    vi.mocked(loadCtx.loadActiveBrandContextForProject).mockReset();
  });

  it("importa y delega en loadActiveBrandContextForProject", async () => {
    vi.mocked(loadCtx.loadActiveBrandContextForProject).mockResolvedValue({
      ok: true,
      brand: { id: "b1", name: "Acme" },
      active_knowledge_base: {
        id: "k1",
        brand_id: "b1",
        consolidation_run_id: "r1",
        status: "succeeded",
        consolidated_payload: {},
        source_snapshot: {},
        prompt_version: "brand-base-consolidation-v1.2",
        model_used: null,
        error_message: null,
        is_active: true,
        superseded_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      active_limbic_base: {
        id: "l1",
        brand_id: "b1",
        consolidation_run_id: "r1",
        status: "succeeded",
        consolidated_payload: {},
        source_snapshot: {},
        prompt_version: "brand-base-consolidation-v1.2",
        model_used: null,
        error_message: null,
        is_active: true,
        superseded_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      knowledge_payload: {},
      limbic_payload: {},
      source_metadata: {
        brand_id: "b1",
        brand_name: "Acme",
        active_brand_knowledge_base_id: "k1",
        active_brand_limbic_base_id: "l1",
        knowledge_consolidated_at: "2026-01-01T00:00:00Z",
        limbic_consolidated_at: "2026-01-01T00:00:00Z",
        prompt_version: "brand-base-consolidation-v1.2",
        source_snapshot: null,
        source_trace: null,
      },
      is_stale: false,
      blocking_reasons: [],
      knowledge_payload_contract_gaps: [],
      limbic_payload_contract_gaps: [],
      consolidation_running: false,
      knowledge_base_is_stale: false,
      limbic_base_is_stale: false,
      pending_source_facts_review: false,
      diagnosis_is_stale_blocking: false,
      generated_at_bogota: "2026-01-01 00:00 Hora Bogotá",
      interpretive_rules: loadCtx.BRAND_CONTEXT_INTERPRETIVE_RULES_FOR_PROJECTS_ES,
    });

    const out = await prepareBrainstormSessionContext(supabase, {
      userId: "u1",
      brandId: "b1",
      title: "  Mi sesión  ",
    });

    expect(loadCtx.loadActiveBrandContextForProject).toHaveBeenCalledWith(supabase, "b1", {
      assertUserId: "u1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.title).toBe("Mi sesión");
    expect(out.source_brand_knowledge_base_id).toBe("k1");
    expect(out.source_brand_limbic_base_id).toBe("l1");
    expect(out.can_start).toBe(true);
    expect(out.source_brand_context.source_brand_base_prompt_version).toBe(
      "brand-base-consolidation-v1.2",
    );
    expect(out.interpretive_rules.length).toBeGreaterThan(0);
  });

  it("devuelve ids null y can_start false si falta una base", async () => {
    vi.mocked(loadCtx.loadActiveBrandContextForProject).mockResolvedValue({
      ok: true,
      brand: { id: "b1", name: "Acme" },
      active_knowledge_base: null,
      active_limbic_base: {
        id: "l1",
        brand_id: "b1",
        consolidation_run_id: "r1",
        status: "succeeded",
        consolidated_payload: {},
        source_snapshot: {},
        prompt_version: "pv",
        model_used: null,
        error_message: null,
        is_active: true,
        superseded_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      knowledge_payload: null,
      limbic_payload: {},
      source_metadata: {
        brand_id: "b1",
        brand_name: "Acme",
        active_brand_knowledge_base_id: null,
        active_brand_limbic_base_id: "l1",
        knowledge_consolidated_at: null,
        limbic_consolidated_at: "2026-01-01T00:00:00Z",
        prompt_version: "pv",
        source_snapshot: null,
        source_trace: null,
      },
      is_stale: false,
      blocking_reasons: ["no_active_knowledge_base"],
      knowledge_payload_contract_gaps: ["missing_knowledge_payload"],
      limbic_payload_contract_gaps: [],
      consolidation_running: false,
      knowledge_base_is_stale: false,
      limbic_base_is_stale: false,
      pending_source_facts_review: false,
      diagnosis_is_stale_blocking: false,
      generated_at_bogota: "x",
      interpretive_rules: loadCtx.BRAND_CONTEXT_INTERPRETIVE_RULES_FOR_PROJECTS_ES,
    });

    const out = await prepareBrainstormSessionContext(supabase, {
      userId: "u1",
      brandId: "b1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.can_start).toBe(false);
    expect(out.blocking_reasons).toContain("no_active_knowledge_base");
    expect(out.recommended_warning).toContain("Base de Conocimiento");
  });

  it("incluye staleness y pending_review en source_brand_context y avisos", async () => {
    vi.mocked(loadCtx.loadActiveBrandContextForProject).mockResolvedValue({
      ok: true,
      brand: { id: "b1", name: "Acme" },
      active_knowledge_base: {
        id: "k1",
        brand_id: "b1",
        consolidation_run_id: "r1",
        status: "succeeded",
        consolidated_payload: {},
        source_snapshot: {},
        prompt_version: "pv",
        model_used: null,
        error_message: null,
        is_active: true,
        superseded_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      active_limbic_base: {
        id: "l1",
        brand_id: "b1",
        consolidation_run_id: "r1",
        status: "succeeded",
        consolidated_payload: {},
        source_snapshot: {},
        prompt_version: "pv",
        model_used: null,
        error_message: null,
        is_active: true,
        superseded_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      knowledge_payload: {},
      limbic_payload: {},
      source_metadata: {
        brand_id: "b1",
        brand_name: "Acme",
        active_brand_knowledge_base_id: "k1",
        active_brand_limbic_base_id: "l1",
        knowledge_consolidated_at: "2026-01-01T00:00:00Z",
        limbic_consolidated_at: "2026-01-01T00:00:00Z",
        prompt_version: "pv",
        source_snapshot: null,
        source_trace: null,
      },
      is_stale: true,
      blocking_reasons: ["knowledge_base_stale", "pending_source_facts_review"],
      knowledge_payload_contract_gaps: [],
      limbic_payload_contract_gaps: [],
      consolidation_running: false,
      knowledge_base_is_stale: true,
      limbic_base_is_stale: false,
      pending_source_facts_review: true,
      diagnosis_is_stale_blocking: false,
      generated_at_bogota: "x",
      interpretive_rules: loadCtx.BRAND_CONTEXT_INTERPRETIVE_RULES_FOR_PROJECTS_ES,
    });

    const out = await prepareBrainstormSessionContext(supabase, {
      userId: "u1",
      brandId: "b1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.can_start).toBe(true);
    expect(out.source_brand_context.bases_stale_at_session_start).toBe(true);
    expect(out.source_brand_context.pending_source_facts_review_at_start).toBe(true);
    expect(out.recommended_warning).toContain("pendientes");
    expect(out.recommended_warning).toContain("desactualizada");
  });

  it("el helper no referencia brand_responses en código fuente", () => {
    const p = path.join(__dirname, "create-brainstorm-session-context.ts");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("loadActiveBrandContextForProject");
    expect(src).not.toMatch(/\.from\(\s*["']brand_responses["']\s*\)/);
  });
});
