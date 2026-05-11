import { redirect } from "next/navigation";
import { BrandQuestionnaireShell } from "@/components/brands/questionnaire/brand-questionnaire-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ brandId: string }> };

export default async function BrandQuestionnairePage({ params }: Props) {
  const { brandId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <BrandQuestionnaireShell brandId={brandId} />;
}
