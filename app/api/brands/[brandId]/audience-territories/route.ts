import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { putBrandAudienceTerritoriesBodySchema } from "@/lib/schemas/brand-audience-territories";
import { touchBrandRowUpdatedAtForQuestionnaireStructure } from "@/lib/brands/touch-brand-questionnaire-structure";
import type { BrandAudienceTerritoryRow } from "@/types/database";

type Params = { params: Promise<{ brandId: string }> };

async function loadOwnedBrand(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  userId: string,
  brandId: string,
) {
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  return { brand: data, error };
}

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  const { brand, error: brandError } = await loadOwnedBrand(
    supabase,
    user.id,
    brandId,
  );
  if (brandError) {
    return NextResponse.json({ error: brandError.message }, { status: 500 });
  }
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("brand_audience_territories")
    .select(
      "id, brand_id, territory_type, name, display_order, created_at, updated_at",
    )
    .eq("brand_id", brandId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    territories: (data ?? []) as BrandAudienceTerritoryRow[],
  });
}

export async function PUT(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  const { brand, error: brandError } = await loadOwnedBrand(
    supabase,
    user.id,
    brandId,
  );
  if (brandError) {
    return NextResponse.json({ error: brandError.message }, { status: 500 });
  }
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = putBrandAudienceTerritoriesBodySchema.safeParse(body);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
      parsed.error.message;
    return jsonBadRequest(first);
  }

  const { territories } = parsed.data;

  const persistedTerritories = territories
    .filter((t) => t.name.length > 0)
    .map((t, idx) => ({
      ...t,
      display_order: idx,
    }));

  const { error: delError } = await supabase
    .from("brand_audience_territories")
    .delete()
    .eq("brand_id", brandId);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  if (persistedTerritories.length === 0) {
    const touch = await touchBrandRowUpdatedAtForQuestionnaireStructure(
      supabase,
      brandId,
    );
    if (!touch.ok) {
      return NextResponse.json({ error: touch.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      territories: [] as BrandAudienceTerritoryRow[],
    });
  }

  const rows = persistedTerritories.map((t) => ({
    brand_id: brandId,
    territory_type: t.territory_type,
    name: t.name.trim(),
    display_order: t.display_order,
  }));

  const { data: inserted, error: insError } = await supabase
    .from("brand_audience_territories")
    .insert(rows)
    .select(
      "id, brand_id, territory_type, name, display_order, created_at, updated_at",
    );

  if (insError) {
    return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  const touch = await touchBrandRowUpdatedAtForQuestionnaireStructure(
    supabase,
    brandId,
  );
  if (!touch.ok) {
    return NextResponse.json({ error: touch.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    territories: (inserted ?? []) as BrandAudienceTerritoryRow[],
  });
}
