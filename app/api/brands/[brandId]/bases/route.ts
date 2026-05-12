import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { loadBrandBasesDetailState } from "@/lib/brands/load-brand-bases-state";

export const runtime = "nodejs";

type Params = { params: Promise<{ brandId: string }> };

async function assertBrandOwned(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  userId: string,
  brandId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  if (!(await assertBrandOwned(supabase, user.id, brandId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = await loadBrandBasesDetailState(supabase, brandId);
  return NextResponse.json(payload);
}
