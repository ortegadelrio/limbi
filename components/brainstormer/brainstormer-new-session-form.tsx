"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { limbiDocumentCardClass, limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import { DEFAULT_THINKING_MODEL_KEY, type ThinkingModelKey } from "@/lib/ai/thinking-models";
import { ThinkingModelSelector } from "@/components/brainstormer/thinking-model-selector";

type BrandOption = { id: string; name: string };

type Readiness = {
  brand_context_status: "ready" | "advisory" | "blocked";
  can_start: boolean;
  advisory_notice: string | null;
  blocked_message: string | null;
  recommended_warning: string | null;
  default_session_title: string;
};

export function BrainstormerNewSessionForm() {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandId, setBrandId] = useState("");
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [thinkingModelKey, setThinkingModelKey] = useState<ThinkingModelKey>(
    DEFAULT_THINKING_MODEL_KEY,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/brands");
        if (!res.ok) throw new Error("No se pudieron cargar las marcas.");
        const j = (await res.json()) as { brands: { id: string; name: string }[] };
        if (!cancelled) {
          setBrands(
            (j.brands ?? []).map((b) => ({
              id: b.id,
              name: String(b.name ?? "").trim() || "Marca",
            })),
          );
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar marcas.");
      } finally {
        if (!cancelled) setBrandsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadReadiness = useCallback(async (id: string) => {
    if (!id) {
      setReadiness(null);
      return;
    }
    setReadinessLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/brainstormer/brands/${id}/session-readiness`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "No se pudo evaluar la marca.");
      }
      const j = (await res.json()) as Readiness;
      setReadiness(j);
      setTitle((t) => (t.trim() ? t : j.default_session_title));
    } catch (e) {
      setReadiness(null);
      setError(e instanceof Error ? e.message : "Error de red.");
    } finally {
      setReadinessLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReadiness(brandId);
  }, [brandId, loadReadiness]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandId || !readiness?.can_start) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/brainstormer/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId,
          title: title.trim() || undefined,
          initial_user_message: initialMessage.trim() || undefined,
          thinking_model_key: thinkingModelKey,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        session?: { id: string };
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        throw new Error(j.error ?? "No se pudo crear la sesión.");
      }
      if (!j.session?.id) throw new Error("Respuesta inválida del servidor.");
      router.push(`/brainstormer/${j.session.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear.");
    } finally {
      setSubmitting(false);
    }
  }

  const advisoryFromPrep =
    readiness?.brand_context_status === "advisory"
      ? "Hay información pendiente o señales de desactualización. Puedes continuar usando la versión actual de la marca, pero conviene revisar la base más adelante."
      : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 gap-1 rounded-xl" asChild>
        <Link href="/brainstormer">
          <ArrowLeft className="size-4" aria-hidden />
          Brainstormer
        </Link>
      </Button>

      <div className={cn(limbiDocumentCardClass, "p-6 sm:p-8")}>
        <header className="mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
            Brainstormer
          </p>
          <h1 className="font-heading text-2xl font-semibold text-limbi-text">Nueva sesión</h1>
          <p className="text-sm text-limbi-muted">
            Elegí una marca con Base de Marca activa. El contexto queda fijado a la versión vigente
            al crear la sesión.
          </p>
        </header>

        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-limbi-text" htmlFor="brand">
              Marca
            </label>
            <select
              id="brand"
              className="w-full rounded-xl border border-limbi-border bg-limbi-surface px-3 py-2.5 text-sm text-limbi-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35"
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setTitle("");
              }}
              disabled={brandsLoading || brands.length === 0}
            >
              <option value="">
                {brandsLoading ? "Cargando marcas…" : "Seleccioná una marca"}
              </option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {!brandsLoading && brands.length === 0 ? (
              <p className="text-sm text-limbi-muted">
                No tenés marcas todavía.{" "}
                <Link href="/brands/new" className="text-limbi-green underline-offset-2 hover:underline">
                  Crear una marca
                </Link>
                .
              </p>
            ) : null}
          </div>

          {brandId ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-limbi-text">Estado de la Base de Marca</p>
              {readinessLoading ? (
                <p className="flex items-center gap-2 text-sm text-limbi-muted">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Evaluando bases activas…
                </p>
              ) : readiness ? (
                <div className="rounded-xl border border-limbi-border bg-limbi-bg-soft/40 px-3 py-2.5 text-sm">
                  {readiness.brand_context_status === "ready" && readiness.can_start ? (
                    <span className="text-limbi-green">Lista para iniciar.</span>
                  ) : null}
                  {readiness.brand_context_status === "advisory" && readiness.can_start ? (
                    <span className="text-amber-700 dark:text-amber-300">
                      Con advertencias — podés iniciar.
                    </span>
                  ) : null}
                  {readiness.brand_context_status === "blocked" || !readiness.can_start ? (
                    <span className="text-red-700 dark:text-red-300">
                      Bloqueada — no se puede iniciar.
                    </span>
                  ) : null}
                </div>
              ) : null}
              {readiness?.blocked_message ? (
                <p className="text-sm leading-relaxed text-limbi-muted">{readiness.blocked_message}</p>
              ) : null}
              {advisoryFromPrep && readiness?.can_start ? (
                <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200/90">
                  {advisoryFromPrep}
                </p>
              ) : null}
              {readiness?.recommended_warning && readiness.can_start ? (
                <p className="text-xs leading-relaxed text-limbi-muted whitespace-pre-wrap">
                  {readiness.recommended_warning}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-limbi-text" htmlFor="title">
              Título de la sesión{" "}
              <span className="font-normal text-limbi-muted">(opcional)</span>
            </label>
            <input
              id="title"
              type="text"
              maxLength={500}
              className="w-full rounded-xl border border-limbi-border bg-limbi-surface px-3 py-2.5 text-sm text-limbi-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Se usará un título provisional si lo dejás vacío"
            />
          </div>

          <ThinkingModelSelector value={thinkingModelKey} onChange={setThinkingModelKey} />

          <div className="space-y-2">
            <label className="text-sm font-medium text-limbi-text" htmlFor="initial">
              ¿Sobre qué reto querés que pensemos hoy?{" "}
              <span className="font-normal text-limbi-muted">(opcional)</span>
            </label>
            <textarea
              id="initial"
              rows={4}
              maxLength={20_000}
              className="w-full resize-y rounded-xl border border-limbi-border bg-limbi-surface px-3 py-2.5 text-sm text-limbi-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35"
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Contá en pocas líneas el reto o la duda. Limbi te responderá después de crear la sesión."
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={!brandId || !readiness?.can_start || submitting || readinessLoading}
            className={cn("h-11 w-full sm:w-auto", limbiPrimaryButtonClass)}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Creando…
              </>
            ) : (
              "Crear sesión"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
