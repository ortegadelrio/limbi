import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QualityScoreRing } from "@/components/projects/quality-score-ring";
import { limbiDocumentCardClass, limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import { offerNatureLabelEs } from "@/lib/brands/offer-nature-labels";
import type { BrandOverviewListRow } from "@/lib/brands/fetch-brands-overview-maintenance";
import {
  BRAND_INFORMATION_QUALITY_MICROCOPY_ES,
  brandInformationQualityBandFromScore,
  brandInformationQualityBandHintEs,
} from "@/lib/brands/brand-dashboard-maintenance-action";
import { BrandOverviewCardCta } from "@/components/brands/brand-overview-card-cta";

export type BrandListItem = BrandOverviewListRow;

function executiveStatusBadgeClass(label: string): string {
  if (label === "Marca lista") {
    return "border-emerald-500/35 bg-emerald-500/10 text-limbi-text";
  }
  if (label === "Hallazgos pendientes" || label.includes("desactualiz")) {
    return "border-amber-500/40 bg-amber-500/10 text-limbi-text";
  }
  if (label === "Sin diagnóstico" || label === "Sin Base de Marca") {
    return "border border-limbi-border bg-limbi-bg-soft text-limbi-muted";
  }
  if (label === "Consolidación en curso") {
    return "border border-limbi-border bg-limbi-bg-soft text-limbi-text";
  }
  return "border border-limbi-border bg-limbi-bg-soft text-limbi-muted";
}

export function BrandList({ brands }: { brands: BrandListItem[] }) {
  if (brands.length === 0) {
    return (
      <div
        className={cn(
          limbiDocumentCardClass,
          "flex flex-col items-center gap-4 border border-dashed border-limbi-border/80 bg-limbi-bg-soft/30 p-10 text-center sm:p-12",
        )}
        data-testid="brand-list-empty"
      >
        <div className="flex size-12 items-center justify-center rounded-2xl bg-limbi-surface text-limbi-green shadow-sm ring-1 ring-limbi-border/60">
          <Sparkles className="size-6" aria-hidden />
        </div>
        <div className="max-w-md space-y-2">
          <p className="font-heading text-lg font-semibold text-limbi-text">Empezá con tu primera marca</p>
          <p className="text-sm leading-relaxed text-limbi-muted">
            Acá vas a ver el estado de cada marca: calidad de información, diagnóstico y Base de
            Marca. Creá una marca para capturar identidad y oferta aparte de los proyectos.
          </p>
        </div>
        <Button asChild className={cn(limbiPrimaryButtonClass, "mt-1")}>
          <Link href="/brands/new">Crear marca</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4" aria-label="Lista de marcas">
      {brands.map((b) => {
        const band = brandInformationQualityBandFromScore(b.overallScore);
        const bandHint = brandInformationQualityBandHintEs(band);
        const scoreDisplay =
          b.hasActiveDiagnosis && b.overallScore != null && !Number.isNaN(b.overallScore)
            ? `${Math.round(b.overallScore)}%`
            : null;
        const knowledgeHref = `/brands/${b.id}/knowledge`;

        return (
          <li key={b.id}>
            <Card
              className={cn(
                limbiDocumentCardClass,
                "overflow-hidden border-limbi-border/80 shadow-sm transition-shadow hover:shadow-md",
              )}
            >
              <CardHeader className="space-y-4 pb-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="font-heading text-xl font-semibold tracking-tight text-limbi-text">
                      {b.name}
                    </CardTitle>
                    <CardDescription className="text-sm text-limbi-muted">
                      {offerNatureLabelEs(b.offer_nature)}
                    </CardDescription>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                      executiveStatusBadgeClass(b.executiveStatusLabel),
                    )}
                  >
                    {b.executiveStatusLabel}
                  </span>
                </div>

                <div className="rounded-2xl border border-limbi-border/70 bg-limbi-bg-soft/40 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-limbi-muted">
                        Calidad de información
                      </p>
                      <p
                        className="max-w-prose text-[11px] leading-snug text-limbi-muted sm:text-xs"
                        title={BRAND_INFORMATION_QUALITY_MICROCOPY_ES}
                      >
                        {BRAND_INFORMATION_QUALITY_MICROCOPY_ES}
                      </p>
                    </div>
                    {scoreDisplay && b.overallScore != null ? (
                      <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                        <QualityScoreRing score={b.overallScore} size="sm" />
                        <div className="min-w-0 text-left sm:text-right">
                          <p
                            className={cn(
                              "font-heading text-2xl font-semibold tabular-nums sm:hidden",
                              band === "high" && "text-emerald-600",
                              band === "medium" && "text-amber-600",
                              band === "low" && "text-red-600/90",
                            )}
                          >
                            {scoreDisplay}
                          </p>
                          {bandHint ? (
                            <p className="max-w-[14rem] text-[11px] leading-snug text-limbi-muted sm:text-right">
                              {bandHint}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-limbi-muted">Aún no hay diagnóstico</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 border-t border-limbi-border/50 pt-3 text-[11px] text-limbi-muted">
                  {b.diagnosisGeneratedAtBogota ? (
                    <p>
                      <span className="font-medium text-limbi-text/90">Diagnóstico</span> · Hora
                      Bogotá · {b.diagnosisGeneratedAtBogota}
                    </p>
                  ) : null}
                  {b.baseConsolidatedAtBogota ? (
                    <p>
                      <span className="font-medium text-limbi-text/90">Base de Marca</span> · Hora
                      Bogotá · {b.baseConsolidatedAtBogota}
                    </p>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 border-t border-limbi-border/60 bg-limbi-surface/30 pt-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1">
                  {b.description ? (
                    <p className="line-clamp-2 text-sm leading-relaxed text-limbi-muted">
                      {b.description}
                    </p>
                  ) : (
                    <span className="text-sm text-limbi-muted/90">Sin descripción breve</span>
                  )}
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[12rem] sm:items-stretch">
                  <BrandOverviewCardCta
                    brandId={b.id}
                    maintenance={b.maintenance}
                    activeDiagnosisEvaluationId={b.activeDiagnosisEvaluationId}
                  />
                  <Link
                    href={knowledgeHref}
                    className="text-center text-sm font-medium text-limbi-green underline-offset-4 hover:underline sm:text-right"
                  >
                    Gestionar información de marca
                  </Link>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
