import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import {
  serializeBrandAnswer,
  parseBrandAnswer,
} from "@/lib/brand-answers/serialize-parse";
import { validateAnswerValueForType } from "@/lib/brand-answers/validate-answer-value";
import { buildBrandFieldImprovementContext } from "@/lib/brands/build-brand-field-improvement-context";
import type { BrandSectionImprovementContextBrand } from "@/lib/brands/build-brand-section-improvement-context";
import { canShowLimbiFieldImprove } from "@/lib/brands/brand-field-improve-eligibility";
import { fetchBrandDashboardDiagnosisState } from "@/lib/brands/fetch-brand-dashboard-diagnosis-state";
import { loadBrandBasesDetailState } from "@/lib/brands/load-brand-bases-state";
import { generateBrandFieldImproveTurnJson } from "@/lib/openai/brand-field-improvement";
import {
  buildBrandFieldImprovementSystemInstructions,
  buildBrandFieldImprovementUserPayload,
} from "@/lib/prompts/brand-field-improvement";
import {
  brandFieldImproveApplyBodySchema,
  brandFieldImproveCoachBodySchema,
  brandFieldImproveTurnOutputSchema,
  BRAND_FIELD_IMPROVE_PROMPT_VERSION,
} from "@/lib/schemas/brand-field-improvement";
import type { BrandResponseAnswerType } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_CONVERSATION_EXCERPT_LEN = 12000;

type Params = { params: Promise<{ brandId: string; questionKey: string }> };

function jsonConflict(message: string, code: string) {
  return NextResponse.json({ error: message, code }, { status: 409 });
}

