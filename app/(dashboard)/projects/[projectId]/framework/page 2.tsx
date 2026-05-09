import { redirect } from "next/navigation";
import { FrameworkPageClient } from "@/components/projects/framework-page-client";
import {
  SystemContextHeader,
  SystemContextHeaderLink,
} from "@/components/projects/system-context-header";
import { getProjectDisplayName } from "@/lib/projects/server-project-display-name";
import { getUserDisplayNameForExport } from "@/lib/projects/user-display-name";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectFrameworkPage({ params }: Props) {
  const { projectId } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const displayName = (await getProjectDisplayName(projectId)) ?? "Sistema";
  const userDisplayName = getUserDisplayNameForExport(user);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      <SystemContextHeader
        breadcrumb={[
          { label: "Mis Sistemas", href: "/projects" },
          { label: displayName, href: `/projects/${projectId}` },
          { label: "Marco Estratégico Límbico" },
        ]}
        eyebrow="Sistema Límbico"
        title={displayName}
        sectionLabel="Marco Estratégico Límbico"
        description="El marco que traduce la memoria del sistema en una dirección narrativa clara."
        actions={
          <>
            <SystemContextHeaderLink href={`/projects/${projectId}`}>
              Volver al sistema
            </SystemContextHeaderLink>
            <SystemContextHeaderLink href="/projects">
              Mis Sistemas
            </SystemContextHeaderLink>
          </>
        }
      />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <FrameworkPageClient
          projectId={projectId}
          projectDisplayName={displayName}
          userDisplayName={userDisplayName}
        />
      </div>
    </div>
  );
}
