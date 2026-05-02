import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import { patchProjectResponsesBodySchema } from "@/lib/schemas/project";
import { deepMergeResponses } from "@/lib/utils/deep-merge";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return jsonNotFound();
  }

  const { data, error } = await supabase
    .from("project_responses")
    .select(
      "id, project_id, user_id, responses, completed_steps, created_at, updated_at",
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project_responses: data ?? null });
}

export async function PATCH(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return jsonNotFound();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = patchProjectResponsesBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { responses: responsesPatch, completed_steps } = parsed.data;

  const { data: existing, error: fetchError } = await supabase
    .from("project_responses")
    .select("id, responses, completed_steps")
    .eq("project_id", projectId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const baseResponses =
    existing?.responses &&
    typeof existing.responses === "object" &&
    existing.responses !== null &&
    !Array.isArray(existing.responses)
      ? (existing.responses as Record<string, unknown>)
      : {};

  const mergedResponses = deepMergeResponses(
    baseResponses,
    (responsesPatch as Record<string, unknown> | undefined) ?? {},
  );

  const nextSteps =
    completed_steps !== undefined
      ? completed_steps
      : Array.isArray(existing?.completed_steps)
        ? (existing.completed_steps as string[])
        : [];

  if (!existing) {
    const { data: inserted, error: insertError } = await supabase
      .from("project_responses")
      .insert({
        project_id: projectId,
        user_id: user.id,
        responses: mergedResponses,
        completed_steps: nextSteps,
      })
      .select(
        "id, project_id, user_id, responses, completed_steps, created_at, updated_at",
      )
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ project_responses: inserted });
  }

  const { data: updated, error: updateError } = await supabase
    .from("project_responses")
    .update({
      responses: mergedResponses,
      completed_steps: nextSteps,
    })
    .eq("id", existing.id)
    .select(
      "id, project_id, user_id, responses, completed_steps, created_at, updated_at",
    )
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ project_responses: updated });
}
