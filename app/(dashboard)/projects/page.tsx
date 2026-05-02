import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectsList } from "@/components/projects/projects-list";
import { limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      <header className="border-b border-limbi-border/90 bg-limbi-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-8">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
              Limbi · Plataforma Límbica digital
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-limbi-text sm:text-4xl">
              Sistemas Límbicos
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-limbi-muted sm:text-base">
              Cada sistema guarda la base narrativa, emocional y estratégica de
              una marca, proyecto o comunicación.
            </p>
          </div>
          <Button
            asChild
            className={cn("h-11 shrink-0 gap-2 self-start sm:self-auto", limbiPrimaryButtonClass)}
          >
            <Link href="/projects/new">
              <Plus className="size-4" aria-hidden />
              Crear Sistema Límbico
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <ProjectsList />
      </div>
    </div>
  );
}
