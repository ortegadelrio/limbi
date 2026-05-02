"use client";

import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SystemStepDisplayState, SystemStepperStep } from "./system-status-utils";

const STATE_LABEL: Record<SystemStepDisplayState, string> = {
  por_construir: "Por construir",
  activo: "Activo",
  aprobado: "Aprobado",
  necesita_actualizacion: "Necesita actualización",
  listo: "Listo",
};

function stateStyles(state: SystemStepDisplayState, locked: boolean): string {
  if (locked) {
    return "border-limbi-border bg-limbi-surface-soft text-limbi-muted dark:border-limbi-border/60 dark:bg-limbi-surface-soft/40";
  }
  switch (state) {
    case "listo":
    case "aprobado":
      return "border-limbi-green/25 bg-limbi-green/[0.06] text-limbi-text shadow-sm dark:border-limbi-green/35 dark:bg-limbi-green/[0.08]";
    case "necesita_actualizacion":
      return "border-limbi-yellow/35 bg-limbi-yellow/[0.08] text-limbi-text dark:border-limbi-yellow/40";
    case "activo":
      return "border-limbi-blue/25 bg-limbi-blue/[0.07] text-limbi-text shadow-sm dark:border-limbi-blue/30";
    default:
      return "border-limbi-border bg-limbi-bg-soft text-limbi-muted dark:bg-limbi-surface-soft/50";
  }
}

type Props = {
  steps: SystemStepperStep[];
  className?: string;
};

export function SystemStepper({ steps, className }: Props) {
  return (
    <nav
      aria-label="Etapas del Sistema Límbico"
      className={cn("w-full", className)}
    >
      <ol className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-0 md:divide-x md:divide-limbi-border/80 dark:md:divide-limbi-border/50">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li
              key={step.id}
              className={cn(
                "min-w-0 flex-1 rounded-2xl border p-4 md:rounded-none md:border-0 md:p-5",
                !isLast && "md:pr-5",
                index > 0 && "md:pl-5",
                stateStyles(step.state, step.locked),
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0" aria-hidden>
                  {step.locked ? (
                    <Lock className="size-4 text-limbi-muted opacity-80" />
                  ) : step.state === "listo" || step.state === "aprobado" ? (
                    <Check className="size-4 text-limbi-green" />
                  ) : (
                    <span className="flex size-5 items-center justify-center rounded-full border border-limbi-border bg-limbi-surface text-[10px] font-semibold tabular-nums text-limbi-muted">
                      {index + 1}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-limbi-muted">
                    Etapa {index + 1}
                  </p>
                  <p className="font-heading mt-1 text-sm font-semibold leading-snug text-limbi-text">
                    {step.label}
                  </p>
                  <p className="mt-1.5 text-xs text-limbi-muted">
                    {step.locked ? "Bloqueada" : STATE_LABEL[step.state]}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
