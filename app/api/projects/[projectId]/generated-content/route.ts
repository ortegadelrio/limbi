import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import type { ContentGenerationType } from "@/lib/content/build-input";

type Params = { params: Promise<{ projectId: string }> };

const CONTENT_TYPES: readonly ContentGenerationType[] = [
  "short_pitch",
  "captions",
  "content_ideas",
  "graphic_phrases",
];

function isContentType(v: string): v is ContentGenerationType {
  return (CONTENT_TYPES as readonly string[]).includes(v);
}

export async function GET(request: Request, { params }: Params) {
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

  const url = new URL(request.url);
  const ctParam = url.searchParams.get("content_type");

  let query = supabase
    .from("generated_contents")
    .select("id, project_id, content_type, status, created_at, request, output")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (ctParam !== null && ctParam !== "") {
    if (!isContentType(ctParam)) {
      return NextResponse.json(
        {
          error: `content_type inválido. Valores: ${CONTENT_TYPES.join(", ")}.`,
        },
        { status: 400 },
      );
    }
    query = query.eq("content_type", ctParam);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    generated_contents: data ?? [],
  });
}
