import { redirect } from "next/navigation";
import { ContentPageClient } from "@/components/projects/content-page-client";
import {
  SystemContextHeader,
  SystemContextHeaderLink,
} from "@/components/projects/system-context-header";
import { getProjectDisplayName } from "@/lib/projects/server-project-display-name";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectContentPage({ params }: Props) {
  const { projectId } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const displayName = (await getProjectDisplayName(projectId)) ?? "Sistema";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      <SystemContextHeader
        breadcrumb={[
          { label: "Mis Sistemas", href: "/projects" },
          { label: displayName, href: `/projects/${projectId}` },
          { label: "Piezas narrativas" },
        ]}
        eyebrow="Sistema Límbico"
        title={displayName}
        sectionLabel="Piezas narrativas"
        description="Crea, revisa y afina piezas desde el Marco Estratégico Límbico aprobado. No nacen de una instrucción suelta: nacen de la memoria narrativa del sistema."
        actions={
          <SystemContextHeaderLink href={`/projects/${projectId}`}>
            Volver al sistema
          </SystemContextHeaderLink>
        }
      />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <ContentPageClient projectId={projectId} />
      </div>
    </div>
  );
}
