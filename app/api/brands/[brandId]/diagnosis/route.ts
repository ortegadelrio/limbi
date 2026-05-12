import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import {
  applyServerDiagnosisQualityLevels,
  BRAND_DIAGNOSIS_PROMPT_VERSION,
  brandDiagnosisRawOutputSchema,
  validateBrandDiagnosisAgainstCatalog,
} from "@/lib/schemas/brand-diagnosis";
import { sectionKeysWithApprovedImprovementAfterEvaluation } from "@/lib/brands/diagnosis-improvement-badges";
import { isBrandDiagnosisStale } from "@/lib/brands/brand-diagnosis-staleness";
import {
  buildBrandDiagnosisEvaluationContext,
  hasMinimumInputForDiagnosis,
  type BrandDiagnosisBrandSnapshot,
} from "@/lib/brands/build-brand-diagnosis-context";
import { buildBrandDiagnosisSystemInstructions } from "@/lib/prompts/brand-diagnosis";
import { generateBrandDiagnosisJson } from "@/lib/openai/brand-diagnosis";
import type { BrandEvaluationRow } from "@/types/database";

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
): Promise<{ id: string; name: string; description: string | null; website_url: string | null; country_or_market: string | null; brand_status: string } | null> {
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, description, website_url, country_or_market, brand_status")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data;
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

async function countRunningEvaluations(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  brandId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("brand_evaluations")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("status", "running");
  if (error) return 0;
  return count ?? 0;
}

function reorderSectionScores<T extends { section_key: string }>(
  scores: T[],
  strategicSectionKeys: string[],
): T[] {
  const map = new Map(scores.map((s) => [s.section_key, s]));
  return strategicSectionKeys.map((k) => map.get(k)).filter((x): x is T => Boolean(x));
}

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  const brand = await assertBrandOwned(supabase, user.id, brandId);
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pending_review_count = await countPendingReview(supabase, brandId);

  const { data: active, error: evErr } = await supabase
    .from("brand_evaluations")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .eq("status", "succeeded")
    .maybeSingle();

  if (evErr) {
    return NextResponse.json({ error: evErr.message }, { status: 500 });
  }

  const evaluation = (active ?? null) as BrandEvaluationRow | null;

  const { data: improvementBadgeRows } = await supabase
    .from("brand_section_improvements")
    .select("section_key, approved_at")
    .eq("brand_id", brandId)
    .eq("status", "approved")
    .eq("is_active", true);

  const section_keys_with_improvement_after_diagnosis =
    sectionKeysWithApprovedImprovementAfterEvaluation(
      evaluation,
      (improvementBadgeRows ?? []) as { section_key: string; approved_at: string | null }[],
    );

  const [responseStaleness, sourceFactStaleness] = evaluation
    ? await Promise.all([
        supabase
          .from("brand_responses")
          .select("updated_at")
          .eq("brand_id", brandId)
          .gt("updated_at", evaluation.created_at),
        supabase
          .from("brand_source_facts")
          .select("reviewed_at, updated_at")
          .eq("brand_id", brandId)
          .eq("status", "approved")
          .or(`reviewed_at.gt.${evaluation.created_at},updated_at.gt.${evaluation.created_at}`),
      ])
    : [null, null];

  const diagnosis_is_stale = isBrandDiagnosisStale({
    evaluation,
    responseRows: responseStaleness?.data ?? [],
    sourceFactRows: sourceFactStaleness?.data ?? [],
    improvementRows: improvementBadgeRows ?? [],
  });

  return NextResponse.json({
    pending_review_count,
    evaluation,
    section_keys_with_improvement_after_diagnosis,
    diagnosis_is_stale,
  });
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
      "Revisa primero los hallazgos pendientes antes de generar el diagnóstico.",
      "pending_review_blocking",
    );
  }

  if ((await countRunningEvaluations(supabase, brandId)) > 0) {
    return jsonConflict(
      "Ya hay un diagnóstico en curso para esta marca. Espera a que termine.",
      "diagnosis_already_running",
    );
  }

  const built = await buildBrandDiagnosisEvaluationContext(
    supabase,
    brandId,
    brand as BrandDiagnosisBrandSnapshot,
    BRAND_DIAGNOSIS_PROMPT_VERSION,
  );
  if (!built.ok) {
    if (built.code === "offer_profile_required" || built.code === "insufficient_catalog") {
      return jsonBadRequest(built.message, { code: built.code, stage: "diagnosis" });
    }
    return NextResponse.json({ error: built.message, code: built.code }, { status: 500 });
  }

  const approvedFactsCount = built.approvedFacts.length;
  const approvedImprovementsCount = built.context.approved_section_improvements.length;
  if (!hasMinimumInputForDiagnosis(built.responses, approvedFactsCount, approvedImprovementsCount)) {
    return jsonBadRequest(
      "No hay información suficiente para generar un diagnóstico de marca. Completa primero el cuestionario o aprueba hallazgos de documentos.",
      { code: "insufficient_input", stage: "diagnosis" },
    );
  }

  const { data: runInsert, error: runInsErr } = await supabase
    .from("brand_evaluations")
    .insert({
      brand_id: brandId,
      evaluation_version: 1,
      status: "running",
      prompt_version: BRAND_DIAGNOSIS_PROMPT_VERSION,
      is_active: false,
      diagnosis_payload: {},
      section_scores: [],
      critical_gaps: [],
      contradictions: [],
      improvement_plan: [],
      source_snapshot: built.sourceSnapshot,
    })
    .select("id")
    .single();

  if (runInsErr || !runInsert) {
    return NextResponse.json(
      { error: runInsErr?.message ?? "No se pudo iniciar el diagnóstico." },
      { status: 500 },
    );
  }

  const runId = (runInsert as { id: string }).id;

  const systemText = buildBrandDiagnosisSystemInstructions({
    strategicSectionKeysOrdered: built.strategicSectionKeys,
  });
  const userPayload = `evaluation_context:\n${JSON.stringify(built.context)}`;
  const fullInput = `${systemText}\n\n---\n\n${userPayload}`;

  try {
    const { model_used, raw_json_text } = await generateBrandDiagnosisJson({
      input: fullInput,
      strategicSectionKeys: built.strategicSectionKeys,
    });

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw_json_text) as unknown;
    } catch {
      throw new Error("La salida del diagnóstico no es JSON válido.");
    }

    const z = brandDiagnosisRawOutputSchema.safeParse(parsedJson);
    if (!z.success) {
      throw new Error(`Diagnóstico inválido: ${z.error.message}`);
    }

    const normalized = applyServerDiagnosisQualityLevels(z.data);
    const reordered = reorderSectionScores(
      normalized.section_scores,
      built.strategicSectionKeys,
    );
    if (reordered.length !== built.strategicSectionKeys.length) {
      throw new Error("section_scores no cubre todas las secciones requeridas.");
    }

    const finalPayload = {
      ...normalized,
      section_scores: reordered,
    };

    const cat = validateBrandDiagnosisAgainstCatalog(
      finalPayload,
      built.strategicSectionKeys,
    );
    if (!cat.ok) {
      throw new Error(cat.message);
    }

    const { error: deactivateErr } = await supabase
      .from("brand_evaluations")
      .update({ is_active: false, superseded_at: new Date().toISOString() })
      .eq("brand_id", brandId)
      .eq("is_active", true);

    if (deactivateErr) {
      throw new Error(deactivateErr.message);
    }

    const snapshotFinal = {
      ...built.sourceSnapshot,
      model_used,
      evaluation_run_id: runId,
    };

    const { data: updated, error: updErr } = await supabase
      .from("brand_evaluations")
      .update({
        status: "succeeded",
        is_active: true,
        overall_score: finalPayload.overall_score,
        quality_level: finalPayload.quality_level,
        strategic_reading: finalPayload.strategic_reading,
        diagnosis_payload: finalPayload as unknown as Record<string, unknown>,
        section_scores: finalPayload.section_scores as unknown[],
        critical_gaps: finalPayload.critical_gaps as unknown[],
        contradictions: finalPayload.contradictions as unknown[],
        improvement_plan: finalPayload.improvement_plan as unknown[],
        next_recommended_action: finalPayload.next_recommended_action,
        source_snapshot: snapshotFinal,
        model_used,
        prompt_version: BRAND_DIAGNOSIS_PROMPT_VERSION,
        error_message: null,
      })
      .eq("id", runId)
      .select("*")
      .single();

    if (updErr || !updated) {
      throw new Error(updErr?.message ?? "No se pudo guardar el diagnóstico.");
    }

    return NextResponse.json({
      evaluation: updated as BrandEvaluationRow,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar el diagnóstico.";
    await supabase
      .from("brand_evaluations")
      .update({
        status: "failed",
        error_message: msg,
        is_active: false,
      })
      .eq("id", runId);

    return NextResponse.json({ error: msg, code: "diagnosis_failed" }, { status: 500 });
  }
}
