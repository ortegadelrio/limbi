import { redirect } from "next/navigation";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";
import {
  SystemContextHeader,
  SystemContextHeaderLink,
} from "@/components/projects/system-context-header";
import { getProjectDisplayName } from "@/lib/projects/server-project-display-name";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const resolvedName = await getProjectDisplayName(projectId);
  const nameForCrumb = resolvedName?.trim() || "Sistema";
  const title = resolvedName?.trim()
    ? `Sistema Límbico de ${resolvedName.trim()}`
    : "Sistema Límbico";

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-transparent">
      <SystemContextHeader
        breadcrumb={[
          { label: "Mis Sistemas", href: "/projects" },
          { label: nameForCrumb, href: `/projects/${projectId}` },
          { label: "Resumen" },
        ]}
        eyebrow="Sistema Límbico"
        title={title}
        sectionLabel="Resumen"
        description="Este sistema guarda la memoria narrativa de tu proyecto: su reto, intención, marco estratégico y piezas."
        actions={
          <SystemContextHeaderLink href="/projects">Mis Sistemas</SystemContextHeaderLink>
        }
      />
      <ProjectDetailClient projectId={projectId} />
    </main>
  );
}
