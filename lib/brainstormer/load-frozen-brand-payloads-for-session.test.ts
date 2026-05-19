import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFrozenBrandPayloadsForBrainstormSession } from "@/lib/brainstormer/load-frozen-brand-payloads-for-session";

function chainMaybeSingle(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

function mockSupabaseForFrozenBases(args: {
  brandOk: boolean;
  knowledgeRows: Record<string, { brand_id: string; consolidated_payload: unknown }>;
  limbicRows: Record<string, { brand_id: string; consolidated_payload: unknown }>;
}): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      if (table === "brands") {
        return chainMaybeSingle({
          data: args.brandOk ? { id: "b1" } : null,
          error: null,
        });
      }
      if (table === "brand_knowledge_bases") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((_col: string, id: string) => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: args.knowledgeRows[id] ?? null,
              error: null,
            }),
          })),
        };
      }
      if (table === "brand_limbic_bases") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((_col: string, id: string) => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: args.limbicRows[id] ?? null,
              error: null,
            }),
          })),
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    }),
  } as unknown as SupabaseClient;
}

describe("loadFrozenBrandPayloadsForBrainstormSession", () => {
  const session = {
    brand_id: "b1",
    brand_knowledge_base_id_used: "k-frozen",
    brand_limbic_base_id_used: "l-frozen",
  };

  it("carga consolidated_payload por ids congelados en la sesión", async () => {
    const frozenKnowledge = { version: "frozen-v1", marker: "sesion-congelada" };
    const frozenLimbic = { symbolic_reading: "Límbico congelado" };

    const supabase = mockSupabaseForFrozenBases({
      brandOk: true,
      knowledgeRows: {
        "k-frozen": { brand_id: "b1", consolidated_payload: frozenKnowledge },
        "k-active-new": { brand_id: "b1", consolidated_payload: { version: "active-v2" } },
      },
      limbicRows: {
        "l-frozen": { brand_id: "b1", consolidated_payload: frozenLimbic },
        "l-active-new": { brand_id: "b1", consolidated_payload: { symbolic_reading: "Límbico nuevo" } },
      },
    });

    const out = await loadFrozenBrandPayloadsForBrainstormSession(supabase, session, "u1");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.knowledge_payload).toEqual(frozenKnowledge);
    expect(out.limbic_payload).toEqual(frozenLimbic);
    expect(out.knowledge_payload?.marker).toBe("sesion-congelada");
  });

  it("mantiene base congelada aunque exista otra fila activa más nueva (reconsolidación posterior)", async () => {
    const supabase = mockSupabaseForFrozenBases({
      brandOk: true,
      knowledgeRows: {
        "k-old": {
          brand_id: "b1",
          consolidated_payload: { consolidated_at: "2026-01-01", offer: "versión A" },
        },
        "k-new-active": {
          brand_id: "b1",
          consolidated_payload: { consolidated_at: "2026-06-01", offer: "versión B reconsolidada" },
        },
      },
      limbicRows: {
        "l-old": { brand_id: "b1", consolidated_payload: { symbolic_reading: "A" } },
        "l-new-active": { brand_id: "b1", consolidated_payload: { symbolic_reading: "B" } },
      },
    });

    const out = await loadFrozenBrandPayloadsForBrainstormSession(
      supabase,
      {
        brand_id: "b1",
        brand_knowledge_base_id_used: "k-old",
        brand_limbic_base_id_used: "l-old",
      },
      "u1",
    );

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.knowledge_payload?.offer).toBe("versión A");
    expect(out.limbic_payload?.symbolic_reading).toBe("A");
    expect(out.knowledge_payload?.offer).not.toBe("versión B reconsolidada");
  });
});
