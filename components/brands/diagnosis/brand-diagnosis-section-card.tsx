"use client";

import Link from "next/link";
import { QualityScoreRing } from "@/components/projects/quality-score-ring";
import {
  limbiDocumentCardClass,
  limbiOutlineButtonClass,
} from "@/components/projects/limbi-ui";
import { Button } from "@/components/ui/button";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";
import type { BrandDiagnosisSectionScoreParsed } from "@/lib/schemas/brand-diagnosis";
import { cn } from "@/lib/utils";

function qualityLevelLabelEs(level: string): string {
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
      return level;
  }
}

function sectionProgressLabelEs(score: number): string {
  if (score >= 90) return "Lista para consolidarse";
  if (score >= 80) return "Bien encaminada";
  if (score >= 70) return "Buena base para avanzar";
  if (score >= 60) return "Base funcional por fortalecer";
  if (score >= 40) return "Punto de partida por reforzar";
  return "Necesita información esencial";
}

function priorityLabelEs(p: string): string {
  if (p === "high") return "Alta";
  if (p === "medium") return "Media";
  if (p === "low") return "Baja";
  return p;
}

type Props = {
  brandId: string;
  row: BrandDiagnosisSectionScoreParsed;
  hasApprovedImprovementAfterDiagnosis?: boolean;
};

export function BrandDiagnosisSectionCard({
  brandId,
  row,
  hasApprovedImprovementAfterDiagnosis = false,
}: Props) {
  const title =
    row.section_label?.trim() || brandQuestionnaireSectionLabelEs(row.section_key);
  const canImproveSection = row.section_key !== "material_context";
  const depthOpportunities = row.depth_opportunities ?? [];

  return (
    <div className={cn(limbiDocumentCardClass, "border border-limbi-border p-4 sm:p-5")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <QualityScoreRing score={row.score} size="sm" className="shrink-0" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-limbi-text">{title}</h3>
              {hasApprovedImprovementAfterDiagnosis ? (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
                  Mejora aprobada
                </span>
              ) : null}
            </div>
            <p className="text-xs text-limbi-muted">
              {sectionProgressLabelEs(row.score)} · {qualityLevelLabelEs(row.quality_level)} · Prioridad:{" "}
              {priorityLabelEs(row.priority)}
            </p>
          </div>
          {hasApprovedImprovementAfterDiagnosis ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs leading-relaxed text-limbi-muted">
              Esta sección ya tiene una mejora aprobada. El puntaje corresponde al último
              diagnóstico y puede actualizarse al regenerar la evaluación.
            </p>
          ) : null}
          {row.score >= 70 && row.score < 86 ? (
            <p className="rounded-lg border border-limbi-border/80 bg-limbi-surface/40 px-3 py-2 text-xs leading-relaxed text-limbi-muted">
              Hay base suficiente para avanzar. Puedes fortalecer esta sección si quieres mayor
              precisión.
            </p>
          ) : null}

          {row.score < 58 && row.gaps.length > 0 ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-limbi-muted">
              Falta información esencial para evaluar esta sección con seguridad.
            </p>
          ) : null}

          <p className="text-sm leading-relaxed text-limbi-muted">{row.diagnosis}</p>

          {row.strengths.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-limbi-text">Fortalezas</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-limbi-muted">
                {row.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {row.gaps.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-limbi-text">Vacíos o fragilidades esenciales</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-limbi-muted">
                {row.gaps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {depthOpportunities.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-limbi-text">Profundización opcional</p>
              <p className="text-[11px] leading-relaxed text-limbi-muted">
                Podrías profundizar esta sección, pero no bloquea el avance.
              </p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-limbi-muted">
                {depthOpportunities.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {row.contradictions.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-limbi-text">Tensiones en esta sección</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-limbi-muted">
                {row.contradictions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {row.risks.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-limbi-text">Riesgos y límites</p>
              <p className="text-[11px] leading-relaxed text-limbi-muted">
                Esto debe tratarse como restricción estratégica o alerta, no como mensaje visible
                tal cual.
              </p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-limbi-muted">
                {row.risks.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {row.recommendations.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-limbi-text">Recomendaciones</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-limbi-muted">
                {row.recommendations.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {canImproveSection ? (
            <div className="pt-1">
              <Button variant="outline" size="sm" className={limbiOutlineButtonClass} asChild>
                <Link href={`/brands/${brandId}/improve/${encodeURIComponent(row.section_key)}`}>
                  Mejorar esta sección con la IA de Limbi
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
