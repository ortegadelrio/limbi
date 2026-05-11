"use client";

type Props = {
  answeredCount: number;
  totalCount: number;
  sectionLabel?: string;
};

export function BrandQuestionnaireProgress({
  answeredCount,
  totalCount,
  sectionLabel,
}: Props) {
  const pct =
    totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-limbi-text">Progreso</span>
        <span className="text-limbi-muted">
          {answeredCount} / {totalCount} respondidas ({pct}%)
        </span>
      </div>
      {sectionLabel ? (
        <p className="text-xs text-limbi-muted">
          Sección actual:{" "}
          <span className="font-medium text-limbi-text">{sectionLabel}</span>
        </p>
      ) : null}
      <div className="h-2 overflow-hidden rounded-full bg-limbi-bg-soft">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--limbi-green)] to-[var(--limbi-aqua)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
