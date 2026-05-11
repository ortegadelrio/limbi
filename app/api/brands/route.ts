import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { createBrandBodySchema } from "@/lib/schemas/brand";

export async function GET() {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { data: brands, error: brandsError } = await supabase
    .from("brands")
    .select(
      "id, user_id, name, description, brand_status, website_url, country_or_market, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (brandsError) {
    return NextResponse.json({ error: brandsError.message }, { status: 500 });
  }

  const list = brands ?? [];
  if (list.length === 0) {
    return NextResponse.json({ brands: [] });
  }

  const ids = list.map((b) => b.id);
  const { data: profiles, error: profilesError } = await supabase
    .from("brand_offer_profiles")
    .select("brand_id, offer_nature")
    .in("brand_id", ids);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const natureByBrand = new Map(
    (profiles ?? []).map((p) => [p.brand_id, p.offer_nature] as const),
  );

  const brandsWithNature = list.map((b) => ({
    ...b,
    offer_nature: natureByBrand.get(b.id) ?? null,
  }));

  return NextResponse.json({ brands: brandsWithNature });
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createBrandBodySchema.safeParse(body);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
      parsed.error.message;
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const {
    name,
    offer_nature,
    description,
    brand_status,
    website_url,
    country_or_market,
  } = parsed.data;

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .insert({
      user_id: user.id,
      name,
      description: description ?? null,
      brand_status: brand_status ?? "new",
      website_url: website_url ?? null,
      country_or_market: country_or_market ?? null,
    })
    .select(
      "id, user_id, name, description, brand_status, website_url, country_or_market, created_at, updated_at",
    )
    .single();

  if (brandError || !brand) {
    return NextResponse.json(
      { error: brandError?.message ?? "No se pudo crear la marca." },
      { status: 500 },
    );
  }

  const { error: profileError } = await supabase
    .from("brand_offer_profiles")
    .insert({
      brand_id: brand.id,
      offer_nature,
    });

  if (profileError) {
    await supabase.from("brands").delete().eq("id", brand.id);
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { brand: { ...brand, offer_nature } },
    { status: 201 },
  );
}
