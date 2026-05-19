"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  limbiDocumentCardClass,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import {
  BRAND_KNOWLEDGE_HUB_INTRO_ES,
  brandKnowledgeHubStatusLabelEs,
} from "@/lib/brands/brand-knowledge-hub-sections";
import type { BrandKnowledgeHubState } from "@/lib/brands/fetch-brand-knowledge-hub-state";
import { cn } from "@/lib/utils";

type Props = {
  brandId: string;
  initial: BrandKnowledgeHubState;
};

function statusBadgeClass(status: BrandKnowledgeHubState["sections"][0]["status"]): string {
  switch (status) {
    case "pending_review":
      return "bg-amber-100 text-amber-900";
    case "pending_consolidation":
      return "bg-sky-100 text-sky-900";
    default:
      return "bg-emerald-50 text-emerald-800";
  }
}

export function BrandKnowledgeHubClient({ brandId, initial }: Props) {
  const base = `/brands/${brandId}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 gap-1 rounded-xl" asChild>
        <Link href={base}>
          <ArrowLeft className="size-4" aria-hidden />
          {initial.brandName}
        </Link>
      </Button>

      <div className={cn(limbiDocumentCardClass, "space-y-8 p-6 sm:p-8")}>
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
            Marca
          </p>
          <h1 className="font-heading text-2xl font-semibold text-limbi-text">
            Información de marca
          </h1>
          <p className="text-sm leading-relaxed text-limbi-muted">
            {BRAND_KNOWLEDGE_HUB_INTRO_ES}
          </p>
        </header>

        {(initial.totalPendingReview > 0 ||
          initial.totalApprovedPendingConsolidation > 0) && (
          <div
            className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            {initial.totalPendingReview > 0 ? (
              <p>
                Hay {initial.totalPendingReview} actualización
                {initial.totalPendingReview === 1 ? "" : "es"} pendiente
                {initial.totalPendingReview === 1 ? "" : "s"} de revisión.{" "}
                <Link
                  href={`${base}/knowledge-updates`}
                  className="font-medium underline underline-offset-2"
                >
                  Ver bandeja de actualizaciones
                </Link>
              </p>
            ) : null}
            {initial.totalApprovedPendingConsolidation > 0 ? (
              <p className={initial.totalPendingReview > 0 ? "mt-2" : undefined}>
                Hay actualizaciones aprobadas que aún no están en la Base de Marca activa.{" "}
                <Link href={base} className="font-medium underline underline-offset-2">
                  Consolidá desde el dashboard
                </Link>
                .
              </p>
            ) : null}
          </div>
        )}

        <ul className="space-y-4">
          {initial.sections.map((section) => {
            const editHref = section.def.questionnaireSectionKey
              ? `${base}/questionnaire?section=${encodeURIComponent(section.def.questionnaireSectionKey)}`
              : `${base}/questionnaire`;
            const addHref = `${base}/knowledge-updates?section=${encodeURIComponent(section.def.updateSectionKey)}&action=add`;

            return (
              <li
                key={section.def.updateSectionKey}
                className="rounded-xl border border-limbi-border/80 bg-limbi-surface/30 p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-limbi-text">
                    {section.def.label}
                  </h2>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      statusBadgeClass(section.status),
                    )}
                  >
                    {brandKnowledgeHubStatusLabelEs(section.status)}
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-limbi-muted whitespace-pre-wrap">
                  {section.summary}
                </p>

                {section.pendingReviewCount > 0 ||
                section.approvedPendingConsolidationCount > 0 ? (
                  <p className="text-xs text-limbi-muted">
                    {section.pendingReviewCount > 0
                      ? `${section.pendingReviewCount} pendiente${section.pendingReviewCount === 1 ? "" : "s"} de revisión`
                      : null}
                    {section.pendingReviewCount > 0 &&
                    section.approvedPendingConsolidationCount > 0
                      ? " · "
                      : null}
                    {section.approvedPendingConsolidationCount > 0
                      ? `${section.approvedPendingConsolidationCount} por consolidar`
                      : null}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={limbiOutlineButtonClass}
                    asChild
                  >
                    <Link href={editHref}>Editar información actual</Link>
                  </Button>
                  <Button type="button" size="sm" className={limbiPrimaryButtonClass} asChild>
                    <Link href={addHref}>Agregar información nueva</Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-xs leading-relaxed text-limbi-muted border-t border-limbi-border/60 pt-4">
          La Base de Marca activa no se edita a mano: se reconsolida desde fuentes aprobadas. El
          cuestionario original y la bandeja de actualizaciones siguen disponibles desde aquí por
          sección.
        </p>
      </div>
    </div>
  );
}
