import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import { patchProjectBodySchema } from "@/lib/schemas/project";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, user_id, name_or_descriptor, name_status, challenge_type, main_challenge, status, created_at, updated_at",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return jsonNotFound();
  }

  return NextResponse.json({ project: data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

  const { data: existing, error: fetchError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return jsonNotFound();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = patchProjectBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const updatePayload: Record<string, string | null> = {};
  if (d.name_or_descriptor !== undefined) {
    updatePayload.name_or_descriptor = d.name_or_descriptor;
  }
  if (d.name_status !== undefined) {
    updatePayload.name_status = d.name_status;
  }
  if (d.challenge_type !== undefined) {
    updatePayload.challenge_type = d.challenge_type;
  }
  if (d.main_challenge !== undefined) {
    updatePayload.main_challenge = d.main_challenge;
  }

  const { data, error } = await supabase
    .from("projects")
    .update(updatePayload)
    .eq("id", projectId)
    .select(
      "id, user_id, name_or_descriptor, name_status, challenge_type, main_challenge, status, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}

