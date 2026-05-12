"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  limbiDocumentCardClass,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { QualityScoreRing } from "@/components/projects/quality-score-ring";
import { cn } from "@/lib/utils";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";
import type { BrandDiagnosisSectionScoreParsed } from "@/lib/schemas/brand-diagnosis";
import type { BrandDiagnosisNextRecommendedAction, BrandEvaluationRow } from "@/types/database";
import { BrandDiagnosisSectionCard } from "@/components/brands/diagnosis/brand-diagnosis-section-card";

type Props = {
  brandId: string;
  brandName: string;
  initialPendingReviewCount: number;
  initialEvaluation: BrandEvaluationRow | null;
};

function qualityLevelLabelEs(
  level: string | null,
): string {
  switch (level) {
    case "critical":
      return "Crítico";
    case "weak":
      return "Débil";
    case "acceptable":
      return "Aceptable";
    case "strong":
      return "Sólido";
    case "excellent":
      return "Excelente";
    default:
      return "—";
  }
}

function nextActionLabelEs(action: BrandDiagnosisNextRecommendedAction | null): string {
  switch (action) {
    case "improve_required":
      return "Se requieren mejoras antes de consolidar la Base de Marca.";
    case "improve_recommended":
      return "Conviene reforzar algunas secciones antes de consolidar.";
    case "ready_for_consolidation":
      return "La información es sólida para avanzar hacia la consolidación (siguiente paso).";
    default:
      return "";
  }
}

function priorityLabelEs(p: string): string {
  if (p === "high") return "alta";
  if (p === "medium") return "media";
  if (p === "low") return "baja";
  return p;
}

