import { NextResponse } from "next/server";
import { getAuthenticatedSupabase, jsonUnauthorized } from "@/lib/api/route-auth";
import {
  buildBrandSectionImprovementContext,
  normalizeDiagnosisSectionForImprovement,
  type BrandSectionImprovementContextBrand,
} from "@/lib/brands/build-brand-section-improvement-context";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";
import type { BrandDiagnosisSectionScoreParsed } from "@/lib/schemas/brand-diagnosis";
import type { BrandEvaluationRow, BrandImprovementSessionRow, BrandSectionImprovementRow } from "@/types/database";

export const runtime = "nodejs";

type Params = { params: Promise<{ brandId: string; sectionKey: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId, sectionKey: rawKey } = await params;
  const sectionKey = decodeURIComponent(rawKey);

  const { data: brand, error: bErr } = await supabase
    .from("brands")
    .select("id, name, description, website_url, country_or_market, brand_status")
    .eq("id", brandId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (bErr || !brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { count: pendingReview } = await supabase
    .from("brand_source_facts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("status", "pending_review");

  const { data: evaluation } = await supabase
    .from("brand_evaluations")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .eq("status", "succeeded")
    .maybeSingle();

  const built = await buildBrandSectionImprovementContext(
    supabase,
    brandId,
    sectionKey,
    brand as BrandSectionImprovementContextBrand,
  );

  let diagnosis_section: BrandDiagnosisSectionScoreParsed | null = null;
  if (evaluation) {
    const ev = evaluation as BrandEvaluationRow;
    const scores = (ev.section_scores ?? []) as BrandDiagnosisSectionScoreParsed[];
    diagnosis_section = normalizeDiagnosisSectionForImprovement(
      scores.find((s) => s.section_key === sectionKey) ?? null,
    );
  }

  const { data: openSession } = await supabase
    .from("brand_improvement_sessions")
    .select("*")
    .eq("brand_id", brandId)
    .eq("section_key", sectionKey)
    .in("status", ["open", "draft_ready"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: activeImprovement } = await supabase
    .from("brand_section_improvements")
    .select("*")
    .eq("brand_id", brandId)
    .eq("section_key", sectionKey)
    .eq("status", "approved")
    .eq("is_active", true)
    .maybeSingle();

  return NextResponse.json({
    section_key: sectionKey,
    section_label: brandQuestionnaireSectionLabelEs(sectionKey),
    pending_review_count: pendingReview ?? 0,
    has_active_diagnosis: Boolean(evaluation),
    context_ok: built.ok,
    context_error: built.ok ? null : { code: built.code, message: built.message },
    diagnosis_section,
    active_improvement: (activeImprovement ?? null) as BrandSectionImprovementRow | null,
    open_session: (openSession ?? null) as BrandImprovementSessionRow | null,
    improvement_context: built.ok ? built.context : null,
  });
}
