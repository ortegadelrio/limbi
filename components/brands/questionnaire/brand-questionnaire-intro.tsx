"use client";

import { Card, CardContent } from "@/components/ui/card";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

const COPY = `Antes de empezar: no necesitan tener todas las respuestas perfectas. Completen la información que tengan hoy con la mayor claridad posible. Mientras más contexto le den a Limbi, mejores serán el diagnóstico, la Base de Marca y las piezas que se generen después.

Si alguna sección les genera dudas, pueden dejarla con la información disponible. En el siguiente paso, Limbi evaluará la calidad de cada sección y podrá ayudarles a mejorarla con preguntas guiadas.`;

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
