import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { patchBrandBodySchema } from "@/lib/schemas/brand";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select(
      "id, user_id, name, description, brand_status, website_url, country_or_market, created_at, updated_at",
    )
    .eq("id", brandId)
    .maybeSingle();

  if (brandError) {
    return NextResponse.json({ error: brandError.message }, { status: 500 });
  }
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("brand_offer_profiles")
    .select("offer_nature")
    .eq("brand_id", brandId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    brand: {
      ...brand,
      offer_nature: profile?.offer_nature ?? null,
    },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = patchBrandBodySchema.safeParse(body);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
      parsed.error.message;
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const patch = parsed.data;

  const { data: existing, error: existingError } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const brandUpdates: Record<string, unknown> = {};
  if (patch.name !== undefined) brandUpdates.name = patch.name;
  if (patch.description !== undefined) {
    brandUpdates.description = patch.description;
  }
  if (patch.brand_status !== undefined) {
    brandUpdates.brand_status = patch.brand_status;
  }
  if (patch.website_url !== undefined) {
    brandUpdates.website_url = patch.website_url;
  }
  if (patch.country_or_market !== undefined) {
    brandUpdates.country_or_market = patch.country_or_market;
  }

  if (Object.keys(brandUpdates).length > 0) {
    const { error: updateBrandError } = await supabase
      .from("brands")
      .update(brandUpdates)
      .eq("id", brandId);

    if (updateBrandError) {
      return NextResponse.json(
        { error: updateBrandError.message },
        { status: 500 },
      );
    }
  }

  if (patch.offer_nature !== undefined) {
    const { data: profileRow, error: profileSelectError } = await supabase
      .from("brand_offer_profiles")
      .select("id")
      .eq("brand_id", brandId)
      .maybeSingle();

    if (profileSelectError) {
      return NextResponse.json(
        { error: profileSelectError.message },
        { status: 500 },
      );
    }
    if (!profileRow) {
      return NextResponse.json(
        { error: "Perfil de oferta no encontrado para esta marca." },
        { status: 409 },
      );
    }

    const { error: profileUpdateError } = await supabase
      .from("brand_offer_profiles")
      .update({ offer_nature: patch.offer_nature })
      .eq("brand_id", brandId);

    if (profileUpdateError) {
      return NextResponse.json(
        { error: profileUpdateError.message },
        { status: 500 },
      );
    }
  }

  const { data: brand, error: brandFetchError } = await supabase
    .from("brands")
    .select(
      "id, user_id, name, description, brand_status, website_url, country_or_market, created_at, updated_at",
    )
    .eq("id", brandId)
    .maybeSingle();

  if (brandFetchError || !brand) {
    return NextResponse.json(
      { error: brandFetchError?.message ?? "Not found" },
      { status: brandFetchError ? 500 : 404 },
    );
  }

  const { data: profile } = await supabase
    .from("brand_offer_profiles")
    .select("offer_nature")
    .eq("brand_id", brandId)
    .maybeSingle();

  return NextResponse.json({
    brand: {
      ...brand,
      offer_nature: profile?.offer_nature ?? null,
    },
  });
}
