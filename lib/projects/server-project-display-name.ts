import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Nombre visible del proyecto para cabeceras (RSC). RLS limita al usuario autenticado. */
export async function getProjectDisplayName(
  projectId: string,
): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("name_or_descriptor")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) return null;
  const n = typeof data.name_or_descriptor === "string" ? data.name_or_descriptor.trim() : "";
  return n.length > 0 ? n : null;
}
