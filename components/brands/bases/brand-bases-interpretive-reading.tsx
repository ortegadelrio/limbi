import type { ReactNode } from "react";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";
import {
  BRAND_BASES_EXECUTIVE_DISCLAIMER_ES,
  type BrandKnowledgeUiModel,
} from "@/lib/brands/brand-bases-consolidated-ui";
import type { BrandBasesOfferPreview } from "@/lib/brands/load-brand-bases-state";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import { BrandBasesOfferSection } from "@/components/brands/bases/brand-bases-offer-section";

type Props = {
  brandId: string;
  offerPreview: BrandBasesOfferPreview;
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

export function BrandBasesInterpretiveReading({ brandId, offerPreview, knowledgeUi }: Props) {
  const h = knowledgeUi.finalHighlights;
  const hasSections = knowledgeUi.sectionInterpretations.length > 0;

  return (
    <div className="space-y-8">
      <p className="rounded-xl border border-limbi-border bg-limbi-bg-soft/50 px-4 py-3 text-sm leading-relaxed text-limbi-muted">
        {BRAND_BASES_EXECUTIVE_DISCLAIMER_ES}
      </p>

      {knowledgeUi.internalBaseNotice ? (
        <p className="text-xs leading-relaxed text-limbi-muted">{knowledgeUi.internalBaseNotice}</p>
      ) : null}

      <CardSection title="Lectura ejecutiva">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-limbi-text">
          {knowledgeUi.executiveReading}
        </p>
      </CardSection>

      <BrandBasesOfferSection
        brandId={brandId}
        offerArchitecture={knowledgeUi.offerArchitecture}
        offerPreview={offerPreview}
      />

      {hasSections ? (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-limbi-text">Interpretación por secciones</h2>
          <ul className="space-y-4">
            {knowledgeUi.sectionInterpretations.map((row) => (
              <li
                key={row.section_key}
                className={cn(
                  limbiDocumentCardClass,
                  "space-y-2 border border-limbi-border p-4 sm:p-5",
                )}
              >
                <h3 className="text-sm font-semibold text-limbi-text">
                  {brandQuestionnaireSectionLabelEs(row.section_key)}
                  {row.headline &&
                  row.headline !== brandQuestionnaireSectionLabelEs(row.section_key) ? (
                    <span className="mt-0.5 block text-xs font-normal text-limbi-muted">
                      {row.headline}
                    </span>
                  ) : null}
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-limbi-muted">
                  {row.interpretation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : knowledgeUi.strategicPillars.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-limbi-text">Enfoque estratégico</h2>
          <p className="text-xs text-limbi-muted">
            Esta consolidación usa un formato anterior sin interpretaciones por sección; mostramos
            los pilares estratégicos como lectura principal.
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

      {hasSections && knowledgeUi.strategicPillars.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-limbi-text">Pilares estratégicos</h2>
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

      <CardSection title="Síntesis curadora global">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-limbi-muted">
          {knowledgeUi.curatorReading}
        </p>
      </CardSection>

      <CardSection title="Evidencia y restricciones">
        <div>
          <h3 className="text-sm font-medium text-limbi-text">Narrativa de evidencia</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-limbi-muted">
            {knowledgeUi.evidenceNarrative}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-limbi-text">Restricciones y alertas</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-limbi-muted">
            {knowledgeUi.restrictionsAndAlerts}
          </p>
        </div>
      </CardSection>

      {h ? (
        <section
          className={cn(
            limbiDocumentCardClass,
            "space-y-4 border border-limbi-border bg-limbi-bg-soft/30 p-4 sm:p-5",
          )}
        >
          <h2 className="text-base font-semibold text-limbi-text">Highlights estratégicos</h2>
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
