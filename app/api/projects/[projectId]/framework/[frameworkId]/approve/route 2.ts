import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import {
  computeFrameworkIsOutdatedSinceMaster,
  computeResponsesHaveChangedSinceMaster,
} from "@/lib/framework/framework-staleness";
import {
  FRAMEWORK_APPROVE_SCHEMA_ERROR_MESSAGE,
  isStoredFrameworkEligibleForApprove,
} from "@/lib/framework/validate-framework-json";

type Params = {
  params: Promise<{ projectId: string; frameworkId: string }>;
};

const APPROVE_ONLY_DRAFT =
  "Solo se pueden aprobar marcos en borrador.";

const FRAMEWORK_STALE_MESSAGE =
  "Este Marco está desactualizado respecto a la base del proyecto o al Documento Maestro activo. Regenera la lectura estratégica y el Marco desde el centro del proyecto antes de aprobar.";

export async function POST(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId, frameworkId } = await params;

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

  const { data: fw, error: fwError } = await supabase
    .from("visible_frameworks")
    .select("id, project_id, status, version, master_document_id, framework")
    .eq("id", frameworkId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (fwError) {
    return NextResponse.json({ error: fwError.message }, { status: 500 });
  }
  if (!fw) {
    return jsonNotFound();
  }

  if (fw.status !== "draft") {
    return NextResponse.json({ error: APPROVE_ONLY_DRAFT }, { status: 400 });
  }

  if (!isStoredFrameworkEligibleForApprove(fw.framework)) {
    return NextResponse.json(
      { error: FRAMEWORK_APPROVE_SCHEMA_ERROR_MESSAGE },
      { status: 400 },
    );
  }

  const { data: pr, error: prError } = await supabase
    .from("project_responses")
    .select("responses")
    .eq("project_id", projectId)
    .maybeSingle();

  if (prError) {
    return NextResponse.json({ error: prError.message }, { status: 500 });
  }

  const { data: activeMaster, error: activeMasterError } = await supabase
    .from("master_documents")
    .select("id, document")
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();

  if (activeMasterError) {
    return NextResponse.json(
      { error: activeMasterError.message },
      { status: 500 },
    );
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

  const framework_is_outdated_since_master =
    computeFrameworkIsOutdatedSinceMaster(
      fw.master_document_id,
      activeMaster?.id ?? null,
    );

  if (
    responses_have_changed_since_master ||
    framework_is_outdated_since_master
  ) {
    return NextResponse.json({ error: FRAMEWORK_STALE_MESSAGE }, { status: 409 });
  }

  const { error: archiveOthersError } = await supabase
    .from("visible_frameworks")
    .update({ status: "archived" })
    .eq("project_id", projectId)
    .eq("status", "approved")
    .neq("id", frameworkId);

  if (archiveOthersError) {
    return NextResponse.json(
      { error: archiveOthersError.message },
      { status: 500 },
    );
  }

  const { error: approveError } = await supabase
    .from("visible_frameworks")
    .update({ status: "approved" })
    .eq("id", frameworkId)
    .eq("status", "draft");

  if (approveError) {
    return NextResponse.json({ error: approveError.message }, { status: 500 });
  }

  const { data: updated, error: refetchError } = await supabase
    .from("visible_frameworks")
    .select("id, project_id, version, status, created_at")
    .eq("id", frameworkId)
    .single();

  if (refetchError || !updated) {
    return NextResponse.json(
      { error: refetchError?.message ?? "No se pudo leer el marco aprobado." },
      { status: 500 },
    );
  }

  const { error: projectUpdateError } = await supabase
    .from("projects")
    .update({ status: "framework_approved" })
    .eq("id", projectId);

  if (projectUpdateError) {
    return NextResponse.json(
      { error: projectUpdateError.message },
      { status: 500 },
    );
  }

  const approved_at = new Date().toISOString();

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: projectId,
    user_id: user.id,
    event_type: "framework_approved",
    payload: {
      project_id: projectId,
      visible_framework_id: frameworkId,
      framework_version: fw.version,
      master_document_id: fw.master_document_id,
      approved_at,
    },
  });

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  return NextResponse.json({
    visible_framework: {
      id: updated.id,
      project_id: updated.project_id,
      version: updated.version,
      status: updated.status,
      created_at: updated.created_at,
    },
  });
}
