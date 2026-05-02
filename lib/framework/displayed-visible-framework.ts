import type { SupabaseClient } from "@supabase/supabase-js";

const SELECT_DISPLAYED =
  "id, project_id, master_document_id, version, status, created_at, framework";

export type DisplayedVisibleFrameworkRow = {
  id: string;
  project_id: string;
  master_document_id: string | null;
  version: number;
  status: string;
  created_at: string;
  framework: unknown;
};

/**
 * Misma fila que devuelve GET /api/projects/[projectId]/framework en `visible_framework`.
 */
export async function fetchDisplayedVisibleFramework(
  supabase: SupabaseClient,
  projectId: string,
  projectStatus: string,
): Promise<DisplayedVisibleFrameworkRow | null> {
  const projectApproved = projectStatus === "framework_approved";

  if (projectApproved) {
    const { data: approvedRow, error: approvedError } = await supabase
      .from("visible_frameworks")
      .select(SELECT_DISPLAYED)
      .eq("project_id", projectId)
      .eq("status", "approved")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (approvedError) throw new Error(approvedError.message);
    if (approvedRow) return approvedRow as DisplayedVisibleFrameworkRow;

    const { data: draftFallback, error: draftFallbackError } = await supabase
      .from("visible_frameworks")
      .select(SELECT_DISPLAYED)
      .eq("project_id", projectId)
      .eq("status", "draft")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draftFallbackError) throw new Error(draftFallbackError.message);
    return draftFallback as DisplayedVisibleFrameworkRow | null;
  }

  const { data: draftRow, error: draftError } = await supabase
    .from("visible_frameworks")
    .select(SELECT_DISPLAYED)
    .eq("project_id", projectId)
    .eq("status", "draft")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draftError) throw new Error(draftError.message);
  if (draftRow) return draftRow as DisplayedVisibleFrameworkRow;

  const { data: approvedRow, error: approvedError } = await supabase
    .from("visible_frameworks")
    .select(SELECT_DISPLAYED)
    .eq("project_id", projectId)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (approvedError) throw new Error(approvedError.message);
  return approvedRow as DisplayedVisibleFrameworkRow | null;
}
