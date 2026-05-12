"use client";

import { Card, CardContent } from "@/components/ui/card";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

const COPY = `No necesitas tener todas las respuestas perfectas desde el inicio. Puedes escribir poco y avanzar. Mientras más contexto entregues, mejores serán los resultados. Si alguna sección te genera dudas, Limbi podrá ayudarte más adelante a mejorarla con criterio estratégico.

En secciones opcionales puedes avanzar aunque escribas poco: no están pensadas para frenarte.`;

export function BrandQuestionnaireIntro() {
  return (
    <Card
      className={cn(
        limbiDocumentCardClass,
        "border-limbi-border/90 bg-gradient-to-br from-limbi-surface-soft/95 to-limbi-surface",
      )}
    >
      <CardContent className="space-y-3 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
          Antes de empezar
        </p>
        <div className="space-y-3 text-sm leading-relaxed text-limbi-text">
          {COPY.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
