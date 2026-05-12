"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { limbiDocumentCardClass, limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import type { BrandPostDiagnosisNextStepResolved } from "@/lib/brands/brand-post-diagnosis-next-step";

export type NextStepCardVariant = "default" | "footer";

type Props = {
  resolved: BrandPostDiagnosisNextStepResolved;
  onRegenerateDiagnosis?: () => void | Promise<void>;
  regenerateBusy?: boolean;
  onConsolidateDirect?: () => void | Promise<void>;
  consolidateBusy?: boolean;
  consolidateError?: string | null;
  className?: string;
  variant?: NextStepCardVariant;
};

export function BrandPostDiagnosisNextStepCard({
  resolved,
  onRegenerateDiagnosis,
  regenerateBusy,
  onConsolidateDirect,
  consolidateBusy,
  consolidateError,
  className,
  variant = "default",
}: Props) {
  const isFooter = variant === "footer";
  const primary = resolved.primary;

  const actionButton =
    primary.kind === "link" ? (
      <Button className={limbiPrimaryButtonClass} asChild>
        <Link href={primary.href}>{primary.label}</Link>
      </Button>
    ) : primary.kind === "regenerate_diagnosis" ? (
      <Button
        type="button"
        className={limbiPrimaryButtonClass}
        disabled={regenerateBusy}
        onClick={() => void onRegenerateDiagnosis?.()}
      >
        {regenerateBusy ? (
          <>
            <Loader2 className="mr-2 size-4 shrink-0 animate-spin" aria-hidden />
            Actualizando…
          </>
        ) : (
          primary.label
        )}
      </Button>
    ) : (
      <Button
        type="button"
        className={limbiPrimaryButtonClass}
        disabled={consolidateBusy}
        onClick={() => void onConsolidateDirect?.()}
      >
        {consolidateBusy ? (
          <>
            <Loader2 className="mr-2 size-4 shrink-0 animate-spin" aria-hidden />
            Consolidando…
          </>
        ) : (
          primary.label
        )}
      </Button>
    );

  return (
    <div
      className={cn(
        limbiDocumentCardClass,
        "space-y-3 border border-limbi-border bg-limbi-bg-soft/40 p-4 sm:p-5",
        isFooter && "border-t border-limbi-border/80 bg-limbi-bg-soft/25",
        className,
      )}
    >
      {!isFooter ? (
        <h2 className="text-sm font-semibold text-limbi-text">{resolved.title}</h2>
      ) : (
        <h2 className="text-sm font-semibold text-limbi-text">Cierre de etapa de marca</h2>
      )}
      {!isFooter ? (
        <p className="text-sm leading-relaxed text-limbi-muted">{resolved.body}</p>
      ) : primary.kind === "consolidate_direct" ? (
        <p className="text-sm leading-relaxed text-limbi-muted">
          Si ya revisaste el diagnóstico, podés consolidar la Base de Marca sin salir de esta
          pantalla. Limbi generará la lectura curada y te llevará a Bases para ver el resultado.
        </p>
      ) : null}
      {resolved.secondaryLines?.length ? (
        <div className="space-y-2">
          {resolved.secondaryLines.map((line) => (
            <p key={line} className="text-xs leading-relaxed text-limbi-muted">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {actionButton}
      {primary.kind === "consolidate_direct" && consolidateBusy ? (
        <p className="text-sm text-limbi-muted" role="status">
          Limbi está consolidando la Base de Marca…
        </p>
      ) : null}
      {primary.kind === "consolidate_direct" && consolidateError ? (
        <div className="space-y-2">
          <p className="text-sm text-red-600" role="alert">
            {consolidateError}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl border-limbi-border"
            disabled={consolidateBusy}
            onClick={() => void onConsolidateDirect?.()}
          >
            Reintentar consolidación
          </Button>
        </div>
      ) : null}
    </div>
  );
}
