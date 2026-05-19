import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ brandId: string }> };

/** Ruta legacy: el hub de conocimiento se retiró; la edición vive en el cuestionario. */
export default async function BrandKnowledgeLegacyRedirectPage({ params }: Props) {
  const { brandId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  redirect(`/brands/${brandId}/questionnaire`);
}
