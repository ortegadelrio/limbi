"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CHALLENGE_TYPE_OPTIONS,
  MAIN_CHALLENGE_OPTIONS,
} from "@/lib/constants/wizard";
import { projectStatusLabel } from "@/lib/constants/project-status";
import {
  buildListContext,
  deriveListNextActionSummary,
  deriveListUrgencyChip,
  listChipLabel,
  type ProjectListStatusSnapshot,
} from "@/components/projects/system-status-utils";
import { cn } from "@/lib/utils";
import {
  limbiDocumentCardClass,
  limbiLoadingMessage,
  limbiMetricCellClass,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";

type ProjectRow = {
  id: string;
  name_or_descriptor: string;
  name_status: string;
  challenge_type: string | null;
  main_challenge: string | null;
  status: string;
  updated_at: string;
};

function labelFromOptions(
  value: string | null | undefined,
  options: readonly { value: string; label: string }[],
): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

function formatUpdatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es", {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const EMPTY_COUNTS = {
  short_pitch: 0,
  captions: 0,
  content_ideas: 0,
  graphic_phrases: 0,
} as const;

async function fetchProjectStatusSnapshot(
  projectId: string,
): Promise<ProjectListStatusSnapshot | null> {
  try {
    const res = await fetch(`/api/projects/${projectId}/status`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    return {
      has_completed_wizard: Boolean(j.has_completed_wizard),
      active_master_document: j.active_master_document ?? null,
      input_quality_assessment:
        j.input_quality_assessment === undefined
          ? null
          : j.input_quality_assessment,
      responses_have_changed_since_master:
        typeof j.responses_have_changed_since_master === "boolean"
          ? j.responses_have_changed_since_master
          : undefined,
      framework_is_outdated_since_master:
        typeof j.framework_is_outdated_since_master === "boolean"
          ? j.framework_is_outdated_since_master
          : undefined,
      latest_visible_framework:
        j.latest_visible_framework &&
        typeof j.latest_visible_framework === "object" &&
        j.latest_visible_framework !== null &&
        !Array.isArray(j.latest_visible_framework)
          ? (j.latest_visible_framework as { status: string })
          : null,
      approved_visible_framework: j.approved_visible_framework ?? null,
      generated_content_counts:
        j.generated_content_counts &&
        typeof j.generated_content_counts === "object" &&
        j.generated_content_counts !== null &&
        !Array.isArray(j.generated_content_counts)
          ? (() => {
              const c = j.generated_content_counts as Record<string, unknown>;
              const n = (v: unknown) => {
                const x = Number(v);
                return Number.isFinite(x) ? x : 0;
              };
              return {
                short_pitch: n(c.short_pitch),
                captions: n(c.captions),
                content_ideas: n(c.content_ideas),
                graphic_phrases: n(c.graphic_phrases),
              };
            })()
          : { ...EMPTY_COUNTS },
    };
  } catch {
    return null;
  }
}

function chipClass(chip: NonNullable<ReturnType<typeof deriveListUrgencyChip>>): string {
  switch (chip) {
    case "necesita_actualizacion":
      return "border-limbi-yellow/40 bg-limbi-yellow/10 text-limbi-text";
    case "listo_piezas":
      return "border-limbi-green/35 bg-limbi-green/10 text-limbi-text";
    case "marco_borrador":
      return "border-limbi-border bg-limbi-surface-soft text-limbi-text";
    case "por_construir":
      return "border-limbi-border bg-limbi-bg-soft text-limbi-muted";
    default:
      return "border-limbi-border bg-limbi-bg-soft text-limbi-muted";
  }
}

export function ProjectsList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [statusById, setStatusById] = useState<
    Record<string, ProjectListStatusSnapshot | null>
  >({});
  const [statusLoading, setStatusLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        projects?: ProjectRow[];
        error?: unknown;
      };
      if (!res.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : "No pudimos cargar tus sistemas. Revisa la conexión o vuelve a iniciar sesión.";
        throw new Error(msg);
      }
      const list = Array.isArray(json.projects) ? json.projects : [];
      setProjects(list);
      setStatusById({});
      if (list.length > 0) {
        setStatusLoading(true);
        const entries = await Promise.all(
          list.map(async (p) => {
            const snap = await fetchProjectStatusSnapshot(p.id);
            return [p.id, snap] as const;
          }),
        );
        setStatusById(Object.fromEntries(entries));
        setStatusLoading(false);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Error inesperado al cargar los sistemas.",
      );
      setProjects([]);
      setStatusById({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Card className={cn(limbiDocumentCardClass, "shadow-limbi")}>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div
            className="size-8 animate-pulse rounded-full border-2 border-limbi-border border-t-limbi-green"
            aria-hidden
          />
          <p className="text-sm text-limbi-muted">
            {limbiLoadingMessage("projects-list")}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40 shadow-none">
        <CardHeader>
          <CardTitle className="text-destructive">No se pudo cargar el listado</CardTitle>
          <CardDescription className="text-destructive/90">{error}</CardDescription>
        </CardHeader>
        <CardFooter className="border-t-0 pt-0">
          <Button type="button" variant="outline" onClick={() => void load()}>
            Reintentar
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="rounded-[22px] border-2 border-dashed border-limbi-border bg-limbi-surface/80 shadow-none">
        <CardHeader className="text-center sm:text-left">
          <CardTitle className="font-heading text-xl text-limbi-text">
            Aún no hay sistemas
          </CardTitle>
          <CardDescription>
            Crea tu primer Sistema Límbico y completa los primeros pasos del
            cuestionario.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-2 sm:justify-start">
          <Button asChild size="lg" className={cn("gap-2", limbiPrimaryButtonClass)}>
            <Link href="/projects/new">
              <PlusCircle className="size-5" aria-hidden />
              Crear Sistema Límbico
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-5">
      {projects.map((p) => {
        const snap = statusById[p.id] ?? null;
        const ctx = buildListContext(p.id, p.status, snap);
        const chip = deriveListUrgencyChip(ctx);
        const chipText = listChipLabel(chip);
        const nextSummary = deriveListNextActionSummary(ctx);
        const lecturaOk = ctx.hasActiveMaster && ctx.hasIqa && !ctx.responsesChanged;
        const marcoLabel = !ctx.hasActiveMaster
          ? "pendiente"
          : !ctx.hasAnyFramework
            ? "pendiente"
            : ctx.frameworkOutdatedSinceMaster
              ? "desactualizado"
              : ctx.latestIsDraft
                ? "borrador"
                : ctx.hasApprovedFramework
                  ? "aprobado"
                  : "en curso";
        const piezasTotal = ctx.contentPiecesTotal;

        return (
          <li key={p.id}>
            <Card
              className={cn(
                limbiDocumentCardClass,
                "overflow-hidden transition-all duration-200 hover:-translate-y-px hover:shadow-limbi-hover",
              )}
            >
              <CardHeader className="space-y-3 pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="font-heading truncate text-lg font-semibold text-limbi-text sm:text-xl">
                        {p.name_or_descriptor}
                      </CardTitle>
                      {chipText ? (
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            chipClass(chip!),
                          )}
                        >
                          {chipText}
                        </span>
                      ) : null}
                    </div>
                    <CardDescription className="text-xs text-limbi-muted sm:text-sm">
                      Actualizado {formatUpdatedAt(p.updated_at)}
                      {statusLoading ? " · sincronizando estado…" : null}
                    </CardDescription>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className={cn("shrink-0 gap-1", limbiPrimaryButtonClass)}
                  >
                    <Link href={`/projects/${p.id}`}>
                      Entrar al sistema
                      <ChevronRight className="size-4 opacity-90" aria-hidden />
                    </Link>
                  </Button>
                </div>
                <p className="text-sm text-limbi-muted">
                  <span className="font-medium text-limbi-text">
                    Reto:{" "}
                  </span>
                  {labelFromOptions(p.challenge_type, CHALLENGE_TYPE_OPTIONS)}
                  {p.main_challenge ? (
                    <>
                      {" "}
                      ·{" "}
                      {labelFromOptions(p.main_challenge, MAIN_CHALLENGE_OPTIONS)}
                    </>
                  ) : null}
                </p>
                <p className="text-sm text-limbi-text">
                  <span className="text-limbi-muted">
                    Estado del sistema:{" "}
                  </span>
                  {projectStatusLabel(p.status)}
                </p>
                <p className="text-sm leading-snug text-limbi-text">
                  <span className="text-limbi-muted">
                    Siguiente paso sugerido:{" "}
                  </span>
                  {nextSummary}
                </p>
              </CardHeader>
              <CardContent className="border-t border-limbi-border/80 pt-4">
                <div className="grid gap-2 text-sm text-limbi-muted sm:grid-cols-3">
                  <div className={limbiMetricCellClass}>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-limbi-muted">
                      Lectura Límbica
                    </span>
                    <span className="font-medium text-limbi-text">
                      {lecturaOk ? "Lista" : "Pendiente"}
                    </span>
                  </div>
                  <div className={limbiMetricCellClass}>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-limbi-muted">
                      Marco Límbico
                    </span>
                    <span className="font-medium capitalize text-limbi-text">
                      {marcoLabel}
                    </span>
                  </div>
                  <div className={limbiMetricCellClass}>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-limbi-muted">
                      Piezas narrativas
                    </span>
                    <span className="font-medium tabular-nums text-limbi-text">
                      {piezasTotal > 0
                        ? `${String(piezasTotal)} generaciones`
                        : "Ninguna aún"}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 border-t border-limbi-border/80 bg-limbi-bg-soft/50 pt-4">
                <Button variant="outline" size="sm" asChild className={limbiOutlineButtonClass}>
                  <Link href={`/projects/new?projectId=${p.id}`}>
                    Editar respuestas
                  </Link>
                </Button>
                {(p.status === "master_created" ||
                  p.status === "framework_created" ||
                  p.status === "framework_approved") && (
                  <Button variant="ghost" size="sm" className="text-limbi-text hover:bg-limbi-green/5" asChild>
                    <Link href={`/projects/${p.id}/framework`}>
                      Marco Estratégico Límbico
                    </Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
