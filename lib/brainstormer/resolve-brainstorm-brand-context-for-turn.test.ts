import { describe, expect, it, vi } from "vitest";
import * as activeCtx from "@/lib/brands/load-active-brand-context-for-project";
import * as frozenLoader from "@/lib/brainstormer/load-frozen-brand-payloads-for-session";
import { resolveBrainstormBrandContextForTurn } from "@/lib/brainstormer/resolve-brainstorm-brand-context-for-turn";

describe("resolveBrainstormBrandContextForTurn", () => {
  const session = {
    brand_id: "brand-1",
    brand_knowledge_base_id_used: "k-old",
    brand_limbic_base_id_used: "l-old",
  };

  it("usa payloads congelados cuando la base activa coincide", async () => {
    vi.spyOn(frozenLoader, "loadFrozenBrandPayloadsForBrainstormSession").mockResolvedValue({
      ok: true,
      knowledge_payload: { tag: "frozen" },
      limbic_payload: { tag: "frozen-l" },
    });
    vi.spyOn(activeCtx, "loadActiveBrandContextForProject").mockResolvedValue({
      ok: true,
      brand: { id: "brand-1", name: "Marca" },
      active_knowledge_base: null,
      active_limbic_base: null,
      knowledge_payload: { tag: "active" },
      limbic_payload: { tag: "active-l" },
      source_metadata: {
        active_brand_knowledge_base_id: "k-old",
        active_brand_limbic_base_id: "l-old",
        knowledge_consolidated_at: null,
        limbic_consolidated_at: null,
        knowledge_prompt_version: null,
        limbic_prompt_version: null,
        knowledge_source_snapshot: null,
        limbic_source_snapshot: null,
        knowledge_source_trace: null,
        limbic_source_trace: null,
      },
      blocking_reasons: [],
      interpretive_rules: [],
      knowledge_payload_contract_gaps: [],
      limbic_payload_contract_gaps: [],
      pending_source_facts_review: false,
      is_stale: false,
      knowledge_base_is_stale: false,
      limbic_base_is_stale: false,
      diagnosis_is_stale_blocking: false,
      consolidation_running: false,
      generated_at_bogota: "",
    } as Awaited<ReturnType<typeof activeCtx.loadActiveBrandContextForProject>> & { ok: true });

    const r = await resolveBrainstormBrandContextForTurn({} as never, session, "user-1");
    if ("ok" in r) throw new Error("expected success");
    expect(r.knowledge_payload).toEqual({ tag: "frozen" });
    expect(r.brand_base_updated_since_session_freeze).toBe(false);
  });

  it("usa base activa cuando cambió respecto a la sesión congelada", async () => {
    vi.spyOn(frozenLoader, "loadFrozenBrandPayloadsForBrainstormSession").mockResolvedValue({
      ok: true,
      knowledge_payload: { tag: "frozen" },
      limbic_payload: { tag: "frozen-l" },
    });
    vi.spyOn(activeCtx, "loadActiveBrandContextForProject").mockResolvedValue({
      ok: true,
      brand: { id: "brand-1", name: "Marca" },
      active_knowledge_base: null,
      active_limbic_base: null,
      knowledge_payload: { tag: "active-new" },
      limbic_payload: { tag: "active-l-new" },
      source_metadata: {
        active_brand_knowledge_base_id: "k-new",
        active_brand_limbic_base_id: "l-new",
        knowledge_consolidated_at: null,
        limbic_consolidated_at: null,
        knowledge_prompt_version: null,
        limbic_prompt_version: null,
        knowledge_source_snapshot: null,
        limbic_source_snapshot: null,
        knowledge_source_trace: null,
        limbic_source_trace: null,
      },
      blocking_reasons: [],
      interpretive_rules: [],
      knowledge_payload_contract_gaps: [],
      limbic_payload_contract_gaps: [],
      pending_source_facts_review: false,
      is_stale: false,
      knowledge_base_is_stale: false,
      limbic_base_is_stale: false,
      diagnosis_is_stale_blocking: false,
      consolidation_running: false,
      generated_at_bogota: "",
    } as Awaited<ReturnType<typeof activeCtx.loadActiveBrandContextForProject>> & { ok: true });

    const r = await resolveBrainstormBrandContextForTurn({} as never, session, "user-1");
    if ("ok" in r) throw new Error("expected success");
    expect(r.knowledge_payload).toEqual({ tag: "active-new" });
    expect(r.brand_base_updated_since_session_freeze).toBe(true);
  });
});
