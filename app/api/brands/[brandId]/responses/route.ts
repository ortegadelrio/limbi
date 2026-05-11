import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { answerTextFromValidatedValue } from "@/lib/brand-answers/answer-text-from-value";
import { validateAnswerValueForType } from "@/lib/brand-answers/validate-answer-value";
import { fetchAllowedBrandQuestionDefinitions } from "@/lib/questions/fetch-allowed-brand-questions";
import { patchBrandResponsesBodySchema } from "@/lib/schemas/brand-responses";
import type {
  BrandOfferNature,
  BrandResponseAnswerType,
  BrandResponseRow,
  QuestionDefinitionRow,
} from "@/types/database";

type Params = { params: Promise<{ brandId: string }> };

async function loadOwnedBrand(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  userId: string,
  brandId: string,
) {
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();

  return { brand: data, error };
}

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;

  const { brand, error: brandError } = await loadOwnedBrand(
    supabase,
    user.id,
    brandId,
  );
  if (brandError) {
    return NextResponse.json({ error: brandError.message }, { status: 500 });
  }
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("brand_offer_profiles")
    .select("offer_nature")
    .eq("brand_id", brandId)
    .maybeSingle();

  const offerNature = profile?.offer_nature ?? null;

  const { data: responses, error: responsesError } = await supabase
    .from("brand_responses")
    .select(
      "id, brand_id, question_definition_id, section_key, module_key, question_key, answer_value, answer_text, answer_type, is_required, is_sensitive, source_type, created_at, updated_at",
    )
    .eq("brand_id", brandId);

  if (responsesError) {
    return NextResponse.json({ error: responsesError.message }, { status: 500 });
  }

  let ordered = responses ?? [];
  if (offerNature) {
    const { rows: defs, error: defErr } =
      await fetchAllowedBrandQuestionDefinitions(
        supabase,
        offerNature as BrandOfferNature,
      );
    if (defErr) {
      return NextResponse.json({ error: defErr.message }, { status: 500 });
    }
    const orderMap = new Map(defs.map((d) => [d.question_key, d.display_order]));
    ordered = [...ordered].sort(
      (a, b) =>
        (orderMap.get(a.question_key) ?? 9999) -
        (orderMap.get(b.question_key) ?? 9999),
    );
  } else {
    ordered = [...ordered].sort(
      (a, b) =>
        a.section_key.localeCompare(b.section_key) ||
        a.question_key.localeCompare(b.question_key),
    );
  }

  return NextResponse.json({ responses: ordered as BrandResponseRow[] });
}

export async function PATCH(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;

  const { brand, error: brandError } = await loadOwnedBrand(
    supabase,
    user.id,
    brandId,
  );
  if (brandError) {
    return NextResponse.json({ error: brandError.message }, { status: 500 });
  }
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("brand_offer_profiles")
    .select("offer_nature")
    .eq("brand_id", brandId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile?.offer_nature) {
    return jsonBadRequest(
      "Esta marca necesita una naturaleza de oferta antes de guardar respuestas.",
    );
  }

  const offerNature = profile.offer_nature as BrandOfferNature;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = patchBrandResponsesBodySchema.safeParse(body);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
      parsed.error.message;
    return jsonBadRequest(first);
  }

  const { rows: allowedDefs, error: allowedErr } =
    await fetchAllowedBrandQuestionDefinitions(supabase, offerNature);
  if (allowedErr) {
    return NextResponse.json({ error: allowedErr.message }, { status: 500 });
  }

  const byDefinitionId = new Map<string, QuestionDefinitionRow>(
    allowedDefs.map((r) => [r.id, r]),
  );

  const upsertRows: Record<string, unknown>[] = [];

  for (const item of parsed.data.answers) {
    const def = byDefinitionId.get(item.question_definition_id);
    if (!def) {
      return jsonBadRequest(
        "Una o más preguntas no aplican a esta marca o no están activas.",
      );
    }

    const answerType = def.answer_type as BrandResponseAnswerType;
    const validated = validateAnswerValueForType(item.answer_value, answerType);
    if (!validated.ok) {
      return jsonBadRequest(
        `${def.question_key}: ${validated.message}`,
      );
    }

    const answer_text = answerTextFromValidatedValue(validated.value);

    upsertRows.push({
      brand_id: brandId,
      question_definition_id: def.id,
      section_key: def.section_key,
      module_key: def.module_key,
      question_key: def.question_key,
      answer_value: validated.value,
      answer_text,
      answer_type: def.answer_type,
      is_required: def.is_required,
      is_sensitive: def.is_sensitive,
      source_type: "questionnaire",
    });
  }

  const { error: upsertError } = await supabase.from("brand_responses").upsert(
    upsertRows,
    { onConflict: "brand_id,question_key" },
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: upsertRows.length });
}
