"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import type { BrandBasesDetailState } from "@/lib/brands/load-brand-bases-state";
import { buildBrandKnowledgeUiModel } from "@/lib/brands/brand-bases-consolidated-ui";
import { BrandBasesInterpretiveReading } from "@/components/brands/bases/brand-bases-interpretive-reading";
import { BrandBasesLimbicReading } from "@/components/brands/bases/brand-bases-limbic-reading";

type Props = {
  brandId: string;
  brandName: string;
  initialBases: BrandBasesDetailState;
};

export function BrandBasesClient({ brandId, brandName, initialBases }: Props) {
  const router = useRouter();
  const [bases, setBases] = useState(initialBases);
  const [consolidating, setConsolidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/brands/${brandId}/bases`, { credentials: "include" });
    const j = (await res.json().catch(() => ({}))) as BrandBasesDetailState & { error?: string };
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "No se pudo cargar el estado de las bases.");
      return;
    }
    setBases({
      pending_review_count: j.pending_review_count ?? 0,
      consolidation_running: Boolean(j.consolidation_running),
      knowledge_base: j.knowledge_base ?? null,
      limbic_base: j.limbic_base ?? null,
      knowledge_base_is_stale: Boolean(j.knowledge_base_is_stale),
      limbic_base_is_stale: Boolean(j.limbic_base_is_stale),
      has_active_diagnosis: Boolean(j.has_active_diagnosis),
      diagnosis_is_stale: Boolean(j.diagnosis_is_stale),
      knowledge_consolidated_at_bogota: j.knowledge_consolidated_at_bogota ?? null,
    });
    setError(null);
  }, [brandId]);

  const onConsolidate = useCallback(async () => {
    setConsolidating(true);
    setError(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/bases/consolidate`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "No se pudo consolidar.");
        return;
      }
      await refresh();
      router.refresh();
    } finally {
      setConsolidating(false);
    }
  }, [brandId, refresh, router]);

  const hasActiveDiagnosis = bases.has_active_diagnosis;
  const diagnosisIsStale = bases.diagnosis_is_stale;
  const pending = bases.pending_review_count > 0;
  const running = bases.consolidation_running;
  const hasKnowledge = Boolean(bases.knowledge_base);
  const hasLimbic = Boolean(bases.limbic_base);
  const bothActive = hasKnowledge && hasLimbic;
  const anyStale = bases.knowledge_base_is_stale || bases.limbic_base_is_stale;

  const knowledgePayload =
    (bases.knowledge_base?.consolidated_payload ?? {}) as Record<string, unknown>;
  const limbicPayload = (bases.limbic_base?.consolidated_payload ?? {}) as Record<string, unknown>;
  const knowledgeUi = hasKnowledge ? buildBrandKnowledgeUiModel(knowledgePayload) : null;

  const canConsolidate =
    hasActiveDiagnosis && !diagnosisIsStale && !pending && !running && !consolidating;

  const consolidateButtonLabel = (() => {
    if (!hasActiveDiagnosis) return "Generar bases";
    if (diagnosisIsStale) return "Actualiza primero el diagnóstico";
    if (consolidating) return "Consolidando…";
    if (running) return "Consolidación en curso…";
    if (bothActive && anyStale) return "Actualizar Base de Marca";
    if (bothActive) return "Regenerar bases";
    return "Generar bases";
  })();

  const closureStatusLine = (() => {
    if (pending) {
      return "Hallazgos de documentos pendientes: la consolidación queda bloqueada hasta revisarlos.";
    }
    if (!hasActiveDiagnosis) {
      return "Sin diagnóstico activo: generá la evaluación en la pantalla de diagnóstico antes de consolidar.";
    }
    if (diagnosisIsStale) {
      return "Actualiza primero el diagnóstico antes de consolidar o regenerar la Base de Marca.";
    }
    if (running) {
      return "Consolidación en curso: esperá el resultado o recargá el estado.";
    }
    if (!bothActive) {
      return "Listo para consolidar: diagnóstico al día y sin bloqueos de hallazgos.";
    }
    if (anyStale) {
      return "La Base de Marca fue consolidada antes de los últimos cambios en la marca.";
    }
    return "Bases activas vigentes: conocimiento y límbica alineados con fuentes aprobadas y diagnóstico actual.";
  })();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1 text-limbi-muted" asChild>
          <Link href={`/brands/${brandId}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Volver a la marca
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-limbi-text sm:text-2xl">Bases de marca</h1>
        <p className="mt-1 text-sm text-limbi-muted">{brandName}</p>
      </div>

      <div className="space-y-2">
        {bases.knowledge_consolidated_at_bogota ? (
          <>
            <p className="text-xs text-limbi-muted">
              Base de Marca consolidada el {bases.knowledge_consolidated_at_bogota}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {anyStale ? (
                <span className="inline-flex w-fit rounded-full border border-amber-500/45 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-limbi-text">
                  Base desactualizada
                </span>
              ) : (
                <span className="inline-flex w-fit rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-limbi-text">
                  Base vigente
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-limbi-muted">
            Aún no hay una Base de Marca consolidada para esta marca.
          </p>
        )}
        {anyStale && !diagnosisIsStale ? (
          <p className="text-xs text-limbi-muted">
            Esta base no incluye cambios recientes del cuestionario, documentos, hallazgos, oferta,
            territorios o mejoras.
          </p>
        ) : null}
      </div>

      <p className="rounded-xl border border-limbi-border bg-limbi-surface/50 px-3 py-2 text-sm text-limbi-muted">
        {closureStatusLine}
      </p>

      {pending ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-limbi-text">
          Hay hallazgos de documentos pendientes de revisión. Resolvelos antes de consolidar.
        </p>
      ) : null}

      {!hasActiveDiagnosis ? (
        <p className="rounded-xl border border-limbi-border bg-limbi-surface/40 px-3 py-2 text-sm text-limbi-muted">
          Necesitás un diagnóstico de marca activo antes de generar las bases curadas.
        </p>
      ) : null}

      {hasActiveDiagnosis && diagnosisIsStale ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-limbi-text">
          <span className="font-medium">Actualiza primero el diagnóstico.</span>{" "}
          <Link
            href={`/brands/${brandId}/diagnosis`}
            className="text-limbi-green underline-offset-4 hover:underline"
          >
            Ir a diagnóstico
          </Link>
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-limbi-text">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          className={limbiPrimaryButtonClass}
          disabled={!canConsolidate}
          onClick={() => void onConsolidate()}
        >
          {consolidating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              {consolidateButtonLabel}
            </>
          ) : (
            consolidateButtonLabel
          )}
        </Button>
        <Button variant="outline" className={limbiOutlineButtonClass} asChild>
          <Link href={`/brands/${brandId}/diagnosis`}>Ver diagnóstico</Link>
        </Button>
      </div>

      {running ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-limbi-muted">
            Limbi está consolidando la Base de Marca… Podés comprobar el estado con recargar.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={limbiOutlineButtonClass}
            onClick={() => void refresh()}
          >
            Recargar estado
          </Button>
        </div>
      ) : null}

      {hasKnowledge && knowledgeUi ? (
        <div className="space-y-8">
          <BrandBasesInterpretiveReading knowledgeUi={knowledgeUi} />
          {hasLimbic ? <BrandBasesLimbicReading payload={limbicPayload} /> : null}
        </div>
      ) : !hasKnowledge && !hasLimbic ? (
        <p className="text-sm text-limbi-muted">
          La lectura ejecutiva de la Base de Marca aparecerá aquí cuando consolidés desde el
          diagnóstico o desde esta pantalla.
        </p>
      ) : !hasKnowledge && hasLimbic ? (
        <div className="space-y-6">
          <p className="text-sm text-limbi-muted">
            Aún no hay Base de Conocimiento activa; la Base Límbica puede mostrarse cuando exista
            consolidación previa.
          </p>
          <BrandBasesLimbicReading payload={limbicPayload} />
        </div>
      ) : null}

      {bothActive && !running && !pending ? (
        <div className="space-y-2 rounded-xl border border-limbi-border bg-limbi-bg-soft/40 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-limbi-text">Siguiente paso</h2>
          {anyStale || diagnosisIsStale ? (
            <>
              <p className="text-xs text-limbi-muted">
                Próximo paso: crear proyectos con esta marca. Actualizá el diagnóstico y la Base de
                Marca para alinearlas con las fuentes antes de usarlas en proyectos.
              </p>
              <Button type="button" variant="outline" className={limbiOutlineButtonClass} disabled>
                Ir al dashboard de proyectos
              </Button>
            </>
          ) : (
            <Button className={limbiOutlineButtonClass} variant="outline" asChild>
              <Link href="/projects">Ir al dashboard de proyectos</Link>
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
