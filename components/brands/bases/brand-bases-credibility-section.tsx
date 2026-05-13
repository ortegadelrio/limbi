import type { BrandCredibilityArchitectureUi } from "@/lib/brands/brand-bases-consolidated-ui";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

type Props = { credibility: BrandCredibilityArchitectureUi };

function BulletBlock({ title, items }: { title: string; items: string[] }) {
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

export function BrandBasesCredibilitySection({ credibility }: Props) {
  return (
    <section
      className={cn(
        limbiDocumentCardClass,
        "space-y-5 border border-limbi-border bg-limbi-surface/25 p-4 sm:p-5",
      )}
      aria-labelledby="brand-bases-credibility-heading"
    >
      <div className="space-y-1">
        <h2
          id="brand-bases-credibility-heading"
          className="text-base font-semibold text-limbi-text"
        >
          Credenciales, liderazgo y respaldo reputacional
        </h2>
        <p className="text-xs leading-relaxed text-limbi-muted">
          Activos de credibilidad según lo declarado en el cuestionario y fuentes aprobadas: no son
          líneas de servicio del catálogo comercial, sino prueba reputacional y autoridad para piezas
          institucionales y de posicionamiento.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-1">
        <BulletBlock title="Señales de autoridad" items={credibility.authority_signals} />
        <BulletBlock title="Roles institucionales y gremiales" items={credibility.institutional_roles} />
        <BulletBlock
          title="Liderazgo sectorial y comunidad"
          items={credibility.industry_leadership_assets}
        />
        <BulletBlock title="Trayectoria y fundación" items={credibility.founder_credentials} />
        <BulletBlock title="Ecosistema empresarial" items={credibility.business_ecosystem} />
        <BulletBlock title="Prueba reputacional" items={credibility.reputation_proof_points} />
      </div>

      <div className="border-t border-limbi-border/70 pt-4">
        <h3 className="text-sm font-semibold text-limbi-text">Uso en comunicación</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-limbi-muted">
          {credibility.communication_use_guidance}
        </p>
      </div>

      {credibility.cautions.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-limbi-text">Cautelas y tono</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-limbi-muted">
            {credibility.cautions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