async function loadOwnedBrand(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  userId: string,
  brandId: string,
): Promise<BrandSectionImprovementContextBrand | null> {
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, description, website_url, country_or_market, brand_status")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as BrandSectionImprovementContextBrand;
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

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId, questionKey: rawKey } = await params;
  const questionKey = decodeURIComponent(rawKey);
  const brand = await loadOwnedBrand(supabase, user.id, brandId);
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const diagnosisState = await fetchBrandDashboardDiagnosisState(supabase, brandId);
  const built = await buildBrandFieldImprovementContext(
    supabase,
    brandId,
    questionKey,
    brand,
  );

  const answerType = built.ok ? built.definition.answer_type : "";
  const sectionKey = built.ok ? built.definition.section_key : "";

  return NextResponse.json({
    question_key: questionKey,
    has_active_diagnosis: diagnosisState.hasActiveDiagnosis,
    can_improve_field: built.ok
      ? canShowLimbiFieldImprove({
          hasActiveDiagnosis: diagnosisState.hasActiveDiagnosis,
          answerType,
          sectionKey,
        })
      : false,
    context_ok: built.ok,
    context_error: built.ok ? null : { code: built.code, message: built.message },
    field_improvement_context: built.ok ? built.context : null,
    pending_review_count: await countPendingReview(supabase, brandId),
  });
}

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId, questionKey: rawKey } = await params;
  const questionKey = decodeURIComponent(rawKey);
  const brand = await loadOwnedBrand(supabase, user.id, brandId);
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if ((await countPendingReview(supabase, brandId)) > 0) {
    return jsonConflict(
      "Hay hallazgos pendientes de revisión. Revísalos antes de continuar.",
      "pending_review_blocking",
    );
  }

  const diagnosisState = await fetchBrandDashboardDiagnosisState(supabase, brandId);
  if (!diagnosisState.hasActiveDiagnosis) {
    return jsonConflict(
      "Necesitas un diagnóstico activo antes de usar «Mejorar con Limbi».",
      "diagnosis_required",
    );
  }

  const built = await buildBrandFieldImprovementContext(
    supabase,
    brandId,
    questionKey,
    brand,
  );
  if (!built.ok) {
    return NextResponse.json(
      { error: built.message, code: built.code },
      { status: built.code === "diagnosis_required" ? 409 : 400 },
    );
  }

  if (
    !canShowLimbiFieldImprove({
      hasActiveDiagnosis: true,
      answerType: built.definition.answer_type,
      sectionKey: built.definition.section_key,
    })
  ) {
    return jsonBadRequest("Esta pregunta no admite mejora asistida por campo.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonBadRequest("JSON inválido.");
  }

  const parsedBody = brandFieldImproveCoachBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonBadRequest(parsedBody.error.message);
  }

  const excerpt = parsedBody.data.conversation_excerpt?.trim().slice(
    0,
    MAX_CONVERSATION_EXCERPT_LEN,
  );

  const system = buildBrandFieldImprovementSystemInstructions();
  const userPayload = buildBrandFieldImprovementUserPayload({
    field_improvement_context: built.context,
    conversation_excerpt: excerpt
      ? `${excerpt}\n\nUSER_MESSAGE:\n${parsedBody.data.user_message}`
      : parsedBody.data.user_message,
  });

  let ai: Awaited<ReturnType<typeof generateBrandFieldImproveTurnJson>>;
  try {
    ai = await generateBrandFieldImproveTurnJson({ system, user: userPayload });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al consultar el modelo.";
    return NextResponse.json({ error: message, code: "openai_error" }, { status: 502 });
  }

  let turnJson: unknown;
  try {
    turnJson = JSON.parse(ai.raw_json_text);
  } catch {
    return NextResponse.json(
      { error: "Respuesta del modelo inválida.", code: "invalid_model_json" },
      { status: 502 },
    );
  }

  const parsedTurn = brandFieldImproveTurnOutputSchema.safeParse(turnJson);
  if (!parsedTurn.success) {
    return NextResponse.json(
      {
        error: "El modelo no devolvió un formato válido.",
        code: "schema_validation_failed",
        details: parsedTurn.error.flatten(),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    prompt_version: BRAND_FIELD_IMPROVE_PROMPT_VERSION,
    model_used: ai.model_used,
    turn: parsedTurn.data,
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId, questionKey: rawKey } = await params;
  const questionKey = decodeURIComponent(rawKey);
  const brand = await loadOwnedBrand(supabase, user.id, brandId);
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const diagnosisState = await fetchBrandDashboardDiagnosisState(supabase, brandId);
  if (!diagnosisState.hasActiveDiagnosis) {
    return jsonConflict(
      "Necesitas un diagnóstico activo antes de aplicar una mejora.",
      "diagnosis_required",
    );
  }

  const built = await buildBrandFieldImprovementContext(
    supabase,
    brandId,
    questionKey,
    brand,
  );
  if (!built.ok) {
    return NextResponse.json(
      { error: built.message, code: built.code },
      { status: 400 },
    );
  }

  const def = built.definition;
  if (
    !canShowLimbiFieldImprove({
      hasActiveDiagnosis: true,
      answerType: def.answer_type,
      sectionKey: def.section_key,
    })
  ) {
    return jsonBadRequest("Esta pregunta no admite mejora asistida por campo.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonBadRequest("JSON inválido.");
  }

  const parsedBody = brandFieldImproveApplyBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonBadRequest(parsedBody.error.message);
  }

  const answerType = def.answer_type as BrandResponseAnswerType;
  const draft = parseBrandAnswer(answerType, { text: parsedBody.data.proposed_answer_text });
  const validated = validateAnswerValueForType(
    { text: parsedBody.data.proposed_answer_text },
    answerType,
  );
  if (!validated.ok) {
    return jsonBadRequest(validated.message);
  }

  const serialized = serializeBrandAnswer(answerType, draft, def.options);
  if ("error" in serialized) {
    return jsonBadRequest(serialized.error);
  }

  const { error: upsertError } = await supabase.from("brand_responses").upsert(
    {
      brand_id: brandId,
      question_definition_id: def.id,
      section_key: def.section_key,
      module_key: def.module_key,
      question_key: def.question_key,
      answer_value: serialized.answer_value,
      answer_text: serialized.answer_text,
      answer_type: def.answer_type,
      is_required: def.is_required,
      is_sensitive: def.is_sensitive,
      source_type: "questionnaire",
    },
    { onConflict: "brand_id,question_key" },
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const { error: brandTouchErr } = await supabase
    .from("brands")
    .update({ updated_at: nowIso })
    .eq("id", brandId);
  if (brandTouchErr) {
    return NextResponse.json({ error: brandTouchErr.message }, { status: 500 });
  }

  const bases = await loadBrandBasesDetailState(supabase, brandId);
  const diagnosisAfter = await fetchBrandDashboardDiagnosisState(supabase, brandId);
  const hasActiveBases = Boolean(bases.knowledge_base && bases.limbic_base);

  return NextResponse.json({
    ok: true,
    question_key: questionKey,
    answer_text: serialized.answer_text,
    answer_value: serialized.answer_value,
    diagnosis_is_stale: diagnosisAfter.diagnosisIsStale,
    has_active_bases: hasActiveBases,
    bases_stale: bases.knowledge_base_is_stale || bases.limbic_base_is_stale,
    knowledge_base_is_stale: bases.knowledge_base_is_stale,
    limbic_base_is_stale: bases.limbic_base_is_stale,
  });
}
