import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import {
  BRAND_SECTION_IMPROVE_PROMPT_VERSION,
  brandSectionImproveApproveBodySchema,
  brandSectionImproveTurnOutputSchema,
} from "@/lib/schemas/brand-section-improvement";
import type { BrandDiagnosisSectionScoreParsed } from "@/lib/schemas/brand-diagnosis";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";
import type { BrandEvaluationRow, BrandImprovementSessionRow, BrandSectionImprovementRow } from "@/types/database";

type Params = { params: Promise<{ brandId: string; sessionId: string }> };

function jsonConflict(message: string, code: string) {
  return NextResponse.json({ error: message, code }, { status: 409 });
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

function aggregateConfidenceFromChanges(
  changes: { confidence: string }[],
): "low" | "medium" | "high" {
  if (changes.length === 0) return "medium";
  if (changes.some((c) => c.confidence === "low")) return "low";
  if (changes.every((c) => c.confidence === "high")) return "high";
  return "medium";
}

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId, sessionId } = await params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = brandSectionImproveApproveBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { data: sessionRow, error: sErr } = await supabase
    .from("brand_improvement_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (sErr || !sessionRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = sessionRow as BrandImprovementSessionRow;

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if ((await countPendingReview(supabase, brandId)) > 0) {
    return jsonConflict(
      "Hay hallazgos pendientes de revisión. Revísalos antes de aprobar una mejora.",
      "pending_review_blocking",
    );
  }

  if (session.status !== "open" && session.status !== "draft_ready") {
    return NextResponse.json(
      {
        error: "Solo se puede aprobar desde una sesión abierta o con borrador listo.",
        code: "invalid_session_state",
      },
      { status: 409 },
    );
  }

  const draft = session.draft_payload as Record<string, unknown>;
  const z = brandSectionImproveTurnOutputSchema.safeParse(draft);
  if (!z.success || z.data.proposed_changes.length === 0) {
    return NextResponse.json(
      {
        error:
          "No hay un borrador estructurado con propuestas. Sigue la conversación hasta obtener un draft listo.",
        code: "no_draft_to_approve",
      },
      { status: 400 },
    );
  }

  const { data: evaluation } = await supabase
    .from("brand_evaluations")
    .select("section_scores, prompt_version")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .eq("status", "succeeded")
    .maybeSingle();

  const sectionScores = ((evaluation as BrandEvaluationRow | null)?.section_scores ??
    []) as BrandDiagnosisSectionScoreParsed[];
  const diagnosisSection =
    sectionScores.find((s) => s.section_key === session.section_key) ?? null;

  const sectionLabel = brandQuestionnaireSectionLabelEs(session.section_key);
  const improvement_summary = z.data.assistant_message.trim().slice(0, 1200);
  const what_changed = z.data.proposed_changes.map(
    (p) => `${p.question_key}: ${p.proposed_improved_text.trim().slice(0, 280)}`,
  );
  const strategic_rationale = z.data.proposed_changes
    .map((p) => p.rationale.trim())
    .join("\n\n")
    .slice(0, 8000);
  const confidence_level = aggregateConfidenceFromChanges(z.data.proposed_changes);
  const contradictionsCount = diagnosisSection?.contradictions?.length ?? 0;
  const should_mark_as_ready_for_consolidation = Boolean(
    diagnosisSection &&
      diagnosisSection.score >= 80 &&
      contradictionsCount === 0 &&
      z.data.remaining_gaps.length === 0,
  );

  const payload = {
    proposed_changes: z.data.proposed_changes,
    remaining_gaps: z.data.remaining_gaps,
    conversation_state: z.data.conversation_state,
    assistant_message: z.data.assistant_message,
    suggested_next_step_for_user: z.data.suggested_next_step_for_user,
    prompt_version: BRAND_SECTION_IMPROVE_PROMPT_VERSION,
    section_key: session.section_key,
    section_label: sectionLabel,
    improvement_summary,
    proposed_section_improvement: z.data,
    what_changed,
    strategic_rationale,
    source_trace: [
      "brand_questionnaire_active_catalog",
      "brand_diagnosis_active_section",
      "approved_source_facts",
      "structured_offer_items",
      "structured_audience_territories",
    ],
    unresolved_questions: z.data.remaining_gaps,
    confidence_level,
    should_mark_as_ready_for_consolidation,
    diagnosis_prompt_version_at_approval:
      (evaluation as BrandEvaluationRow | null)?.prompt_version ?? null,
  };

  const now = new Date().toISOString();

  const { error: supErr } = await supabase
    .from("brand_section_improvements")
    .update({ status: "superseded", is_active: false, superseded_at: now })
    .eq("brand_id", brandId)
    .eq("section_key", session.section_key)
    .eq("status", "approved")
    .eq("is_active", true);

  if (supErr) {
    return NextResponse.json({ error: supErr.message }, { status: 500 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("brand_section_improvements")
    .insert({
      brand_id: brandId,
      section_key: session.section_key,
      session_id: sessionId,
      status: "approved",
      is_active: true,
      payload,
      approved_at: now,
    })
    .select("*")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: insErr?.message ?? "No se pudo guardar la mejora aprobada." },
      { status: 500 },
    );
  }

  const { error: sessErr } = await supabase
    .from("brand_improvement_sessions")
    .update({
      status: "approved",
      closed_reason: "user_approved",
    })
    .eq("id", sessionId);

  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }

  await supabase.from("brands").update({ updated_at: now }).eq("id", brandId);

  return NextResponse.json({
    improvement: inserted as BrandSectionImprovementRow,
  });
}
