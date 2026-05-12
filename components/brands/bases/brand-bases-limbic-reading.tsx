import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

const LIMBIC_BLOCKS: { key: string; title: string }[] = [
  { key: "symbolic_reading", title: "Base Límbica — lectura simbólica principal" },
  { key: "atmosphere_and_metaphor", title: "Atmósfera y metáfora" },
  { key: "rhythm_and_energy", title: "Ritmo y energía" },
  { key: "expressive_codes", title: "Códigos expresivos" },
  { key: "non_literal_guidance", title: "Guía de uso no literal" },
  { key: "symbolic_restrictions", title: "Restricciones simbólicas" },
];

function txt(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return typeof v === "string" ? v : "";
}

type Props = {
  payload: Record<string, unknown>;
};

export function BrandBasesLimbicReading({ payload }: Props) {
  return (
    <section
      className={cn(
        limbiDocumentCardClass,
        "space-y-6 border border-limbi-border bg-limbi-surface/40 p-4 sm:p-5",
      )}
    >
      <div>
        <h2 className="text-base font-semibold text-limbi-text">Base Límbica de Marca</h2>
        <p className="mt-1 text-xs italic text-limbi-muted">
          Lectura simbólica: no tomar como claims literales, datos demográficos ni copy final.
        </p>
      </div>
      <div className="space-y-5">
        {LIMBIC_BLOCKS.map(({ key, title }) => {
          const body = txt(payload, key);
          if (!body.trim()) return null;
          return (
            <div key={key} className="space-y-2 border-t border-limbi-border/70 pt-4 first:border-t-0 first:pt-0">
              <h3 className="text-sm font-semibold text-limbi-text">{title}</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-limbi-muted">{body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
