import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrainstormSessionRow } from "@/types/database";

/**
 * Carga los payloads **profundos** (`consolidated_payload`) de las filas de base **congeladas**
 * en la sesión (`brand_*_id_used`). No usa `loadActiveBrandContextForProject` (que siempre lee la activa
 * actual) para respetar la versión fijada al crear la sesión.
 */
export async function loadFrozenBrandPayloadsForBrainstormSession(
  supabase: SupabaseClient,
  session: Pick<
    BrainstormSessionRow,
    "brand_id" | "brand_knowledge_base_id_used" | "brand_limbic_base_id_used"
  >,
  assertUserId: string,
): Promise<
  | {
      ok: true;
      knowledge_payload: Record<string, unknown> | null;
      limbic_payload: Record<string, unknown> | null;
    }
  | { ok: false; code: "forbidden" | "missing_base_rows" | "invalid_brand_scope"; message: string }
> {
  const { data: brand, error: bErr } = await supabase
    .from("brands")
    .select("id")
    .eq("id", session.brand_id)
    .eq("user_id", assertUserId)
    .maybeSingle();
  if (bErr || !brand) {
    return { ok: false, code: "forbidden", message: "Marca no accesible." };
  }

  const kid = session.brand_knowledge_base_id_used;
  const lid = session.brand_limbic_base_id_used;
  if (!kid || !lid) {
    return {
      ok: false,
      code: "missing_base_rows",
      message: "La sesión no tiene bases de marca congeladas.",
    };
  }

  const [{ data: kRow, error: kErr }, { data: lRow, error: lErr }] = await Promise.all([
    supabase
      .from("brand_knowledge_bases")
      .select("brand_id, consolidated_payload")
      .eq("id", kid)
      .maybeSingle(),
    supabase
      .from("brand_limbic_bases")
      .select("brand_id, consolidated_payload")
      .eq("id", lid)
      .maybeSingle(),
  ]);

  if (kErr || lErr || !kRow || !lRow) {
    return {
      ok: false,
      code: "missing_base_rows",
      message: "No se encontraron las bases de marca asociadas a esta sesión.",
    };
  }

  if (kRow.brand_id !== session.brand_id || lRow.brand_id !== session.brand_id) {
    return {
      ok: false,
      code: "invalid_brand_scope",
      message: "Las bases no corresponden a la marca de la sesión.",
    };
  }

  const kp = kRow.consolidated_payload;
  const lp = lRow.consolidated_payload;
  return {
    ok: true,
    knowledge_payload:
      kp && typeof kp === "object" && !Array.isArray(kp) ? (kp as Record<string, unknown>) : null,
    limbic_payload:
      lp && typeof lp === "object" && !Array.isArray(lp) ? (lp as Record<string, unknown>) : null,
  };
}
