import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { limbiOutlineButtonClass, limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", "bg-transparent")}>
      <header className="border-b border-limbi-border/90 bg-limbi-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8 sm:px-6 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
            Plataforma Límbica digital
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-limbi-text sm:text-4xl">
            Mi Limbi
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-limbi-muted">
            Tu espacio para crear Sistemas Límbicos digitales: bases narrativas,
            estratégicas y emocionales que ayudan a la IA a generar contenidos más
            humanos, coherentes y efectivos.
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="flex h-full min-h-[12rem] flex-col rounded-[22px] border-limbi-border bg-limbi-surface shadow-limbi transition-all duration-200 hover:-translate-y-px hover:shadow-limbi-hover">
            <CardHeader className="space-y-2 pb-2">
              <CardTitle className="font-heading text-lg text-limbi-text">
                Mis Sistemas
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed text-limbi-muted">
                Entra a tus Sistemas Límbicos digitales y continúa construyendo su
                memoria narrativa.
              </CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto border-0 pt-2">
              <Button asChild className={cn("w-full gap-2 sm:w-auto", limbiPrimaryButtonClass)}>
                <Link href="/projects">Mis Sistemas</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="flex h-full min-h-[12rem] flex-col rounded-[22px] border-limbi-border bg-limbi-surface shadow-limbi transition-all duration-200 hover:-translate-y-px hover:shadow-limbi-hover">
            <CardHeader className="space-y-2 pb-2">
              <CardTitle className="font-heading text-lg text-limbi-text">
                Nuevo sistema
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed text-limbi-muted">
                Crea una nueva base narrativa, estratégica y emocional para una
                marca, proyecto o comunicación.
              </CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto border-0 pt-2">
              <Button asChild variant="outline" className={cn("w-full sm:w-auto", limbiOutlineButtonClass)}>
                <Link href="/projects/new">Nuevo sistema</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="flex h-full min-h-[12rem] flex-col rounded-[22px] border-limbi-border bg-limbi-surface shadow-limbi transition-all duration-200 hover:-translate-y-px hover:shadow-limbi-hover sm:col-span-2 lg:col-span-1">
            <CardHeader className="space-y-2 pb-2">
              <CardTitle className="font-heading text-lg text-limbi-text">
                Cómo funciona Limbi
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed text-limbi-muted">
                Primero alimentas el sistema, luego apruebas el Marco Estratégico
                Límbico y finalmente creas piezas narrativas.
              </CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto border-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="w-full cursor-not-allowed rounded-xl opacity-70 sm:w-auto"
              >
                Próximamente
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
