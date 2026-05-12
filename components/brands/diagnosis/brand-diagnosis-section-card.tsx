"use client";

import { QualityScoreRing } from "@/components/projects/quality-score-ring";
import {
  limbiDocumentCardClass,
} from "@/components/projects/limbi-ui";
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

function priorityLabelEs(p: string): string {
  if (p === "high") return "Alta";
  if (p === "medium") return "Media";
  if (p === "low") return "Baja";
  return p;
}

type Props = {
  row: BrandDiagnosisSectionScoreParsed;
};

export function BrandDiagnosisSectionCard({ row }: Props) {
  const title =
    row.section_label?.trim() || brandQuestionnaireSectionLabelEs(row.section_key);

  return (
    <div className={cn(limbiDocumentCardClass, "border border-limbi-border p-4 sm:p-5")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <QualityScoreRing score={row.score} size="sm" className="shrink-0" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="font-medium text-limbi-text">{title}</h3>
            <p className="text-xs text-limbi-muted">
              {qualityLevelLabelEs(row.quality_level)} · Prioridad:{" "}
              {priorityLabelEs(row.priority)}
            </p>
          </div>
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
              <p className="text-xs font-medium text-limbi-text">Vacíos</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-limbi-muted">
                {row.gaps.map((s, i) => (
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
              <p className="text-xs font-medium text-limbi-text">Riesgos</p>
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

          <p className="text-xs text-limbi-muted">
            Puede apoyar base: {row.can_generate_base ? "sí" : "no"} · Mejorar antes de
            consolidar: {row.should_improve_before_consolidation ? "sí" : "no"}
          </p>
        </div>
      </div>
    </div>
  );
}
