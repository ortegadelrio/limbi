"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  limbiDocumentCardClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import type { BrandDashboardMaintenanceResolved } from "@/lib/brands/brand-dashboard-maintenance-action";
import {
  brandInformationQualityBandFromScore,
  brandInformationQualityBandHintEs,
} from "@/lib/brands/brand-dashboard-maintenance-action";
import {
  postBrandConsolidate,
  postBrandDiagnosis,
} from "@/lib/brands/brand-maintenance-api-actions";

type SecondaryLink = { label: string; href: string };

type Props = {
  brandId: string;
  maintenance: BrandDashboardMaintenanceResolved;
  secondaryLinks: SecondaryLink[];
  hasActiveDiagnosis: boolean;
  diagnosisIsStale: boolean;
  overallScore: number | null;
  diagnosisGeneratedAtBogota: string | null;
  baseConsolidatedAtBogota: string | null;
  hasActiveBases: boolean;
};

export function BrandDashboardMaintenanceClient({
  brandId,
  maintenance,
  secondaryLinks,
  hasActiveDiagnosis,
  diagnosisIsStale,
  overallScore,
  diagnosisGeneratedAtBogota,
  baseConsolidatedAtBogota,
  hasActiveBases,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [phaseMessage, setPhaseMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const band = brandInformationQualityBandFromScore(overallScore);
  const bandHint = brandInformationQualityBandHintEs(band);
  const scoreDisplay =
    hasActiveDiagnosis && overallScore != null && !Number.isNaN(overallScore)
      ? `${Math.round(overallScore)}%`
      : null;

  const runConsolidate = useCallback(async (): Promise<boolean> => {
    const r = await postBrandConsolidate(brandId);
    if (!r.ok) {
      setErrorMessage(r.error);
      return false;
    }
    return true;
  }, [brandId]);

  const runDiagnosis = useCallback(async (): Promise<boolean> => {
    const r = await postBrandDiagnosis(brandId);
    if (!r.ok) {
      setErrorMessage(r.error);
      return false;
    }
    return true;
  }, [brandId]);

  const onPrimary = useCallback(async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const { primaryRole } = maintenance;

    if (primaryRole === "review_pending_facts" && maintenance.primaryHref) {
      return;
    }
    if (primaryRole === "none_up_to_date" || primaryRole === "blocked_busy") {
      return;
    }

    setBusy(true);

    try {
      if (primaryRole === "update_all") {
        setPhaseMessage("Limbi está actualizando el diagnóstico y la Base de Marca…");
        const dOk = await runDiagnosis();
        if (!dOk) {
          setPhaseMessage(null);
          return;
        }
        const cOk = await runConsolidate();
        setPhaseMessage(null);
        if (!cOk) {
          setErrorMessage(
            "El diagnóstico se actualizó, pero no pudimos consolidar la Base de Marca.",
          );
          await router.refresh();
          return;
        }
        setSuccessMessage("Diagnóstico y Base de Marca actualizados.");
        await router.refresh();
        return;
      }

      if (primaryRole === "update_base_only" || primaryRole === "create_base") {
        setPhaseMessage("Limbi está consolidando la Base de Marca…");
        const cOk = await runConsolidate();
        setPhaseMessage(null);
        if (!cOk) return;
        setSuccessMessage(
          primaryRole === "create_base"
            ? "Base de Marca generada."
            : "Base de Marca actualizada.",
        );
        await router.refresh();
        return;
      }

      if (primaryRole === "generate_diagnosis") {
        setPhaseMessage("Limbi está actualizando el diagnóstico…");
        const dOk = await runDiagnosis();
        setPhaseMessage(null);
        if (!dOk) return;
        setSuccessMessage("Diagnóstico generado.");
        await router.refresh();
        return;
      }
    } finally {
      setBusy(false);
    }
  }, [maintenance, router, runConsolidate, runDiagnosis]);

  const primaryDisabled =
    busy ||
    maintenance.primaryRole === "none_up_to_date" ||
    maintenance.primaryRole === "blocked_busy";

  return (
    <div className="space-y-6">
      <section
        className={cn(
          limbiDocumentCardClass,
          "space-y-4 border border-limbi-border p-4 sm:p-5",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h2 className="text-sm font-semibold text-limbi-text">
              Calidad de información de la marca
            </h2>
            <p className="text-xs leading-relaxed text-limbi-muted">
              Este porcentaje mide qué tan completa y útil es la información disponible para que
              Limbi construya una Base de Marca confiable.
            </p>
          </div>
          {scoreDisplay ? (
            <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
              <p
                className={cn(
                  "font-heading text-4xl font-semibold tabular-nums sm:text-5xl",
                  band === "high" && "text-emerald-600",
                  band === "medium" && "text-amber-600",
                  band === "low" && "text-red-600/90",
                )}
              >
                {scoreDisplay}
              </p>
              {bandHint ? (
                <p className="text-right text-xs text-limbi-muted">{bandHint}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm font-medium text-limbi-muted">Aún no hay diagnóstico</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-limbi-muted">
          {hasActiveDiagnosis ? (
            <>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                  diagnosisIsStale
                    ? "border-amber-500/45 bg-amber-500/10 text-limbi-text"
                    : "border-emerald-500/40 bg-emerald-500/10 text-limbi-text",
                )}
              >
                {diagnosisIsStale ? "Diagnóstico desactualizado" : "Diagnóstico vigente"}
              </span>
              {diagnosisGeneratedAtBogota ? (
                <span>Generado el {diagnosisGeneratedAtBogota}</span>
              ) : null}
            </>
          ) : null}
        </div>

        {hasActiveBases && baseConsolidatedAtBogota ? (
          <p className="text-xs text-limbi-muted">
            Base de Marca consolidada el {baseConsolidatedAtBogota}
          </p>
        ) : null}
      </section>

      {maintenance.combinedStaleNotice ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm">
          <p className="font-medium text-limbi-text">{maintenance.combinedStaleNotice.title}</p>
          <p className="mt-1 text-limbi-muted">{maintenance.combinedStaleNotice.body}</p>
        </div>
      ) : null}

      {maintenance.diagnosisStaleNotice ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm">
          <p className="font-medium text-limbi-text">{maintenance.diagnosisStaleNotice.title}</p>
          <p className="mt-1 text-limbi-muted">{maintenance.diagnosisStaleNotice.body}</p>
        </div>
      ) : null}

      {maintenance.baseStaleNotice ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm">
          <p className="font-medium text-limbi-text">{maintenance.baseStaleNotice.title}</p>
          <p className="mt-1 text-limbi-muted">{maintenance.baseStaleNotice.body}</p>
        </div>
      ) : null}

      <section
        className={cn(
          limbiDocumentCardClass,
          "space-y-4 border border-limbi-border p-4 sm:p-5",
        )}
      >
        <h2 className="text-sm font-semibold text-limbi-text">Mantener marca</h2>

        {maintenance.upToDateHeadline ? (
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200/90">
            {maintenance.upToDateHeadline}
          </p>
        ) : null}

        {phaseMessage ? (
          <p className="flex items-center gap-2 text-sm text-limbi-muted">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            {phaseMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300/90">
            {successMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {maintenance.primaryRole !== "none_up_to_date" ? (
          <div className="flex flex-wrap gap-2">
            {maintenance.primaryRole === "review_pending_facts" && maintenance.primaryHref ? (
              <Button className={limbiPrimaryButtonClass} asChild>
                <Link href={maintenance.primaryHref}>{maintenance.primaryLabel}</Link>
              </Button>
            ) : (
              <Button
                type="button"
                className={limbiPrimaryButtonClass}
                disabled={primaryDisabled}
                onClick={() => void onPrimary()}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    {maintenance.primaryLabel}
                  </>
                ) : (
                  maintenance.primaryLabel
                )}
              </Button>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-limbi-border/80 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-limbi-muted">
            Accesos rápidos
          </p>
          <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {secondaryLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm text-limbi-green underline-offset-4 hover:underline"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
