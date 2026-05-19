import type { ReactNode } from "react";
import type { BrandBaseSectionView } from "@/lib/brands/brand-bases-consolidated-ui";
import { BRAND_BASES_LEGACY_SECTION_INFO_NOTE_ES } from "@/lib/brands/brand-bases-consolidated-ui";
import { offerItemTypeLabelEs } from "@/lib/brands/offer-nature-labels";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

type Props = {
  section: BrandBaseSectionView;
};

function LayerBlock({
  title,
  children,
  variant,
}: {
  title: string;
  children: ReactNode;
  variant: "brand" | "limbi";
}) {
  return (
    <div className="space-y-2">
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.1em]",
          variant === "brand" ? "text-limbi-text" : "text-limbi-green",
        )}
      >
        {title}
      </p>
      <div
        className={cn(
          "rounded-xl px-3 py-2.5 text-sm leading-relaxed",
          variant === "brand"
            ? "border border-limbi-border/80 bg-limbi-surface/50 text-limbi-text"
            : "border border-limbi-green/25 bg-limbi-green/5 text-limbi-muted",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function BrandBasesSectionDualLayer({ section }: Props) {
  const hasBrandInfo = Boolean(section.brandInformation?.trim());
  const hasLimbi = Boolean(section.limbiReading?.trim());
  const showLegacyNote = !hasBrandInfo && hasLimbi;

  return (
    <article
      className={cn(
        limbiDocumentCardClass,
        "space-y-4 border border-limbi-border p-4 sm:p-5",
      )}
    >
      <header className="space-y-1">
        <h3 className="text-base font-semibold text-limbi-text">{section.label}</h3>
        {section.headline && section.headline !== section.label ? (
          <p className="text-xs text-limbi-muted">{section.headline}</p>
        ) : null}
      </header>

      {showLegacyNote ? (
        <p className="text-xs leading-relaxed text-limbi-muted">
          {BRAND_BASES_LEGACY_SECTION_INFO_NOTE_ES}
        </p>
      ) : null}

      {hasBrandInfo ? (
        <LayerBlock title="Información de marca" variant="brand">
          <p className="whitespace-pre-wrap">{section.brandInformation}</p>
          {section.brandInformationDerived ? (
            <p className="mt-2 text-[11px] text-limbi-muted">
              Resumen armado desde la consolidación estructurada de esta sección.
            </p>
          ) : null}
          {section.offerCatalog && section.offerCatalog.length > 0 ? (
            <ul className="mt-3 space-y-2 border-t border-limbi-border/60 pt-3">
              {section.offerCatalog.map((row, idx) => (
                <li key={`${row.name}-${idx}`} className="text-sm">
                  <p className="font-medium text-limbi-text">{row.name}</p>
                  {row.item_type ? (
                    <p className="text-xs text-limbi-muted">
                      {offerItemTypeLabelEs(row.item_type)}
                    </p>
                  ) : null}
                  {row.description ? (
                    <p className="mt-1 text-limbi-muted">{row.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {section.credibilityFactGroups && section.credibilityFactGroups.length > 0 ? (
            <div className="mt-3 space-y-3 border-t border-limbi-border/60 pt-3">
              {section.credibilityFactGroups.map((g) => (
                <div key={g.title}>
                  <p className="text-xs font-medium text-limbi-text">{g.title}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-limbi-muted">
                    {g.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </LayerBlock>
      ) : null}

      {hasLimbi ? (
        <LayerBlock title="Lectura de Limbi" variant="limbi">
          <p className="whitespace-pre-wrap">{section.limbiReading}</p>
        </LayerBlock>
      ) : null}
    </article>
  );
}
