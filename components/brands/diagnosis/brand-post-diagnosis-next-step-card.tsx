"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { limbiDocumentCardClass, limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import type { BrandPostDiagnosisNextStepResolved } from "@/lib/brands/brand-post-diagnosis-next-step";

type Props = {
  resolved: BrandPostDiagnosisNextStepResolved;
  onRegenerateDiagnosis?: () => void | Promise<void>;
  regenerateBusy?: boolean;
  className?: string;
};

export function BrandPostDiagnosisNextStepCard({
  resolved,
  onRegenerateDiagnosis,
  regenerateBusy,
  className,
}: Props) {
  return (
    <div
      className={cn(
        limbiDocumentCardClass,
        "space-y-3 border border-limbi-border bg-limbi-bg-soft/40 p-4 sm:p-5",
        className,
      )}
    >
      <h2 className="text-sm font-semibold text-limbi-text">{resolved.title}</h2>
      <p className="text-sm leading-relaxed text-limbi-muted">{resolved.body}</p>
      {resolved.secondaryLines?.length ? (
        <div className="space-y-2">
          {resolved.secondaryLines.map((line) => (
            <p key={line} className="text-xs leading-relaxed text-limbi-muted">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {resolved.primary.kind === "link" ? (
        <Button className={limbiPrimaryButtonClass} asChild>
          <Link href={resolved.primary.href}>{resolved.primary.label}</Link>
        </Button>
      ) : (
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
            resolved.primary.label
          )}
        </Button>
      )}
    </div>
  );
}
