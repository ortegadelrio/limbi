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
import { fetchLatestFrameworkRevisionGuidanceForProject } from "@/lib/framework/revision-events";

type Params = { params: Promise<{ projectId: string }> };

const WIZARD_COMPLETE_STEP = "review_before_generation" as const;

function extractInputQualityAssessment(
  document: unknown,
): Record<string, unknown> | null {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return null;
  }
  const doc = document as Record<string, unknown>;
  const iqa = doc.input_quality_assessment;
  if (!iqa || typeof iqa !== "object" || Array.isArray(iqa)) {
    return null;
  }
  return { ...(iqa as Record<string, unknown>) };
}

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, user_id, name_or_descriptor, name_status, challenge_type, main_challenge, status, created_at, updated_at",
    )
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
    .select("completed_steps, responses")
    .eq("project_id", projectId)
    .maybeSingle();

  if (prError) {
    return NextResponse.json({ error: prError.message }, { status: 500 });
  }

  const rawSteps = pr?.completed_steps;
  const completed_steps: string[] = Array.isArray(rawSteps)
    ? rawSteps.filter((x): x is string => typeof x === "string")
    : [];
  const has_completed_wizard = completed_steps.includes(WIZARD_COMPLETE_STEP);

  const { data: activeMasterRow, error: masterError } = await supabase
    .from("master_documents")
    .select("id, project_id, version, status, created_at, document")
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();

  if (masterError) {
    return NextResponse.json({ error: masterError.message }, { status: 500 });
  }

  const active_master_document = activeMasterRow
    ? {
        id: activeMasterRow.id,
        project_id: activeMasterRow.project_id,
        version: activeMasterRow.version,
        status: activeMasterRow.status,
        created_at: activeMasterRow.created_at,
      }
    : null;

  const input_quality_assessment = activeMasterRow
    ? extractInputQualityAssessment(activeMasterRow.document)
    : null;

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
      activeMasterRow?.document ?? null,
    );

  let displayedFw;
  try {
    displayedFw = await fetchDisplayedVisibleFramework(
      supabase,
      projectId,
      project.status,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer el marco.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const framework_is_outdated_since_master = displayedFw
    ? computeFrameworkIsOutdatedSinceMaster(
        displayedFw.master_document_id,
        activeMasterRow?.id ?? null,
      )
    : false;

  const { data: latestFw, error: latestFwError } = await supabase
    .from("visible_frameworks")
    .select("id, project_id, master_document_id, version, status, created_at")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestFwError) {
    return NextResponse.json({ error: latestFwError.message }, { status: 500 });
  }

  const { data: approvedFw, error: approvedFwError } = await supabase
    .from("visible_frameworks")
    .select("id, project_id, master_document_id, version, status, created_at")
    .eq("project_id", projectId)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (approvedFwError) {
    return NextResponse.json({ error: approvedFwError.message }, { status: 500 });
  }

  const { data: gcRows, error: gcError } = await supabase
    .from("generated_contents")
    .select("content_type")
    .eq("project_id", projectId);

  if (gcError) {
    return NextResponse.json({ error: gcError.message }, { status: 500 });
  }

  const generated_content_counts = {
    short_pitch: 0,
    captions: 0,
    content_ideas: 0,
    graphic_phrases: 0,
  };

  for (const row of gcRows ?? []) {
    const t = row.content_type;
    if (t === "short_pitch") generated_content_counts.short_pitch += 1;
    else if (t === "captions") generated_content_counts.captions += 1;
    else if (t === "content_ideas") generated_content_counts.content_ideas += 1;
    else if (t === "graphic_phrases")
      generated_content_counts.graphic_phrases += 1;
  }

  const latestGuidance =
    await fetchLatestFrameworkRevisionGuidanceForProject(supabase, projectId);
  const has_active_framework_revision_guidance = latestGuidance !== null;

  return NextResponse.json({
    project,
    has_completed_wizard,
    completed_steps,
    active_master_document,
    input_quality_assessment,
    responses_have_changed_since_master,
    framework_is_outdated_since_master,
    latest_visible_framework: latestFw ?? null,
    approved_visible_framework: approvedFw ?? null,
    generated_content_counts,
    has_active_framework_revision_guidance,
  });
}
