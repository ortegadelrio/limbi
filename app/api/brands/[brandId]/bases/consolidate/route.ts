import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import {
  buildBrandBaseConsolidationContext,
  buildBrandBaseConsolidationSourceSnapshot,
} from "@/lib/brands/build-brand-base-consolidation-context";
import { buildBrandBaseConsolidationSystemInstructions } from "@/lib/prompts/brand-base-consolidation";
import { generateBrandBaseConsolidationJson } from "@/lib/openai/brand-base-consolidation";
import {
  BRAND_BASE_CONSOLIDATION_PROMPT_VERSION,
  brandBaseConsolidationRawOutputSchema,
} from "@/lib/schemas/brand-base-consolidation";
import type { BrandDiagnosisBrandSnapshot } from "@/lib/brands/build-brand-diagnosis-context";
import type { BrandKnowledgeBaseRow, BrandLimbicBaseRow } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ brandId: string }> };

function jsonConflict(message: string, code: string) {
  return NextResponse.json({ error: message, code }, { status: 409 });
}

async function assertBrandOwned(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  userId: string,
  brandId: string,
): Promise<BrandDiagnosisBrandSnapshot | null> {
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, description, website_url, country_or_market, brand_status")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data as BrandDiagnosisBrandSnapshot | null;
}

async function countPendingReview(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  brandId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("brand_source_facts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("status", "pending_review");
  if (error) return 0;
  return count ?? 0;
}

async function countRunningConsolidation(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  brandId: string,
): Promise<number> {
  const [{ count: k }, { count: l }] = await Promise.all([
    supabase
      .from("brand_knowledge_bases")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("status", "running"),
    supabase
      .from("brand_limbic_bases")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("status", "running"),
  ]);
  return (k ?? 0) + (l ?? 0);
}

export async function POST(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  const brand = await assertBrandOwned(supabase, user.id, brandId);
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pending_review_count = await countPendingReview(supabase, brandId);
  if (pending_review_count > 0) {
    return jsonConflict(
      "Revisa primero los hallazgos pendientes antes de consolidar las bases.",
      "pending_review_blocking",
    );
  }

  if ((await countRunningConsolidation(supabase, brandId)) > 0) {
    return jsonConflict(
      "Ya hay una consolidación en curso para esta marca. Esperá a que termine.",
      "consolidation_already_running",
    );
  }

  const built = await buildBrandBaseConsolidationContext(supabase, brandId, brand);
  if (!built.ok) {
    if (
      built.code === "offer_profile_required" ||
      built.code === "insufficient_catalog" ||
      built.code === "insufficient_input"
    ) {
      return jsonBadRequest(built.message, { code: built.code, stage: "consolidation" });
    }
    if (built.code === "active_diagnosis_required") {
      return jsonConflict(built.message, built.code);
    }
    return NextResponse.json({ error: built.message, code: built.code }, { status: 500 });
  }

  const consolidationRunId = crypto.randomUUID();
  const sourceSnapBase = buildBrandBaseConsolidationSourceSnapshot({
    diagnosisSourceSnapshot: built.sourceSnapshot,
    activeEvaluationId: built.activeEvaluation.id,
    consolidationRunId,
  });

  const { data: kIns, error: kErr } = await supabase
    .from("brand_knowledge_bases")
    .insert({
      brand_id: brandId,
      consolidation_run_id: consolidationRunId,
      status: "running",
      prompt_version: BRAND_BASE_CONSOLIDATION_PROMPT_VERSION,
      is_active: false,
      consolidated_payload: {},
      source_snapshot: sourceSnapBase,
    })
    .select("id")
    .single();

  if (kErr || !kIns) {
    return NextResponse.json(
      { error: kErr?.message ?? "No se pudo iniciar la base de conocimiento." },
      { status: 500 },
    );
  }

  const knowledgeRowId = (kIns as { id: string }).id;

  const { data: lIns, error: lErr } = await supabase
    .from("brand_limbic_bases")
    .insert({
      brand_id: brandId,
      consolidation_run_id: consolidationRunId,
      status: "running",
      prompt_version: BRAND_BASE_CONSOLIDATION_PROMPT_VERSION,
      is_active: false,
      consolidated_payload: {},
      source_snapshot: sourceSnapBase,
    })
    .select("id")
    .single();

  if (lErr || !lIns) {
    await supabase
      .from("brand_knowledge_bases")
      .update({
        status: "failed",
        error_message: lErr?.message ?? "No se pudo iniciar la base límbica.",
        is_active: false,
      })
      .eq("id", knowledgeRowId);
    return NextResponse.json(
      { error: lErr?.message ?? "No se pudo iniciar la base límbica." },
      { status: 500 },
    );
  }

  const limbicRowId = (lIns as { id: string }).id;

  const systemText = buildBrandBaseConsolidationSystemInstructions();
  const userPayload = `consolidation_context:\n${JSON.stringify(built.consolidationContext)}`;
  const fullInput = `${systemText}\n\n---\n\n${userPayload}`;

  const failBoth = async (msg: string) => {
    await supabase
      .from("brand_knowledge_bases")
      .update({ status: "failed", error_message: msg, is_active: false })
      .eq("id", knowledgeRowId);
    await supabase
      .from("brand_limbic_bases")
      .update({ status: "failed", error_message: msg, is_active: false })
      .eq("id", limbicRowId);
  };

  try {
    const { model_used, raw_json_text } = await generateBrandBaseConsolidationJson({
      input: fullInput,
    });

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw_json_text) as unknown;
    } catch {
      throw new Error("La salida de consolidación no es JSON válido.");
    }

    const z = brandBaseConsolidationRawOutputSchema.safeParse(parsedJson);
    if (!z.success) {
      throw new Error(`Consolidación inválida: ${z.error.message}`);
    }

    const snapshotFinal = {
      ...sourceSnapBase,
      model_used,
      knowledge_row_id: knowledgeRowId,
      limbic_row_id: limbicRowId,
    };

    const { error: deactivateKnowledgeErr } = await supabase
      .from("brand_knowledge_bases")
      .update({ is_active: false, superseded_at: new Date().toISOString() })
      .eq("brand_id", brandId)
      .eq("is_active", true);

    if (deactivateKnowledgeErr) {
      throw new Error(deactivateKnowledgeErr.message);
    }

    const { error: deactivateLimbicErr } = await supabase
      .from("brand_limbic_bases")
      .update({ is_active: false, superseded_at: new Date().toISOString() })
      .eq("brand_id", brandId)
      .eq("is_active", true);

    if (deactivateLimbicErr) {
      throw new Error(deactivateLimbicErr.message);
    }

    const knowledgePayload = z.data.knowledge_base as unknown as Record<string, unknown>;
    const limbicPayload = z.data.limbic_base as unknown as Record<string, unknown>;

    const { data: knowledgeOut, error: kUpdErr } = await supabase
      .from("brand_knowledge_bases")
      .update({
        status: "succeeded",
        is_active: true,
        consolidated_payload: knowledgePayload,
        source_snapshot: snapshotFinal,
        model_used,
        prompt_version: BRAND_BASE_CONSOLIDATION_PROMPT_VERSION,
        error_message: null,
      })
      .eq("id", knowledgeRowId)
      .select("*")
      .single();

    if (kUpdErr || !knowledgeOut) {
      throw new Error(kUpdErr?.message ?? "No se pudo guardar la base de conocimiento.");
    }

    const { data: limbicOut, error: lUpdErr } = await supabase
      .from("brand_limbic_bases")
      .update({
        status: "succeeded",
        is_active: true,
        consolidated_payload: limbicPayload,
        source_snapshot: snapshotFinal,
        model_used,
        prompt_version: BRAND_BASE_CONSOLIDATION_PROMPT_VERSION,
        error_message: null,
      })
      .eq("id", limbicRowId)
      .select("*")
      .single();

    if (lUpdErr || !limbicOut) {
      throw new Error(lUpdErr?.message ?? "No se pudo guardar la base límbica.");
    }

    return NextResponse.json({
      knowledge_base: knowledgeOut as BrandKnowledgeBaseRow,
      limbic_base: limbicOut as BrandLimbicBaseRow,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al consolidar las bases.";
    await failBoth(msg);
    return NextResponse.json({ error: msg, code: "consolidation_failed" }, { status: 500 });
  }
}
