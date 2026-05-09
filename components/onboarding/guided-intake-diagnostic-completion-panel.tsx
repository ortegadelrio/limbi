"use client";

import React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import {
  GUIDED_INTAKE_DIAGNOSIS_PRIMARY_CTA_ES,
  GUIDED_INTAKE_DIAGNOSIS_SECONDARY_CTA_ES,
} from "@/lib/intake/guided-intake-diagnosis-copy";
import type { StrategicInterviewPilotSummary } from "@/lib/intake/strategic-interview-summary";

export type GuidedIntakeDiagnosticCompletionPanelProps = {
  summary: StrategicInterviewPilotSummary;
  diagnosisLoading: boolean;
  diagnosisError: string | null;
  continueBaseHref: string;
  onRunDiagnosis: () => void | Promise<void>;
};

export function GuidedIntakeDiagnosticCompletionPanel(
  props: GuidedIntakeDiagnosticCompletionPanelProps,
) {
  const { summary, diagnosisLoading, diagnosisError, continueBaseHref, onRunDiagnosis } =
    props;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <Card className="rounded-[22px] border border-limbi-border shadow-limbi">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{summary.title}</CardTitle>
          <CardDescription className="whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">
            {summary.body}
          </CardDescription>
        </CardHeader>
        {summary.weakLine ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">{summary.weakLine}</p>
          </CardContent>
        ) : null}
        {diagnosisError ? (
          <CardContent>
            <p className="text-sm text-destructive" role="alert">
              {diagnosisError}
            </p>
          </CardContent>
        ) : null}
        <CardFooter className="flex w-full flex-col gap-3 border-t border-border/60 pt-4">
          <div className="w-full space-y-2">
            <Button
              type="button"
              className={`${limbiPrimaryButtonClass} w-full min-h-[2.85rem] text-base`}
              data-testid="guided-intake-diagnosis-primary-cta"
              disabled={diagnosisLoading}
              onClick={() => void onRunDiagnosis()}
            >
              {diagnosisLoading ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                  Ejecutando diagnóstico…
                </>
              ) : (
                GUIDED_INTAKE_DIAGNOSIS_PRIMARY_CTA_ES
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={`${limbiOutlineButtonClass} w-full min-h-[2.5rem] text-sm font-normal`}
              data-testid="guided-intake-diagnosis-secondary-cta"
              disabled={diagnosisLoading}
              onClick={() => void onRunDiagnosis()}
            >
              {GUIDED_INTAKE_DIAGNOSIS_SECONDARY_CTA_ES}
            </Button>
            <p className="pt-1 text-center text-xs leading-snug text-muted-foreground">
              Limbi revisará coherencia entre audiencia, promesa y pruebas. Luego podrás
              responder aclaraciones puntuales, sin repetir toda la entrevista.
            </p>
          </div>
        </CardFooter>
      </Card>

      <nav
        className="mt-6 flex flex-col items-center gap-2 border-t border-transparent pt-1"
        data-testid="guided-intake-diagnostic-escape-links"
        aria-label="Otras opciones"
      >
        <Link
          href="/projects"
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Guardar y salir
        </Link>
        <Link
          href={continueBaseHref}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Continuar con cuestionario clásico
        </Link>
      </nav>
    </div>
  );
}
