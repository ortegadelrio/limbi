import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { limbiDocumentCardClass, limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import { offerNatureLabelEs } from "@/lib/brands/offer-nature-labels";
import type { BrandOfferNature, BrandStatus } from "@/types/database";

export type BrandListItem = {
  id: string;
  name: string;
  description: string | null;
  brand_status: BrandStatus;
  website_url: string | null;
  country_or_market: string | null;
  updated_at: string;
  offer_nature: BrandOfferNature | null;
  pendingFactsCount: number;
  hasActiveDiagnosis: boolean;
  diagnosisIsStale: boolean;
};

function formatUpdatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function listStatusBadge(b: BrandListItem): { label: string; className: string } {
  if (b.pendingFactsCount > 0) {
    return {
      label: "Hallazgos pendientes",
      className:
        "border border-amber-500/40 bg-amber-500/10 text-limbi-text",
    };
  }
  if (b.hasActiveDiagnosis && b.diagnosisIsStale) {
    return {
      label: "Diagnóstico desactualizado",
      className: "border border-limbi-border bg-limbi-bg-soft text-limbi-muted",
    };
  }
  if (!b.hasActiveDiagnosis) {
    return {
      label: "Sin diagnóstico",
      className: "border border-limbi-border bg-limbi-bg-soft text-limbi-muted",
    };
  }
  return {
    label: "Diagnóstico vigente",
    className: "border border-emerald-500/30 bg-emerald-500/10 text-limbi-text",
  };
}

function listPrimaryCta(b: BrandListItem): { href: string; label: string } {
  if (b.pendingFactsCount > 0) {
    return { href: `/brands/${b.id}/source-facts`, label: "Revisar hallazgos" };
  }
  if (b.hasActiveDiagnosis && b.diagnosisIsStale) {
    return { href: `/brands/${b.id}/diagnosis`, label: "Actualizar diagnóstico" };
  }
  if (!b.hasActiveDiagnosis) {
    return { href: `/brands/${b.id}/diagnosis`, label: "Generar diagnóstico" };
  }
  return { href: `/brands/${b.id}/diagnosis`, label: "Ver diagnóstico" };
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
        const badge = listStatusBadge(b);
        const primary = listPrimaryCta(b);
        return (
          <li key={b.id}>
            <Card
              className={cn(
                limbiDocumentCardClass,
                "overflow-hidden transition-shadow hover:shadow-md",
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="font-heading text-lg text-limbi-text">
                    {b.name}
                  </CardTitle>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </span>
                </div>
                <CardDescription className="text-limbi-muted">
                  {offerNatureLabelEs(b.offer_nature)} · Actualizado{" "}
                  {formatUpdatedAt(b.updated_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-0 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1">
                  {b.description ? (
                    <p className="line-clamp-2 text-sm text-limbi-muted">
                      {b.description}
                    </p>
                  ) : (
                    <span className="text-sm text-limbi-muted">Sin descripción</span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <Button className={cn("w-full sm:w-auto", limbiPrimaryButtonClass)} asChild>
                    <Link href={primary.href}>{primary.label}</Link>
                  </Button>
                  <Link
                    href={`/brands/${b.id}`}
                    className="inline-flex items-center justify-center gap-1 text-sm font-medium text-limbi-green hover:underline sm:justify-end"
                  >
                    Ver marca
                    <ChevronRight className="size-4" aria-hidden />
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
