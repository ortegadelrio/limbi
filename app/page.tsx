import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  limbiDocumentCardClass,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Limbi",
  description:
    "Crea contenidos de marketing y comunicación con IA desde una base estratégica, emocional y narrativa.",
};

const featureBlocks = [
  {
    title: "Una base antes del contenido",
    description:
      "Cada proyecto tiene su Sistema Límbico: contexto, audiencia, tono, propósito, evidencias y señales sensibles organizados para que la IA trabaje con criterio, no a ciegas.",
  },
  {
    title: "Piezas para marketing y comunicación",
    description:
      "Genera textos alineados con tu marca: pitches, captions, ideas de contenido y frases con intención estratégica, pensados para campañas, redes y piezas de comunicación.",
  },
  {
    title: "Flujo con intención",
    description:
      "Avanzas por lectura del sistema, marco estratégico y piezas narrativas. La IA produce a partir de lo que ya definiste, con coherencia y tono acordes al proyecto.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-14 px-6 py-16 sm:py-20">
      <header className="space-y-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-limbi-text sm:text-4xl">
          Bienvenido a Limbi
        </h1>
        <p className="text-lg font-medium leading-snug text-limbi-text sm:text-xl">
          Crea contenidos de marketing con IA desde una base estratégica,
          emocional y narrativa.
        </p>
        <div className="space-y-4 text-base leading-relaxed text-limbi-muted sm:text-[17px]">
          <p>
            Limbi construye un Sistema Límbico digital para cada proyecto: una
            base de conocimiento que reúne información, contexto, audiencia,
            tono, propósito, evidencias y señales sensibles.
          </p>
          <p>
            Así, la IA no genera desde cero ni responde con textos genéricos.
            Produce piezas más coherentes, más humanas y mejor alineadas con
            lo que tu marca necesita comunicar.
          </p>
        </div>
        <p className="text-base font-semibold text-limbi-text sm:text-lg">
          Primero construyes el sistema. Después produces con más sentido.
        </p>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
          <Button
            asChild
            size="lg"
            className={cn("h-11 px-6", limbiPrimaryButtonClass)}
          >
            <Link href="/signup">Crear cuenta</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className={cn("h-11 px-6", limbiOutlineButtonClass)}
          >
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </header>

      <section
        className="grid gap-5 sm:grid-cols-3"
        aria-label="Cómo te ayuda Limbi con marketing y comunicación"
      >
        {featureBlocks.map((block) => (
          <article
            key={block.title}
            className={cn(
              limbiDocumentCardClass,
              "flex flex-col gap-2 p-5 sm:p-6",
            )}
          >
            <h3 className="font-heading text-base font-semibold text-limbi-text">
              {block.title}
            </h3>
            <p className="text-sm leading-relaxed text-limbi-muted">
              {block.description}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
