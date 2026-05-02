import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import { fetchDisplayedVisibleFramework } from "@/lib/framework/displayed-visible-framework";
import {
  computeFrameworkIsOutdatedSinceMaster,
  computeResponsesHaveChangedSinceMaster,
} from "@/lib/framework/framework-staleness";
import { fetchLatestRevisionNoteForFramework } from "@/lib/framework/revision-events";
import { fetchFrameworkRevisionHistory } from "@/lib/framework/revision-history";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, status")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return jsonNotFound();
  }

  const { data: pr, error: prError } = await supabase
    .from("project_responses")
    .select("responses")
    .eq("project_id", projectId)
    .maybeSingle();

  if (prError) {
    return NextResponse.json({ error: prError.message }, { status: 500 });
  }

  const { data: activeMaster, error: masterError } = await supabase
    .from("master_documents")
    .select("id, document")
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();

  if (masterError) {
    return NextResponse.json({ error: masterError.message }, { status: 500 });
  }

  const responsesObj: Record<string, unknown> =
    pr?.responses &&
    typeof pr.responses === "object" &&
    pr.responses !== null &&
    !Array.isArray(pr.responses)
      ? (pr.responses as Record<string, unknown>)
      : {};

  const responses_have_changed_since_master =
    computeResponsesHaveChangedSinceMaster(
      responsesObj,
      activeMaster?.document ?? null,
    );

  let displayedRow;
  try {
    displayedRow = await fetchDisplayedVisibleFramework(
      supabase,
      projectId,
      project.status,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer el marco.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const framework_is_outdated_since_master = displayedRow
    ? computeFrameworkIsOutdatedSinceMaster(
        displayedRow.master_document_id,
        activeMaster?.id ?? null,
      )
    : false;

  const baseOut = {
    responses_have_changed_since_master,
    framework_is_outdated_since_master,
  };

  let revision_history;
  try {
    revision_history = await fetchFrameworkRevisionHistory(supabase, projectId);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Error al leer el historial de sugerencias.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!displayedRow) {
    return NextResponse.json({
      visible_framework: null,
      latest_revision_note: null,
      revision_history,
      ...baseOut,
    });
  }

  const latest = await fetchLatestRevisionNoteForFramework(
    supabase,
    projectId,
    displayedRow.id,
  );

  return NextResponse.json({
    visible_framework: displayedRow,
    latest_revision_note: latest?.revision_note ?? null,
    revision_history,
    ...baseOut,
  });
}
