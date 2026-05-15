"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  limbiDocumentCardClass,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { QualityScoreRing } from "@/components/projects/quality-score-ring";
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
import { BRAND_IA_SOURCE_FOOTNOTE_ES } from "@/lib/brands/brand-active-base-source-of-truth";

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
  /** Evaluación activa al cargar la página; si POST devuelve el mismo id, no consolidamos. */
  activeDiagnosisEvaluationId: string | null;
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
  activeDiagnosisEvaluationId,
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
        const d = await postBrandDiagnosis(brandId);
        if (!d.ok) {
          setErrorMessage(d.error);
          setPhaseMessage(null);
          return;
        }
        if (
          activeDiagnosisEvaluationId &&
          d.evaluation.id === activeDiagnosisEvaluationId
        ) {
          setErrorMessage(
            "El diagnóstico no se renovó; no consolidamos la Base de Marca para evitar datos desactualizados.",
          );
          setPhaseMessage(null);
          await router.refresh();
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
  }, [maintenance, router, runConsolidate, runDiagnosis, activeDiagnosisEvaluationId, brandId]);

  const primaryDisabled =
    busy ||
    maintenance.primaryRole === "none_up_to_date" ||
    maintenance.primaryRole === "blocked_busy";

  return (
    <div className="space-y-6">
      <section
        className={cn(
          limbiDocumentCardClass,
          "space-y-4 border border-limbi-border/90 bg-limbi-surface/40 p-4 sm:p-6",
        )}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="font-heading text-base font-semibold tracking-tight text-limbi-text">
              Calidad de información de la marca
            </h2>
            <p className="max-w-prose text-xs leading-relaxed text-limbi-muted sm:text-sm">
              Este porcentaje resume qué tan completa y útil es la información para que Limbi
              construya una Base de Marca confiable.
            </p>
          </div>
          {scoreDisplay && overallScore != null ? (
            <div className="flex shrink-0 items-center gap-5 sm:flex-col sm:items-end sm:gap-2">
              <QualityScoreRing score={overallScore} size="md" />
              <div className="text-left sm:text-right">
                <p
                  className={cn(
                    "font-heading text-3xl font-semibold tabular-nums sm:hidden",
                    band === "high" && "text-emerald-600",
                    band === "medium" && "text-amber-600",
                    band === "low" && "text-red-600/90",
                  )}
                >
                  {scoreDisplay}
                </p>
                {bandHint ? (
                  <p className="max-w-[16rem] text-xs text-limbi-muted sm:text-right">{bandHint}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-limbi-muted">Aún no hay diagnóstico</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-limbi-border/60 pt-4 text-xs text-limbi-muted">
          {hasActiveDiagnosis ? (
            <>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  diagnosisIsStale
                    ? "border-amber-500/45 bg-amber-500/10 text-limbi-text"
                    : "border-emerald-500/40 bg-emerald-500/10 text-limbi-text",
                )}
              >
                {diagnosisIsStale ? "Diagnóstico desactualizado" : "Diagnóstico vigente"}
              </span>
              {diagnosisGeneratedAtBogota ? (
                <span>
                  Hora Bogotá · generado el {diagnosisGeneratedAtBogota}
                </span>
              ) : null}
              {diagnosisGeneratedAtBogota ? (
                <span className="basis-full max-w-prose text-[11px] leading-snug text-limbi-muted/90">
                  Tras editar el cuestionario, «Actualizar todo» reconstruye el diagnóstico y luego la
                  base; esta fecha debería quedar posterior a tu último guardado.
                </span>
              ) : null}
            </>
          ) : null}
        </div>

        {hasActiveBases && baseConsolidatedAtBogota ? (
          <p className="text-xs text-limbi-muted">
            Base de Marca consolidada (Hora Bogotá) · {baseConsolidatedAtBogota}
          </p>
        ) : null}
        {hasActiveBases ? (
          <p className="max-w-prose border-t border-limbi-border/50 pt-3 text-[11px] leading-snug text-limbi-muted/90">
            {BRAND_IA_SOURCE_FOOTNOTE_ES}
          </p>
        ) : null}
      </section>

      {maintenance.combinedStaleNotice ||
      maintenance.diagnosisStaleNotice ||
      maintenance.baseStaleNotice ? (
        <div
          className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4 sm:p-5"
          role="region"
          aria-label="Avisos de actualización"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-900/80 dark:text-amber-200/90">
            Hay información nueva en la marca
          </p>
          {maintenance.combinedStaleNotice ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-limbi-text">{maintenance.combinedStaleNotice.title}</p>
              <p className="text-limbi-muted">{maintenance.combinedStaleNotice.body}</p>
            </div>
          ) : null}
          {maintenance.diagnosisStaleNotice ? (
            <div
              className={cn(
                "space-y-1 text-sm",
                maintenance.combinedStaleNotice && "border-t border-amber-500/25 pt-4",
              )}
            >
              <p className="font-medium text-limbi-text">{maintenance.diagnosisStaleNotice.title}</p>
              <p className="text-limbi-muted">{maintenance.diagnosisStaleNotice.body}</p>
            </div>
          ) : null}
          {maintenance.baseStaleNotice ? (
            <div
              className={cn(
                "space-y-1 text-sm",
                (maintenance.combinedStaleNotice || maintenance.diagnosisStaleNotice) &&
                  "border-t border-amber-500/25 pt-4",
              )}
            >
              <p className="font-medium text-limbi-text">{maintenance.baseStaleNotice.title}</p>
              <p className="text-limbi-muted">{maintenance.baseStaleNotice.body}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <section
        className={cn(
          limbiDocumentCardClass,
          "space-y-5 border border-limbi-border/90 bg-limbi-surface/50 p-4 sm:p-6",
        )}
      >
        <div className="space-y-1">
          <h2 className="font-heading text-base font-semibold tracking-tight text-limbi-text">
            Mantener marca
          </h2>
          <p className="text-xs text-limbi-muted">
            Un solo paso principal: Limbi te guía según lo que haga falta actualizar.
          </p>
        </div>

        {maintenance.upToDateHeadline ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-900 dark:text-emerald-100/90">
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

        <div className="flex flex-wrap gap-2">
          {maintenance.primaryRole !== "none_up_to_date" ? (
            <>
              {maintenance.primaryRole === "review_pending_facts" && maintenance.primaryHref ? (
                <Button
                  className={cn(limbiPrimaryButtonClass, "min-h-11 w-full px-6 text-[15px] sm:w-auto")}
                  asChild
                >
                  <Link href={maintenance.primaryHref}>{maintenance.primaryLabel}</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  className={cn(limbiPrimaryButtonClass, "min-h-11 w-full px-6 text-[15px] sm:w-auto")}
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
            </>
          ) : null}
          {hasActiveBases ? (
            <Button
              variant="outline"
              className={cn(limbiOutlineButtonClass, "min-h-11 w-full px-5 sm:w-auto")}
              asChild
            >
              <Link href={`/brands/${brandId}/bases`}>Ver Base de Marca</Link>
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-limbi-border/70 pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-limbi-muted">
            Accesos rápidos
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(hasActiveBases
              ? secondaryLinks.filter((l) => l.label !== "Ver Base de Marca")
              : secondaryLinks
            ).map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="block rounded-xl border border-transparent px-1 py-1.5 text-sm text-limbi-muted transition-colors hover:border-limbi-border/80 hover:bg-limbi-bg-soft/50 hover:text-limbi-green"
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
