import type { Metadata } from "next";
import { Check } from "lucide-react";
import { LimbiLogo } from "@/components/brand/limbi-logo";
import { AuthHomePanel } from "@/components/auth/auth-home-panel";

export const metadata: Metadata = {
  title: "Limbi",
  description:
    "Crea contenidos de marketing y comunicación con IA desde una base estratégica, emocional y narrativa.",
};

const microBenefits = [
  "Ordena la información clave de tu proyecto.",
  "Genera una Lectura Límbica estratégica.",
  "Produce pitches, captions, ideas y frases gráficas con más criterio.",
] as const;

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-transparent">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-10 sm:py-12 lg:grid-cols-2 lg:items-start lg:gap-x-14 lg:gap-y-12 lg:py-14">
        <section
          className="mx-auto max-w-xl space-y-6 lg:mx-0"
          aria-labelledby="home-hero-heading"
        >
          <LimbiLogo variant="full" size="lg" />
          <h1
            id="home-hero-heading"
            className="font-heading text-3xl font-semibold tracking-tight text-limbi-text sm:text-4xl"
          >
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
          <ul className="space-y-3 pt-1">
            {microBenefits.map((line) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed">
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-limbi-green/12 text-limbi-green"
                  aria-hidden
                >
                  <Check className="size-3" strokeWidth={2.5} />
                </span>
                <span className="text-limbi-text">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex justify-center lg:justify-end">
          <AuthHomePanel />
        </div>
      </div>
    </main>
  );
}
