import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { putBrandOfferItemsBodySchema } from "@/lib/schemas/brand-offer-items";
import { touchBrandRowUpdatedAtForQuestionnaireStructure } from "@/lib/brands/touch-brand-questionnaire-structure";
import type { BrandOfferItemRow, BrandOfferNature } from "@/types/database";

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
    .from("brand_offer_items")
    .select(
      "id, brand_id, offer_nature, item_type, title, description, display_order, created_at, updated_at",
    )
    .eq("brand_id", brandId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: (data ?? []) as BrandOfferItemRow[] });
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

  const { data: profile, error: profileError } = await supabase
    .from("brand_offer_profiles")
    .select("offer_nature")
    .eq("brand_id", brandId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile?.offer_nature) {
    return jsonBadRequest(
      "Define la naturaleza de marca antes de guardar la oferta.",
    );
  }

  const offerNature = profile.offer_nature as BrandOfferNature;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = putBrandOfferItemsBodySchema.safeParse(body);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
      parsed.error.message;
    return jsonBadRequest(first);
  }

  const { items } = parsed.data;

  const persistedItems = items
    .filter((it) => it.title.length > 0)
    .map((it, idx) => ({
      ...it,
      display_order: idx,
    }));

  const { error: delError } = await supabase
    .from("brand_offer_items")
    .delete()
    .eq("brand_id", brandId);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  if (persistedItems.length === 0) {
    const touch = await touchBrandRowUpdatedAtForQuestionnaireStructure(
      supabase,
      brandId,
    );
    if (!touch.ok) {
      return NextResponse.json({ error: touch.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, items: [] as BrandOfferItemRow[] });
  }

  const rows = persistedItems.map((it) => ({
    brand_id: brandId,
    offer_nature: offerNature,
    item_type: it.item_type,
    title: it.title.trim(),
    description: it.description,
    display_order: it.display_order,
  }));

  const { data: inserted, error: insError } = await supabase
    .from("brand_offer_items")
    .insert(rows)
    .select(
      "id, brand_id, offer_nature, item_type, title, description, display_order, created_at, updated_at",
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
    items: (inserted ?? []) as BrandOfferItemRow[],
  });
}