export function BrandDiagnosisClient({
  brandId,
  brandName,
  initialPendingReviewCount,
  initialEvaluation,
}: Props) {
  const router = useRouter();
  const [pendingReviewCount, setPendingReviewCount] = useState(initialPendingReviewCount);
  const [evaluation, setEvaluation] = useState<BrandEvaluationRow | null>(initialEvaluation);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/brands/${brandId}/diagnosis`, { credentials: "include" });
    const j = (await res.json().catch(() => ({}))) as {
      pending_review_count?: number;
      evaluation?: BrandEvaluationRow | null;
    };
    if (res.ok) {
      setPendingReviewCount(j.pending_review_count ?? 0);
      setEvaluation(j.evaluation ?? null);
    }
  }, [brandId]);

  async function onGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/diagnosis`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        evaluation?: BrandEvaluationRow;
      };
      if (res.status === 409 && j.code === "pending_review_blocking") {
        setPendingReviewCount(1);
        throw new Error(
          j.error ??
            "Revisa primero los hallazgos pendientes antes de generar el diagnóstico.",
        );
      }
      if (!res.ok) {
        throw new Error(j.error ?? "No se pudo generar el diagnóstico.");
      }
      if (j.evaluation) {
        setEvaluation(j.evaluation);
      }
      await refresh();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el diagnóstico.");
    } finally {
      setGenerating(false);
    }
  }

  const sectionScores = (evaluation?.section_scores ?? []) as BrandDiagnosisSectionScoreParsed[];
  const criticalGaps = (evaluation?.critical_gaps ?? []) as {
    section_key: string;
    gap: string;
    why_it_matters: string;
  }[];
  const contradictions = (evaluation?.contradictions ?? []) as {
    section_key: string;
    description: string;
    suggested_resolution: string;
  }[];
  const improvementPlan = (evaluation?.improvement_plan ?? []) as {
    section_key: string;
    priority: string;
    recommended_focus: string;
  }[];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 gap-1 rounded-xl" asChild>
        <Link href={`/brands/${brandId}`}>
          <ArrowLeft className="size-4" aria-hidden />
          {brandName}
        </Link>
      </Button>

      <div className={cn(limbiDocumentCardClass, "space-y-6 p-6 sm:p-8")}>
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
            Marca
          </p>
          <h1 className="font-heading text-2xl font-semibold text-limbi-text">
            Diagnóstico de marca
          </h1>
          <p className="text-sm leading-relaxed text-limbi-muted">
            Evaluación estratégica de la calidad de la información disponible (cuestionario y
            hallazgos aprobados). No genera la Base de Marca ni contenidos.
          </p>
        </header>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {pendingReviewCount > 0 ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
            <p className="font-medium text-limbi-text">
              Revisa primero los hallazgos pendientes antes de generar el diagnóstico.
            </p>
            <Button className={cn(limbiPrimaryButtonClass, "mt-3")} asChild>
              <Link href={`/brands/${brandId}/source-facts`}>Revisar hallazgos</Link>
            </Button>
          </div>
        ) : generating ? (
          <p className="flex items-center gap-2 text-sm text-limbi-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Limbi está evaluando la calidad estratégica de la marca…
          </p>
        ) : !evaluation ? (
          <div className="space-y-4">
            <p className="text-sm text-limbi-muted">
              Aún no hay un diagnóstico guardado. Limbi analizará el cuestionario y los hallazgos
              aprobados de documentos para darte una lectura sobria y accionable por sección.
            </p>
            <Button
              type="button"
              className={limbiPrimaryButtonClass}
              disabled={generating}
              onClick={() => void onGenerate()}
            >
              Generar diagnóstico de marca
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
              <QualityScoreRing
                score={evaluation.overall_score ?? 0}
                className="shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium text-limbi-text">
                  Nivel global:{" "}
                  <span className="text-limbi-muted">
                    {qualityLevelLabelEs(evaluation.quality_level)}
                  </span>
                </p>
                {evaluation.strategic_reading ? (
                  <p className="text-sm leading-relaxed text-limbi-muted">
                    {evaluation.strategic_reading}
                  </p>
                ) : null}
                {evaluation.next_recommended_action ? (
                  <p className="text-sm text-limbi-text">
                    {nextActionLabelEs(evaluation.next_recommended_action)}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-limbi-muted">
                Por sección
              </h2>
              <ul className="space-y-4">
                {sectionScores.map((row) => (
                  <li key={row.section_key}>
                    <BrandDiagnosisSectionCard row={row} />
                  </li>
                ))}
              </ul>
            </section>

            {criticalGaps.length > 0 ? (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-limbi-muted">
                  Vacíos críticos
                </h2>
                <ul className="space-y-3 text-sm">
                  {criticalGaps.map((g, i) => (
                    <li
                      key={`${g.section_key}-${i}`}
                      className="rounded-xl border border-limbi-border bg-limbi-surface/60 px-4 py-3"
                    >
                      <p className="font-medium text-limbi-text">
                        {brandQuestionnaireSectionLabelEs(g.section_key)}
                      </p>
                      <p className="mt-1 text-limbi-muted">{g.gap}</p>
                      <p className="mt-2 text-xs text-limbi-muted">{g.why_it_matters}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {contradictions.length > 0 ? (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-limbi-muted">
                  Contradicciones o tensiones
                </h2>
                <ul className="space-y-3 text-sm">
                  {contradictions.map((c, i) => (
                    <li
                      key={`${c.section_key}-${i}`}
                      className="rounded-xl border border-limbi-border bg-limbi-surface/60 px-4 py-3"
                    >
                      <p className="font-medium text-limbi-text">
                        {brandQuestionnaireSectionLabelEs(c.section_key)}
                      </p>
                      <p className="mt-1 text-limbi-muted">{c.description}</p>
                      <p className="mt-2 text-xs text-limbi-muted">{c.suggested_resolution}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {improvementPlan.length > 0 ? (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-limbi-muted">
                  Plan de mejora priorizado
                </h2>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-limbi-muted">
                  {improvementPlan.map((p, i) => (
                    <li key={`${p.section_key}-${i}`}>
                      <span className="font-medium text-limbi-text">
                        {brandQuestionnaireSectionLabelEs(p.section_key)}
                      </span>{" "}
                      (prioridad {priorityLabelEs(p.priority)}) — {p.recommended_focus}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-limbi-border pt-6 sm:flex-row sm:flex-wrap">
              <Button variant="outline" className={limbiOutlineButtonClass} asChild>
                <Link href={`/brands/${brandId}`}>Volver a la marca</Link>
              </Button>
              <Button type="button" disabled className={limbiOutlineButtonClass} variant="outline">
                Mejorar secciones — Disponible en el siguiente paso
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
