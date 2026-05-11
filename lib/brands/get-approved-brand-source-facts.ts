import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandSourceFactRow } from "@/types/database";

/**
 * Solo facts aprobados: fuente curada para diagnóstico / bases futuras.
 * No usar como “contexto curado” helpers que mezclen otros estados.
 */
export async function getApprovedBrandSourceFacts(
  supabase: SupabaseClient,
  brandId: string,
): Promise<{ facts: BrandSourceFactRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("brand_source_facts")
    .select("*")
    .eq("brand_id", brandId)
    .eq("status", "approved")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { facts: [], error: new Error(error.message) };
  }
  return { facts: (data ?? []) as BrandSourceFactRow[], error: null };
}
