import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Actualiza la fila `brands` sin cambiar datos de negocio, para que el trigger
 * `brands_set_updated_at` avance `updated_at`. Se usa tras guardar oferta estructurada
 * o territorios (incluido borrado total) y así `fetchStructuralQuestionnaireStaleness`
 * puede marcar el diagnóstico activo como desactualizado aunque no queden filas hijas.
 */
export async function touchBrandRowUpdatedAtForQuestionnaireStructure(
  supabase: SupabaseClient,
  brandId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error: selErr } = await supabase
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .maybeSingle();

  if (selErr) {
    return { ok: false, message: selErr.message };
  }
  if (!data) {
    return { ok: false, message: "Marca no encontrada." };
  }

  const { error: updErr } = await supabase
    .from("brands")
    .update({ name: data.name })
    .eq("id", brandId);

  if (updErr) {
    return { ok: false, message: updErr.message };
  }

  return { ok: true };
}
