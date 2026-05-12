import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";
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
        className={cn(limbiDocumentCardClass, "p-8 text-center")}
        data-testid="brand-list-empty"
      >
        <p className="text-sm text-limbi-muted">
          Aún no tienes marcas. Crea la primera para separar la memoria de marca
          de tus proyectos.
        </p>
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
        const questionnaireHref = `/brands/${b.id}/questionnaire`;

        return (
          <li key={b.id}>
            <Card
              className={cn(
                limbiDocumentCardClass,
                "overflow-hidden transition-shadow hover:shadow-md",
              )}
            >
              <CardHeader className="space-y-3 pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="font-heading text-lg text-limbi-text">{b.name}</CardTitle>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      executiveStatusBadgeClass(b.executiveStatusLabel),
                    )}
                  >
                    {b.executiveStatusLabel}
                  </span>
                </div>
                <CardDescription className="text-sm text-limbi-muted">
                  {offerNatureLabelEs(b.offer_nature)}
                </CardDescription>

                <div className="flex flex-col gap-3 border-t border-limbi-border/70 pt-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-medium text-limbi-text">Calidad de información</p>
                    <p className="text-[11px] leading-snug text-limbi-muted">
                      {BRAND_INFORMATION_QUALITY_MICROCOPY_ES}
                    </p>
                  </div>
                  {scoreDisplay ? (
                    <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end">
                      <p
                        className={cn(
                          "font-heading text-3xl font-semibold tabular-nums",
                          band === "high" && "text-emerald-600",
                          band === "medium" && "text-amber-600",
                          band === "low" && "text-red-600/90",
                        )}
                      >
                        {scoreDisplay}
                      </p>
                      {bandHint ? (
                        <p className="text-right text-[11px] text-limbi-muted">{bandHint}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-limbi-muted">Aún no hay diagnóstico</p>
                  )}
                </div>

                <div className="flex flex-col gap-1 text-[11px] text-limbi-muted">
                  {b.diagnosisGeneratedAtBogota ? (
                    <p>Diagnóstico: generado el {b.diagnosisGeneratedAtBogota}</p>
                  ) : null}
                  {b.baseConsolidatedAtBogota ? (
                    <p>Base de Marca: consolidada el {b.baseConsolidatedAtBogota}</p>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 border-t border-limbi-border/60 pt-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1">
                  {b.description ? (
                    <p className="line-clamp-2 text-sm text-limbi-muted">{b.description}</p>
                  ) : (
                    <span className="text-sm text-limbi-muted">Sin descripción</span>
                  )}
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
                  <BrandOverviewCardCta brandId={b.id} maintenance={b.maintenance} />
                  <Link
                    href={questionnaireHref}
                    className="text-sm font-medium text-limbi-green underline-offset-4 hover:underline sm:text-right"
                  >
                    Editar información de marca
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
