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
  brandSourceFactRelationshipLabelEs,
  brandSourceFactTypeLabelEs,
} from "@/lib/brands/brand-source-fact-labels";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";
import { cn } from "@/lib/utils";
import type { BrandSourceFactRow } from "@/types/database";

type Props = {
  brandId: string;
  brandName: string;
  /** True si existe al menos un hallazgo en BD (cualquier estado), para distinguir cierre de revisión vs. bandeja vacía inicial. */
  hasAnySourceFacts: boolean;
};

type DiagnosisSummary = {
  hasEvaluation: boolean;
  diagnosisIsStale: boolean;
};

async function fetchDiagnosisSummary(brandId: string): Promise<DiagnosisSummary | null> {
  const res = await fetch(`/api/brands/${brandId}/diagnosis`, { credentials: "include" });
  const j = (await res.json().catch(() => ({}))) as {
    evaluation?: unknown;
    diagnosis_is_stale?: boolean;
    pending_review_count?: number;
    error?: string;
  };
  if (!res.ok) {
    return null;
  }
  return {
    hasEvaluation: Boolean(j.evaluation),
    diagnosisIsStale: Boolean(j.diagnosis_is_stale),
  };
}

export function BrandSourceFactsClient({
  brandId,
  brandName,
  hasAnySourceFacts,
}: Props) {
  const [facts, setFacts] = useState<BrandSourceFactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [diagnosisSummary, setDiagnosisSummary] = useState<DiagnosisSummary | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);

  const refreshDiagnosisSummary = useCallback(async () => {
    setDiagnosisLoading(true);
    try {
      const s = await fetchDiagnosisSummary(brandId);
      setDiagnosisSummary(s);
    } finally {
      setDiagnosisLoading(false);
    }
  }, [brandId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/brands/${brandId}/source-facts?status=pending_review`,
        { credentials: "include" },
      );
      const j = (await res.json().catch(() => ({}))) as {
        facts?: BrandSourceFactRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(j.error ?? "No se pudieron cargar los hallazgos.");
      }
      setFacts(j.facts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading && facts.length === 0 && hasAnySourceFacts) {
      void refreshDiagnosisSummary();
    }
  }, [loading, facts.length, hasAnySourceFacts, refreshDiagnosisSummary]);

  const grouped = useMemo(() => {
    const map = new Map<string, BrandSourceFactRow[]>();
    for (const f of facts) {
      const list = map.get(f.section_key) ?? [];
      list.push(f);
      map.set(f.section_key, list);
    }
    const keys = [...map.keys()].sort((a, b) =>
      brandQuestionnaireSectionLabelEs(a).localeCompare(
        brandQuestionnaireSectionLabelEs(b),
      ),
    );
    return keys.map((k) => ({ section_key: k, items: map.get(k) ?? [] }));
  }, [facts]);

  async function patchFact(
    factId: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    setActionId(factId);
    setError(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/source-facts/${factId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(j.error ?? "No se pudo actualizar el hallazgo.");
      }
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setActionId(null);
    }
  }

  const diagnosisHref = `/brands/${brandId}/diagnosis`;
  const brandHref = `/brands/${brandId}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 gap-1 rounded-xl" asChild>
        <Link href={`/brands/${brandId}`}>
          <ArrowLeft className="size-4" aria-hidden />
          {brandName}
        </Link>
      </Button>

      <div className={cn(limbiDocumentCardClass, "space-y-4 p-6 sm:p-8")}>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-limbi-text">
            Hallazgos de documentos
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-limbi-muted">
            Limbi encontró información que podría enriquecer la Base de Marca. Revisa qué
            quieres incluir. Nada de esto alimenta el diagnóstico hasta que lo apruebes.
          </p>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-limbi-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Cargando hallazgos…
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && facts.length === 0 && !hasAnySourceFacts ? (
          <p className="text-sm text-limbi-muted">
            No hay hallazgos pendientes de revisión. Cuando analices documentos desde
            Material de contexto, aparecerán aquí.
          </p>
        ) : null}

        {!loading && facts.length === 0 && hasAnySourceFacts ? (
          <div
            className={cn(
              limbiDocumentCardClass,
              "space-y-4 border border-limbi-border bg-limbi-bg-soft/30 p-4 sm:p-5",
            )}
          >
            <div className="space-y-1">
              <p className="text-base font-semibold text-limbi-text">
                Todos los hallazgos fueron revisados
              </p>
              <p className="text-sm leading-relaxed text-limbi-muted">
                Ya resolviste la información sugerida por los documentos. Ahora puedes
                generar o actualizar el diagnóstico de marca.
              </p>
            </div>
            {diagnosisLoading ? (
              <p className="flex items-center gap-2 text-sm text-limbi-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Cargando estado del diagnóstico…
              </p>
            ) : diagnosisSummary ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button className={limbiPrimaryButtonClass} asChild>
                  <Link href={diagnosisHref}>
                    {!diagnosisSummary.hasEvaluation
                      ? "Generar diagnóstico"
                      : diagnosisSummary.diagnosisIsStale
                        ? "Actualizar diagnóstico"
                        : "Ver diagnóstico"}
                  </Link>
                </Button>
                <Button variant="outline" className={limbiOutlineButtonClass} asChild>
                  <Link href={brandHref}>Volver a la marca</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-limbi-muted">
                  No se pudo cargar el estado del diagnóstico. Puedes abrir la página de
                  diagnóstico manualmente.
                </p>
                <Button className={limbiPrimaryButtonClass} asChild>
                  <Link href={diagnosisHref}>Ir al diagnóstico</Link>
                </Button>
                <Button variant="outline" className={limbiOutlineButtonClass} asChild>
                  <Link href={brandHref}>Volver a la marca</Link>
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {facts.length > 0 ? (
          <div className="space-y-10">
            {grouped.map(({ section_key, items }) => (
              <section key={section_key} className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-limbi-muted">
                {brandQuestionnaireSectionLabelEs(section_key)}
              </h2>
              <ul className="space-y-4">
                {items.map((f) => (
                  <li
                    key={f.id}
                    className={cn(
                      limbiDocumentCardClass,
                      "space-y-3 border border-limbi-border p-4 sm:p-5",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-limbi-bg-soft px-2 py-0.5 font-medium text-limbi-text">
                        {brandSourceFactRelationshipLabelEs(f.relationship_type)}
                      </span>
                      <span className="text-limbi-muted">
                        {brandSourceFactTypeLabelEs(f.fact_type)}
                      </span>
                    </div>

                    {f.relationship_type === "contradicts" ? (
                      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                        Este hallazgo puede ajustar o entrar en tensión con información que ya
                        habías dado. Revísalo antes de incluirlo.
                      </p>
                    ) : null}

                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-limbi-text">Dato detectado</p>
                      <p className="text-limbi-muted">{f.extracted_fact}</p>
                    </div>

                    {f.ai_interpretation ? (
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-limbi-text">Qué aporta</p>
                        <p className="text-limbi-muted">{f.ai_interpretation}</p>
                      </div>
                    ) : null}

                    {f.existing_response_summary?.trim() ? (
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-limbi-text">
                          Relación con lo que ya escribiste
                        </p>
                        <p className="text-limbi-muted">{f.existing_response_summary.trim()}</p>
                      </div>
                    ) : null}

                    <p className="text-xs text-limbi-muted">
                      <span className="font-medium text-limbi-text">Fuente: </span>
                      {f.source_document_name ?? "Documento de marca"}
                    </p>

                    {editingId === f.id ? (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-limbi-text" htmlFor={`edit-${f.id}`}>
                          Texto a incluir
                        </label>
                        <textarea
                          id={`edit-${f.id}`}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={5}
                          className="w-full rounded-xl border border-limbi-border bg-limbi-surface px-3 py-2 text-sm text-limbi-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className={limbiPrimaryButtonClass}
                            disabled={Boolean(actionId)}
                            onClick={() =>
                              void patchFact(f.id, {
                                action: "approve_with_edit",
                                user_edited_text: editText.trim(),
                              })
                            }
                          >
                            Guardar e incluir
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={limbiOutlineButtonClass}
                            disabled={Boolean(actionId)}
                            onClick={() => setEditingId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-limbi-text">Propuesta de inclusión</p>
                        <p className="whitespace-pre-wrap text-limbi-muted">{f.proposed_inclusion}</p>
                      </div>
                    )}

                    {editingId !== f.id ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          className={limbiPrimaryButtonClass}
                          disabled={Boolean(actionId)}
                          onClick={() => void patchFact(f.id, { action: "approve" })}
                        >
                          {actionId === f.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : null}
                          Incluir
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={limbiOutlineButtonClass}
                          disabled={Boolean(actionId)}
                          onClick={() => {
                            setEditingId(f.id);
                            setEditText(f.proposed_inclusion);
                          }}
                        >
                          Editar e incluir
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={limbiOutlineButtonClass}
                          disabled={Boolean(actionId)}
                          onClick={() => void patchFact(f.id, { action: "reject" })}
                        >
                          Descartar
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              </section>
            ))}
          </div>
        ) : null}

        {!loading && facts.length > 0 ? (
          <p className="border-t border-limbi-border pt-4 text-xs text-limbi-muted">
            Lo que apruebes quedará disponible como fuente curada para el diagnóstico de
            marca en etapas posteriores. Los hallazgos pendientes o rechazados no se usan
            como fuente curada.
          </p>
        ) : null}
      </div>
    </div>
  );
}
