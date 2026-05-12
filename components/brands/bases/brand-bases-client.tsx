"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  limbiDocumentCardClass,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import type { BrandBasesDetailState } from "@/lib/brands/load-brand-bases-state";

type Props = {
  brandId: string;
  brandName: string;
  hasActiveDiagnosis: boolean;
  initialBases: BrandBasesDetailState;
};

function readingFromPayload(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return typeof v === "string" ? v : "";
}

export function BrandBasesClient({
  brandId,
  brandName,
  hasActiveDiagnosis,
  initialBases,
}: Props) {
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

  const pending = bases.pending_review_count > 0;
  const running = bases.consolidation_running;
  const hasKnowledge = Boolean(bases.knowledge_base);
  const hasLimbic = Boolean(bases.limbic_base);
  const bothActive = hasKnowledge && hasLimbic;
  const anyStale = bases.knowledge_base_is_stale || bases.limbic_base_is_stale;

  const knowledgePayload =
    (bases.knowledge_base?.consolidated_payload ?? {}) as Record<string, unknown>;
  const limbicPayload = (bases.limbic_base?.consolidated_payload ?? {}) as Record<string, unknown>;

  const canConsolidate =
    hasActiveDiagnosis && !pending && !running && !consolidating;

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
              Consolidando…
            </>
          ) : running ? (
            "Consolidación en curso…"
          ) : bothActive && !anyStale ? (
            "Regenerar bases"
          ) : bothActive && anyStale ? (
            "Actualizar bases"
          ) : (
            "Generar bases"
          )}
        </Button>
        <Button variant="outline" className={limbiOutlineButtonClass} asChild>
          <Link href={`/brands/${brandId}/diagnosis`}>Ver diagnóstico</Link>
        </Button>
      </div>

      {running ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-limbi-muted">
            Estamos generando la Base de Conocimiento y la Base Límbica. Podés comprobar el estado
            con recargar.
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

      <div className="grid gap-4 sm:grid-cols-1">
        <div
          className={cn(
            limbiDocumentCardClass,
            "space-y-3 border border-limbi-border p-4 sm:p-5",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-limbi-text">Base de Conocimiento</h2>
            {hasKnowledge ? (
              <span className="rounded-full border border-limbi-border px-2 py-0.5 text-xs text-limbi-muted">
                Activa
              </span>
            ) : (
              <span className="rounded-full border border-limbi-border px-2 py-0.5 text-xs text-limbi-muted">
                Sin base
              </span>
            )}
            {bases.knowledge_base_is_stale ? (
              <span className="rounded-full border border-amber-500/45 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-limbi-text">
                Puede estar desactualizada
              </span>
            ) : null}
          </div>
          {hasKnowledge ? (
            <div className="space-y-2 text-sm text-limbi-muted">
              <p className="whitespace-pre-wrap text-limbi-text">
                {readingFromPayload(knowledgePayload, "curator_reading")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-limbi-muted">
              La base curada de conocimiento aparecerá aquí cuando consolides.
            </p>
          )}
        </div>

        <div
          className={cn(
            limbiDocumentCardClass,
            "space-y-3 border border-limbi-border p-4 sm:p-5",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-limbi-text">Base Límbica</h2>
            {hasLimbic ? (
              <span className="rounded-full border border-limbi-border px-2 py-0.5 text-xs text-limbi-muted">
                Activa
              </span>
            ) : (
              <span className="rounded-full border border-limbi-border px-2 py-0.5 text-xs text-limbi-muted">
                Sin base
              </span>
            )}
            {bases.limbic_base_is_stale ? (
              <span className="rounded-full border border-amber-500/45 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-limbi-text">
                Puede estar desactualizada
              </span>
            ) : null}
          </div>
          {hasLimbic ? (
            <div className="space-y-2 text-sm text-limbi-muted">
              <p className="whitespace-pre-wrap text-limbi-text">
                {readingFromPayload(limbicPayload, "symbolic_reading")}
              </p>
              <p className="text-xs italic text-limbi-muted">
                Lectura simbólica: no tomar como claims literales ni copy final.
              </p>
            </div>
          ) : (
            <p className="text-sm text-limbi-muted">
              La lectura límbica curada aparecerá aquí cuando consolides.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
