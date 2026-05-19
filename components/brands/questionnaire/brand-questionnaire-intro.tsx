"use client";

import { Card, CardContent } from "@/components/ui/card";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

const COPY_BEFORE_DIAGNOSIS = `No necesitas tener todas las respuestas perfectas desde el inicio. Puedes escribir poco y avanzar. Mientras más contexto entregues, mejores serán los resultados.

Cuando completes el cuestionario y Limbi genere el primer diagnóstico, podrás usar «Mejorar con Limbi» en cada respuesta con el contexto completo de la marca.

En secciones opcionales puedes avanzar aunque escribas poco: no están pensadas para frenarte.`;

const COPY_AFTER_DIAGNOSIS = `No necesitas tener todas las respuestas perfectas. Puedes guardar y seguir editando. En campos de texto, «Mejorar con Limbi» te ayuda con el diagnóstico y el resto de respuestas como contexto; siempre apruebas antes de guardar un cambio.

En secciones opcionales puedes avanzar aunque escribas poco: no están pensadas para frenarte.`;

type Props = {
  hasActiveDiagnosis?: boolean;
};

export function BrandQuestionnaireIntro({ hasActiveDiagnosis = false }: Props) {
  const copy = hasActiveDiagnosis ? COPY_AFTER_DIAGNOSIS : COPY_BEFORE_DIAGNOSIS;
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
          {copy.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
