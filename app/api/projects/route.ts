import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { createProjectBodySchema } from "@/lib/schemas/project";

export async function GET() {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, user_id, name_or_descriptor, name_status, challenge_type, main_challenge, status, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: data ?? [] });
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

  const parsed = createProjectBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name_or_descriptor, name_status } = parsed.data;

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name_or_descriptor,
      name_status: name_status ?? "provisional",
    })
    .select(
      "id, user_id, name_or_descriptor, name_status, challenge_type, main_challenge, status, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resolvedNameStatus = name_status ?? "provisional";
  const { error: responsesError } = await supabase
    .from("project_responses")
    .insert({
      project_id: data.id,
      user_id: user.id,
      responses: {
        project_identity: {
          name_or_descriptor,
          name_status: resolvedNameStatus,
        },
      },
      completed_steps: ["project_identity"],
    });

  if (responsesError) {
    await supabase.from("projects").delete().eq("id", data.id);
    return NextResponse.json(
      { error: responsesError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ project: data }, { status: 201 });
}
