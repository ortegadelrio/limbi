import { BRAND_BASE_LIMBIC_SECTION_LABEL } from "@/lib/brands/brand-base-display-sections";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

const LIMBIC_SIGNAL_KEYS: { key: string; title: string }[] = [
  { key: "atmosphere_and_metaphor", title: "Atmósfera y metáfora" },
  { key: "rhythm_and_energy", title: "Ritmo y energía" },
  { key: "expressive_codes", title: "Códigos expresivos" },
];

const LIMBIC_READING_KEYS: { key: string; title: string }[] = [
  { key: "symbolic_reading", title: "Lectura simbólica principal" },
  { key: "non_literal_guidance", title: "Cómo usar esta lectura" },
  { key: "symbolic_restrictions", title: "Restricciones simbólicas" },
];

function txt(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return typeof v === "string" ? v.trim() : "";
}

function joinBlocks(
  payload: Record<string, unknown>,
  blocks: { key: string; title: string }[],
): string {
  const parts: string[] = [];
  for (const { key, title } of blocks) {
    const body = txt(payload, key);
    if (!body) continue;
    parts.push(`${title}\n${body}`);
  }
  return parts.join("\n\n").trim();
}

type Props = {
  payload: Record<string, unknown>;
};

export function BrandBasesLimbicReading({ payload }: Props) {
  const brandSignals = joinBlocks(payload, LIMBIC_SIGNAL_KEYS);
  const limbiReading = joinBlocks(payload, LIMBIC_READING_KEYS);

  return (
    <article
      className={cn(
        limbiDocumentCardClass,
        "space-y-5 border border-limbi-border bg-limbi-surface/40 p-4 sm:p-5",
      )}
    >
      <header>
        <h2 className="text-base font-semibold text-limbi-text">{BRAND_BASE_LIMBIC_SECTION_LABEL}</h2>
        <p className="mt-1 text-xs italic text-limbi-muted">
          Señales del cuestionario límbico y lectura simbólica de Limbi (no son claims literales ni
          copy final).
        </p>
      </header>

      {brandSignals ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-limbi-text">
            Información de marca
          </p>
          <div className="rounded-xl border border-limbi-border/80 bg-limbi-surface/50 px-3 py-2.5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-limbi-text">
              {brandSignals}
            </p>
          </div>
        </div>
      ) : null}

      {limbiReading ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-limbi-green">
            Lectura de Limbi
          </p>
          <div className="rounded-xl border border-limbi-green/25 bg-limbi-green/5 px-3 py-2.5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-limbi-muted">
              {limbiReading}
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}
