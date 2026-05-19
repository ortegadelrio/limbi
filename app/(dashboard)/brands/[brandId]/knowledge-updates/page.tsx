import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ brandId: string }> };

/** Ruta legacy: actualizaciones de conocimiento fuera del journey principal. */
export default async function BrandKnowledgeUpdatesLegacyRedirectPage({ params }: Props) {
  const { brandId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  redirect(`/brands/${brandId}/questionnaire`);
}
