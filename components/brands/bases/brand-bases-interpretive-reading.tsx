import type { ReactNode } from "react";
import {
  BRAND_BASES_EXECUTIVE_DISCLAIMER_ES,
  buildBrandBaseSectionViews,
  type BrandKnowledgeUiModel,
} from "@/lib/brands/brand-bases-consolidated-ui";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import { BrandBasesSectionDualLayer } from "@/components/brands/bases/brand-bases-section-dual-layer";

type Props = {
  knowledgeUi: BrandKnowledgeUiModel;
};

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-limbi-text">{title}</h3>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-limbi-muted">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function CardSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        limbiDocumentCardClass,
        "space-y-3 border border-limbi-border p-4 sm:p-5",
        className,
      )}
    >
      <h2 className="text-base font-semibold text-limbi-text">{title}</h2>
      {children}
    </section>
  );
}

export function BrandBasesInterpretiveReading({ knowledgeUi }: Props) {
  const h = knowledgeUi.finalHighlights;
  const sectionViews = buildBrandBaseSectionViews(knowledgeUi);

  return (
    <div className="space-y-8">
      <p className="rounded-xl border border-limbi-border bg-limbi-bg-soft/50 px-4 py-3 text-sm leading-relaxed text-limbi-muted">
        {BRAND_BASES_EXECUTIVE_DISCLAIMER_ES}
      </p>

      {knowledgeUi.internalBaseNotice ? (
        <p className="text-xs leading-relaxed text-limbi-muted">{knowledgeUi.internalBaseNotice}</p>
      ) : null}

      <CardSection title="Panorama general">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-limbi-text">
          {knowledgeUi.executiveReading}
        </p>
      </CardSection>

      {sectionViews.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-limbi-text">Por sección</h2>
          <ul className="space-y-4">
            {sectionViews.map((section) => (
              <li key={section.id}>
                <BrandBasesSectionDualLayer section={section} />
              </li>
            ))}
          </ul>
        </div>
      ) : knowledgeUi.strategicPillars.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-limbi-text">Enfoque estratégico</h2>
          <p className="text-xs text-limbi-muted">
            Esta consolidación usa un formato anterior. Regenerá la Base de Marca para ver
            información de marca y lectura de Limbi por sección.
          </p>
          <ul className="space-y-4">
            {knowledgeUi.strategicPillars.map((p) => (
              <li
                key={p.title}
                className={cn(
                  limbiDocumentCardClass,
                  "space-y-2 border border-limbi-border p-4 sm:p-5",
                )}
              >
                <h3 className="text-sm font-semibold text-limbi-text">{p.title}</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-limbi-muted">
                  {p.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {h ? (
        <section
          className={cn(
            limbiDocumentCardClass,
            "space-y-4 border border-limbi-border bg-limbi-bg-soft/30 p-4 sm:p-5",
          )}
        >
          <h2 className="text-base font-semibold text-limbi-text">Síntesis estratégica</h2>
          <div className="grid gap-4 sm:grid-cols-1">
            <BulletList title="Principales fortalezas" items={h.key_strengths} />
            <BulletList title="Tensiones estratégicas importantes" items={h.strategic_tensions} />
            <BulletList
              title="Oportunidades de comunicación"
              items={h.communication_opportunities}
            />
            <BulletList title="Señales límbicas clave" items={h.key_limbic_signals} />
            <BulletList
              title="Cuidados narrativos y cosas a evitar"
              items={h.narrative_care_and_avoids}
            />
          </div>
        </section>
      ) : null}

      {knowledgeUi.projectReadinessMessage ? (
        <CardSection title="Preparación para proyectos">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-limbi-muted">
            {knowledgeUi.projectReadinessMessage}
          </p>
        </CardSection>
      ) : null}
    </div>
  );
}
