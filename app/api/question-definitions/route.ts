import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { brandQuestionDefinitionsForOfferNature } from "@/lib/questions/get-brand-question-definitions";
import { questionDefinitionsQuerySchema } from "@/lib/schemas/question-definition";
import type { QuestionDefinitionRow } from "@/types/database";

export async function GET(request: Request) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { searchParams } = new URL(request.url);
  const parsed = questionDefinitionsQuerySchema.safeParse({
    journey_type: searchParams.get("journey_type") ?? undefined,
    offer_nature: searchParams.get("offer_nature") ?? undefined,
  });

  if (!parsed.success) {
    const first =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
      parsed.error.message;
    return jsonBadRequest(first);
  }

  const { journey_type, offer_nature } = parsed.data;

  const { data, error } = await supabase
    .from("question_definitions")
    .select(
      "id, journey_type, section_key, module_key, question_key, question_text, help_text, answer_type, options, applies_to, is_required, is_sensitive, is_active, evaluation_weight, display_order, created_at, updated_at",
    )
    .eq("journey_type", journey_type)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as QuestionDefinitionRow[];
  const definitions = brandQuestionDefinitionsForOfferNature(
    rows,
    offer_nature,
  );

  return NextResponse.json({ definitions });
}
