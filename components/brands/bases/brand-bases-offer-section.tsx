import Link from "next/link";
import { Button } from "@/components/ui/button";
import type {
  BrandOfferArchitectureUi,
  BrandOfferServiceCatalogEntryUi,
} from "@/lib/brands/brand-bases-consolidated-ui";
import type { BrandBasesOfferPreview } from "@/lib/brands/load-brand-bases-state";
import { offerItemTypeLabelEs, offerNatureLabelEs } from "@/lib/brands/offer-nature-labels";
import { limbiDocumentCardClass, limbiOutlineButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

type Props = {
  brandId: string;
  offerArchitecture: BrandOfferArchitectureUi | null;
  offerPreview: BrandBasesOfferPreview;
};

function CatalogList({
  rows,
  showStrategic,
}: {
  rows: BrandOfferServiceCatalogEntryUi[];
  showStrategic: boolean;
}) {
  return (
    <ul className="space-y-4">
      {rows.map((row, idx) => (
        <li
          key={`${row.name}-${idx}`}
          className="rounded-xl border border-limbi-border/80 bg-limbi-surface/40 px-4 py-3"
        >
          <p className="font-medium text-limbi-text">{row.name}</p>
          {row.item_type ? (
            <p className="mt-0.5 text-xs text-limbi-muted">
              Tipo: {offerItemTypeLabelEs(row.item_type)}
            </p>
          ) : null}
          {row.description ? (
            <p className="mt-2 text-sm leading-relaxed text-limbi-muted">{row.description}</p>
          ) : null}
          {showStrategic && (row.strategic_role || row.main_value) ? (
            <div className="mt-2 space-y-1 border-t border-limbi-border/50 pt-2 text-xs text-limbi-muted">
              {row.strategic_role ? (
                <p>
                  <span className="font-medium text-limbi-text/90">Rol en la marca:</span>{" "}
                  {row.strategic_role}
                </p>
              ) : null}
              {row.main_value ? (
                <p>
                  <span className="font-medium text-limbi-text/90">Valor principal:</span>{" "}
                  {row.main_value}
                </p>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function BrandBasesOfferSection({ brandId, offerArchitecture, offerPreview }: Props) {
  const previewRows = offerPreview.items.filter((i) => i.title.trim().length > 0);
  const arch = offerArchitecture;
  const catalogFromPayload = arch?.service_catalog?.length
    ? arch.service_catalog.filter((r) => r.name.trim().length > 0)
    : [];

  const usePayloadCatalog = catalogFromPayload.length > 0;
  const rowsForList: BrandOfferServiceCatalogEntryUi[] = usePayloadCatalog
    ? catalogFromPayload
    : previewRows.map((i) => ({
        name: i.title.trim(),
        item_type: i.item_type,
        description: (i.description ?? "").trim(),
        strategic_role: "",
        main_value: "",
      }));

  const natureLabel = (() => {
    if (arch?.offer_nature) return offerNatureLabelEs(arch.offer_nature);
    return offerNatureLabelEs(offerPreview.offer_nature);
  })();

  const hasAnyServices = rowsForList.length > 0;
  const questionnaireHref = `/brands/${brandId}/questionnaire`;

  const strategicReading =
    arch?.offer_summary?.trim() ||
    (hasAnyServices && !usePayloadCatalog
      ? "Estos servicios o productos están registrados en el cuestionario de marca. La lectura estratégica detallada aparecerá aquí cuando consolidés de nuevo la Base de Marca con la versión actual del modelo."
      : "");

  return (
    <section
      className={cn(
        limbiDocumentCardClass,
        "space-y-4 border border-limbi-border/90 bg-limbi-bg-soft/25 p-4 sm:p-6",
      )}
    >
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-semibold text-limbi-text">
          Servicios y oferta de la marca
        </h2>
        <p className="text-xs text-limbi-muted">
          Catálogo explícito para brochures, presentaciones, landings y piezas que necesiten listar
          la oferta (según lo que hayas cargado en marca).
        </p>
      </div>

      <p className="text-sm text-limbi-text">
        <span className="font-medium">Naturaleza de la oferta:</span>{" "}
        <span className="text-limbi-muted">{natureLabel}</span>
      </p>

      {hasAnyServices ? (
        <>
          <CatalogList rows={rowsForList} showStrategic={usePayloadCatalog} />
          {strategicReading ? (
            <div className="space-y-1 border-t border-limbi-border/60 pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-limbi-muted">
                Lectura estratégica
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-limbi-muted">
                {strategicReading}
              </p>
            </div>
          ) : null}
          {arch?.commercial_use_guidance ? (
            <div className="space-y-1 rounded-xl border border-limbi-border/70 bg-limbi-surface/50 px-3 py-2.5">
              <p className="text-xs font-semibold text-limbi-text">Uso en piezas comerciales</p>
              <p className="text-sm leading-relaxed text-limbi-muted">{arch.commercial_use_guidance}</p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="text-limbi-text">
            No hay servicios ni productos estructurados cargados todavía. Completá el inventario de
            oferta en la información de marca para que Limbi pueda listarlos en la Base de Marca y
            en piezas futuras.
          </p>
          <Button variant="outline" className={limbiOutlineButtonClass} asChild>
            <Link href={questionnaireHref}>Editar información de marca</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
