import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandOfferNature, QuestionDefinitionRow } from "@/types/database";
import { brandQuestionDefinitionsForOfferNature } from "@/lib/questions/get-brand-question-definitions";

/** Definiciones activas del journey `brand` aplicables a la naturaleza de oferta. */
export async function fetchAllowedBrandQuestionDefinitions(
  supabase: SupabaseClient,
  offerNature: BrandOfferNature,
): Promise<{ rows: QuestionDefinitionRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("question_definitions")
    .select(
      "id, journey_type, section_key, module_key, question_key, question_text, help_text, answer_type, options, applies_to, is_required, is_sensitive, is_active, evaluation_weight, display_order, created_at, updated_at",
    )
    .eq("journey_type", "brand")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    return { rows: [], error: new Error(error.message) };
  }

  const rows = brandQuestionDefinitionsForOfferNature(
    (data ?? []) as QuestionDefinitionRow[],
    offerNature,
  );

  return { rows, error: null };
}
