"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  limbiDocumentCardClass,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import {
  brandKnowledgeUpdateImportanceLabelEs,
  brandKnowledgeUpdateSectionLabelEs,
  brandKnowledgeUpdateStatusLabelEs,
} from "@/lib/brands/brand-knowledge-update-labels";
import { cn } from "@/lib/utils";
import type {
  BrandKnowledgeUpdateRow,
  BrandKnowledgeUpdateStatus,
} from "@/types/database";

type Props = {
  brandId: string;
  brandName: string;
  hasApprovedPendingConsolidation: boolean;
};

type StatusFilter = BrandKnowledgeUpdateStatus | "all";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "pending_review", label: "Pendientes" },
  { value: "approved", label: "Aprobadas" },
  { value: "discarded", label: "Descartadas" },
  { value: "all", label: "Todas" },
];

export function BrandKnowledgeUpdatesClient({
  brandId,
  brandName,
  hasApprovedPendingConsolidation,
}: Props) {
  const [updates, setUpdates] = useState<BrandKnowledgeUpdateRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending_review");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/brands/${brandId}/knowledge-updates?status=${statusFilter}`,
        { credentials: "include" },
      );
      const j = (await res.json().catch(() => ({}))) as {
        updates?: BrandKnowledgeUpdateRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(j.error ?? "No se pudieron cargar las actualizaciones.");
      }
      setUpdates(j.updates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [brandId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => updates.filter((u) => u.status === "pending_review").length,
    [updates],
  );

  const submitNew = useCallback(async () => {
    const text = draftText.trim();
    if (!text) {
      setFormError("Escribí la información que querés agregar.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/knowledge-updates`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: text }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(j.error ?? "No se pudo guardar.");
      }
      setDraftText("");
      setStatusFilter("pending_review");
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSubmitting(false);
    }
  }, [brandId, draftText, load]);

  const review = useCallback(
    async (updateId: string, action: "approve" | "discard") => {
      setActionId(updateId);
      setError(null);
      try {
        const res = await fetch(
          `/api/brands/${brandId}/knowledge-updates/${updateId}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          },
        );
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(j.error ?? "No se pudo actualizar.");
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setActionId(null);
      }
    },
    [brandId, load],
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 gap-1 rounded-xl" asChild>
        <Link href={`/brands/${brandId}`}>
          <ArrowLeft className="size-4" aria-hidden />
          {brandName}
        </Link>
      </Button>

      <div className={cn(limbiDocumentCardClass, "space-y-6 p-6 sm:p-8")}>
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
            Marca
          </p>
          <h1 className="font-heading text-2xl font-semibold text-limbi-text">
            Actualizar conocimiento de marca
          </h1>
          <p className="text-sm leading-relaxed text-limbi-muted">
            Agregá información estable nueva sin rehacer el cuestionario. Cada entrada queda
            pendiente de revisión; al aprobarla queda lista para la próxima consolidación de la
            Base de Marca (no se aplica sola a la base activa).
          </p>
        </header>

        {hasApprovedPendingConsolidation ? (
          <div
            className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            <p className="font-medium">La Base de Marca necesita consolidarse.</p>
            <p className="mt-1 text-amber-900/90">
              Hay actualizaciones aprobadas que aún no están en la base activa. Consolidá desde el{" "}
              <Link href={`/brands/${brandId}`} className="font-medium underline">
                dashboard de la marca
              </Link>
              .
            </p>
          </div>
        ) : null}

        <section className="space-y-3">
          <label htmlFor="knowledge-update-text" className="text-sm font-medium text-limbi-text">
            Nueva información
          </label>
          <textarea
            id="knowledge-update-text"
            rows={4}
            className="w-full resize-y rounded-xl border border-limbi-border bg-white px-3 py-2 text-sm text-limbi-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-accent/40"
            placeholder="Ej.: Ahora también ofrecemos auditorías estratégicas de reputación digital."
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            disabled={submitting}
          />
          {formError ? (
            <p className="text-sm text-red-600" role="alert">
              {formError}
            </p>
          ) : null}
          <Button
            type="button"
            className={cn(limbiPrimaryButtonClass, "gap-2")}
            disabled={submitting}
            onClick={() => void submitNew()}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Guardar como pendiente
          </Button>
        </section>

        <section className="space-y-4 border-t border-limbi-border/60 pt-6">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  statusFilter === tab.value
                    ? "bg-limbi-accent text-white"
                    : "bg-limbi-surface text-limbi-muted hover:text-limbi-text",
                )}
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-limbi-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Cargando…
            </p>
          ) : error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : updates.length === 0 ? (
            <p className="text-sm text-limbi-muted">
              {statusFilter === "pending_review"
                ? "No hay actualizaciones pendientes de revisión."
                : "No hay actualizaciones en este filtro."}
            </p>
          ) : (
            <ul className="space-y-4">
              {updates.map((u) => (
                <li
                  key={u.id}
                  className="rounded-xl border border-limbi-border/80 bg-limbi-surface/40 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-limbi-muted">
                    <span className="rounded-md bg-white px-2 py-0.5 font-medium text-limbi-text">
                      {brandKnowledgeUpdateSectionLabelEs(u.section_key)}
                    </span>
                    <span>{brandKnowledgeUpdateImportanceLabelEs(u.importance_level)}</span>
                    {u.must_include ? (
                      <span className="text-amber-800">Incluir en consolidación</span>
                    ) : null}
                    <span className="ml-auto">
                      {brandKnowledgeUpdateStatusLabelEs(u.status)}
                    </span>
                  </div>
                  <p className="text-sm text-limbi-text whitespace-pre-wrap">{u.raw_text}</p>
                  {u.interpreted_summary && u.interpreted_summary !== u.raw_text ? (
                    <p className="text-xs text-limbi-muted">
                      <span className="font-medium">Resumen:</span> {u.interpreted_summary}
                    </p>
                  ) : null}
                  {u.status === "pending_review" ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        className={limbiPrimaryButtonClass}
                        disabled={actionId === u.id}
                        onClick={() => void review(u.id, "approve")}
                      >
                        {actionId === u.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          "Aprobar"
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={limbiOutlineButtonClass}
                        disabled={actionId === u.id}
                        onClick={() => void review(u.id, "discard")}
                      >
                        Descartar
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {statusFilter === "pending_review" &&
          !loading &&
          pendingCount === 0 &&
          updates.length === 0 ? (
            <p className="text-xs text-limbi-muted">
              Cuando guardes una entrada, aparecerá aquí para que la apruebes o descartes.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
