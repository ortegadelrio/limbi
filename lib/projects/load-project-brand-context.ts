import type { SupabaseClient } from "@supabase/supabase-js";
import { loadActiveBrandContextForProject } from "@/lib/brands/load-active-brand-context-for-project";
import type {
  BrandKnowledgeBaseRow,
  BrandLimbicBaseRow,
  ProjectRow,
} from "@/types/database";

export type ProjectBrandContextBlockingReason =
  | "no_brand_linked"
  | "no_active_knowledge_base"
  | "no_active_limbic_base"
  | "pending_source_facts_review"
  | "diagnosis_stale"
  | "knowledge_base_stale"
  | "limbic_base_stale";

export type LoadProjectBrandContextOk = {
  ok: true;
  project: Pick<ProjectRow, "id" | "user_id" | "brand_id" | "name_or_descriptor">;
  brand: { id: string; name: string } | null;
  active_brand_knowledge_base: BrandKnowledgeBaseRow | null;
  active_brand_limbic_base: BrandLimbicBaseRow | null;
  knowledge_base_is_stale: boolean;
  limbic_base_is_stale: boolean;
  consolidation_running: boolean;
  base_staleness: {
    knowledge_is_stale: boolean;
    limbic_is_stale: boolean;
    any_stale: boolean;
  };
  blocking_reasons: ProjectBrandContextBlockingReason[];
};

export type LoadProjectBrandContextResult =
  | LoadProjectBrandContextOk
  | { ok: false; code: "project_not_found" | "forbidden"; message: string };

export function deriveProjectBrandBlockingReasons(args: {
  brand_id: string | null;
  has_knowledge: boolean;
  has_limbic: boolean;
  knowledge_stale: boolean;
  limbic_stale: boolean;
  pending_source_facts_review?: boolean;
  diagnosis_stale?: boolean;
}): ProjectBrandContextBlockingReason[] {
  const out: ProjectBrandContextBlockingReason[] = [];
  if (!args.brand_id) {
    out.push("no_brand_linked");
    return out;
  }
  if (args.pending_source_facts_review) out.push("pending_source_facts_review");
  if (args.diagnosis_stale) out.push("diagnosis_stale");
  if (!args.has_knowledge) out.push("no_active_knowledge_base");
  if (!args.has_limbic) out.push("no_active_limbic_base");
  if (args.has_knowledge && args.knowledge_stale) {
    out.push("knowledge_base_stale");
  }
  if (args.has_limbic && args.limbic_stale) {
    out.push("limbic_base_stale");
  }
  return out;
}

/** Vista reducida para APIs/UI (sin payloads grandes de bases). */
export type ProjectBrandContextPublic = {
  brand: { id: string; name: string } | null;
  has_active_knowledge_base: boolean;
  has_active_limbic_base: boolean;
  knowledge_base_is_stale: boolean;
  limbic_base_is_stale: boolean;
  consolidation_running: boolean;
  blocking_reasons: ProjectBrandContextBlockingReason[];
};

export function toProjectBrandContextPublic(
  ctx: LoadProjectBrandContextOk,
): ProjectBrandContextPublic {
  return {
    brand: ctx.brand,
    has_active_knowledge_base: Boolean(ctx.active_brand_knowledge_base),
    has_active_limbic_base: Boolean(ctx.active_brand_limbic_base),
    knowledge_base_is_stale: ctx.knowledge_base_is_stale,
    limbic_base_is_stale: ctx.limbic_base_is_stale,
    consolidation_running: ctx.consolidation_running,
    blocking_reasons: ctx.blocking_reasons,
  };
}

type ProjectRowMin = Pick<
  ProjectRow,
  "id" | "user_id" | "brand_id" | "name_or_descriptor"
>;

/**
 * Contexto de marca para un proyecto: solo proyecto, marca mínima y bases
 * curadas activas (no respuestas crudas ni facts pendientes).
 */
export async function loadProjectBrandContext(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  opts?: { projectRow?: ProjectRowMin | null },
): Promise<LoadProjectBrandContextResult> {
  const project =
    opts?.projectRow !== undefined
      ? opts.projectRow
      : (
          await supabase
            .from("projects")
            .select("id, user_id, brand_id, name_or_descriptor")
            .eq("id", projectId)
            .maybeSingle()
        ).data;

  if (!project) {
    return { ok: false, code: "project_not_found", message: "Proyecto no encontrado." };
  }

  const p = project as ProjectRowMin;
  if (p.user_id !== userId) {
    return { ok: false, code: "forbidden", message: "No autorizado." };
  }

  const brandId = p.brand_id;
  if (!brandId) {
    return {
      ok: true,
      project: p,
      brand: null,
      active_brand_knowledge_base: null,
      active_brand_limbic_base: null,
      knowledge_base_is_stale: false,
      limbic_base_is_stale: false,
      consolidation_running: false,
      base_staleness: {
        knowledge_is_stale: false,
        limbic_is_stale: false,
        any_stale: false,
      },
      blocking_reasons: deriveProjectBrandBlockingReasons({
        brand_id: null,
        has_knowledge: false,
        has_limbic: false,
        knowledge_stale: false,
        limbic_stale: false,
        pending_source_facts_review: false,
        diagnosis_stale: false,
      }),
    };
  }

  const brandCtx = await loadActiveBrandContextForProject(supabase, brandId, {
    assertUserId: userId,
  });

  if (!brandCtx.ok) {
    const blocking_reasons = deriveProjectBrandBlockingReasons({
      brand_id: brandId,
      has_knowledge: false,
      has_limbic: false,
      knowledge_stale: false,
      limbic_stale: false,
      pending_source_facts_review: false,
      diagnosis_stale: false,
    });
    return {
      ok: true,
      project: p,
      brand: null,
      active_brand_knowledge_base: null,
      active_brand_limbic_base: null,
      knowledge_base_is_stale: false,
      limbic_base_is_stale: false,
      consolidation_running: false,
      base_staleness: {
        knowledge_is_stale: false,
        limbic_is_stale: false,
        any_stale: false,
      },
      blocking_reasons,
    };
  }

  const blocking_reasons = deriveProjectBrandBlockingReasons({
    brand_id: brandId,
    has_knowledge: Boolean(brandCtx.active_knowledge_base),
    has_limbic: Boolean(brandCtx.active_limbic_base),
    knowledge_stale: brandCtx.knowledge_base_is_stale,
    limbic_stale: brandCtx.limbic_base_is_stale,
    pending_source_facts_review: brandCtx.pending_source_facts_review,
    diagnosis_stale: brandCtx.diagnosis_is_stale_blocking,
  });

  return {
    ok: true,
    project: p,
    brand: brandCtx.brand,
    active_brand_knowledge_base: brandCtx.active_knowledge_base,
    active_brand_limbic_base: brandCtx.active_limbic_base,
    knowledge_base_is_stale: brandCtx.knowledge_base_is_stale,
    limbic_base_is_stale: brandCtx.limbic_base_is_stale,
    consolidation_running: brandCtx.consolidation_running,
    base_staleness: {
      knowledge_is_stale: brandCtx.knowledge_base_is_stale,
      limbic_is_stale: brandCtx.limbic_base_is_stale,
      any_stale:
        brandCtx.knowledge_base_is_stale ||
        brandCtx.limbic_base_is_stale ||
        brandCtx.diagnosis_is_stale_blocking,
    },
    blocking_reasons,
  };
}
