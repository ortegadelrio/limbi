import { describe, expect, it } from "vitest";
import { createProjectBodySchema, patchProjectBodySchema } from "@/lib/schemas/project";
import { isBrandOwnedByUser } from "@/lib/projects/brand-project-validation";
import { deriveProjectBrandBlockingReasons } from "@/lib/projects/load-project-brand-context";

describe("createProjectBodySchema", () => {
  it("accepts optional brand_id uuid", () => {
    const p = createProjectBodySchema.safeParse({
      name_or_descriptor: "X",
      brand_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(p.success).toBe(true);
  });

  it("accepts missing brand_id", () => {
    const p = createProjectBodySchema.safeParse({ name_or_descriptor: "X" });
    expect(p.success).toBe(true);
  });
});

describe("patchProjectBodySchema", () => {
  it("allows patch with only brand_id", () => {
    const p = patchProjectBodySchema.safeParse({
      brand_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(p.success).toBe(true);
  });

  it("allows clearing brand_id", () => {
    const p = patchProjectBodySchema.safeParse({ brand_id: null });
    expect(p.success).toBe(true);
  });
});

describe("deriveProjectBrandBlockingReasons", () => {
  it("returns no_brand_linked when brand_id is null", () => {
    expect(
      deriveProjectBrandBlockingReasons({
        brand_id: null,
        has_knowledge: true,
        has_limbic: true,
        knowledge_stale: false,
        limbic_stale: false,
      }),
    ).toEqual(["no_brand_linked"]);
  });

  it("flags missing bases and staleness when brand is set", () => {
    expect(
      deriveProjectBrandBlockingReasons({
        brand_id: "550e8400-e29b-41d4-a716-446655440000",
        has_knowledge: false,
        has_limbic: true,
        knowledge_stale: false,
        limbic_stale: true,
      }),
    ).toEqual([
      "no_active_knowledge_base",
      "limbic_base_stale",
    ]);
  });

  it("flags pending_source_facts_review and diagnosis_stale before base staleness", () => {
    expect(
      deriveProjectBrandBlockingReasons({
        brand_id: "550e8400-e29b-41d4-a716-446655440000",
        has_knowledge: true,
        has_limbic: true,
        knowledge_stale: false,
        limbic_stale: false,
        pending_source_facts_review: true,
        diagnosis_stale: true,
      }),
    ).toEqual(["pending_source_facts_review", "diagnosis_stale"]);
  });
});

describe("isBrandOwnedByUser", () => {
  it("returns true when a row is returned", async () => {
    const supabase = {
      from() {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { id: "b1" }, error: null }),
              }),
            }),
          }),
        };
      },
    };
    await expect(isBrandOwnedByUser(supabase as never, "b1", "u1")).resolves.toBe(true);
  });

  it("returns false when no row", async () => {
    const supabase = {
      from() {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      },
    };
    await expect(isBrandOwnedByUser(supabase as never, "b1", "u1")).resolves.toBe(false);
  });
});
