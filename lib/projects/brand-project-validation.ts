import type { SupabaseClient } from "@supabase/supabase-js";

export async function isBrandOwnedByUser(
  supabase: SupabaseClient,
  brandId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}
