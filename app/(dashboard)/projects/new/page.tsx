import { Suspense } from "react";
import { redirect } from "next/navigation";
import { NewProjectWizard } from "@/components/onboarding/new-project-wizard";
import {
  SystemContextHeader,
  SystemContextHeaderLink,
} from "@/components/projects/system-context-header";
import { limbiLoadingMessage } from "@/components/projects/limbi-ui";
import { getProjectDisplayName } from "@/lib/projects/server-project-display-name";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ projectId?: string }>;
};

export default async function NewProjectPage({ searchParams }: Props) {
  const sp = await searchParams;
  const projectId =
    typeof sp.projectId === "string" && sp.projectId.trim().length > 0
      ? sp.projectId.trim()
      : null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const displayName = projectId
    ? ((await getProjectDisplayName(projectId)) ?? null)
    : null;

  const isEditing = projectId !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      {isEditing && displayName ? (
        <SystemContextHeader
          breadcrumb={[
            { label: "Mis Sistemas", href: "/projects" },
            { label: displayName, href: `/projects/${projectId}` },
            { label: "Construcción del sistema" },
          ]}
          eyebrow="Construcción del sistema"
          title={`Sistema Límbico de ${displayName}`}
          description="Tus respuestas alimentan la memoria narrativa del sistema."
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
      ) : isEditing ? (
        <SystemContextHeader
          breadcrumb={[
            { label: "Mis Sistemas", href: "/projects" },
            { label: "Sistema", href: `/projects/${projectId}` },
            { label: "Construcción del sistema" },
          ]}
          eyebrow="Construcción del sistema"
          title="Sistema Límbico"
          sectionLabel="Construcción del sistema"
          description="Tus respuestas alimentan la memoria narrativa del sistema."
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
      ) : (
        <SystemContextHeader
          breadcrumb={[
            { label: "Mis Sistemas", href: "/projects" },
            { label: "Nuevo sistema" },
          ]}
          eyebrow="Construcción del sistema"
          title="Nuevo Sistema Límbico"
          description="Empieza a construir la memoria narrativa de una marca, proyecto o comunicación."
          actions={
            <SystemContextHeaderLink href="/projects">
              Mis Sistemas
            </SystemContextHeaderLink>
          }
        />
      )}

      <Suspense
        fallback={
          <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-20 sm:px-6">
            <p className="text-sm text-stone-600 dark:text-stone-400">
              {limbiLoadingMessage("wizard-suspense")}
            </p>
          </div>
        }
      >
        <NewProjectWizard />
      </Suspense>
    </div>
  );
}
