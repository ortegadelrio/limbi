"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FrameworkPdfExportButton } from "@/components/projects/framework-pdf-export-button";
import {
  limbiDocumentCardClass,
  limbiDocumentCardHeaderClass,
  limbiLoadingMessage,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import type { RevisionHistoryEntry } from "@/lib/framework/revision-history";
/** Misma cadena que en `validate-framework-json` (aviso fijo del marco). */
const NOT_FINAL_CONTENT_WARNING =
  "Estas son oportunidades estratégicas, no piezas finales.";

const MSG_RESPONSES_STALE =
  "El sistema recibió nueva información. Actualiza su lectura antes de crear un nuevo marco.";

const MSG_MASTER_MISMATCH =
  "Este marco fue creado con una lectura anterior del sistema. Actualízalo para alinearlo con la memoria vigente.";

const MSG_RELEVANCE_IA =
  "Tu sugerencia ayuda a afinar el Marco Estratégico Límbico antes de aprobarlo. La IA la usará como una indicación de énfasis, tono o claridad, sin contradecir la base estratégica ni inventar información.";

const MSG_SUCCESS_APPLY =
  "Tu nueva sugerencia fue guardada y usada para generar otra versión del marco.";

const MSG_BASE_FROM_HISTORY =
  "Esta sugerencia se usará como punto de partida. Al aplicarla, se guardará como una nueva sugerencia sin modificar la memoria anterior.";

const MSG_APPROVED_SUGGESTION_DRAFT =
  "Esta sugerencia creará un nuevo borrador. El Marco Estratégico Límbico aprobado seguirá siendo la versión oficial hasta que apruebes el nuevo borrador.";

const MSG_HISTORY_BLOCKED_BY_BASE =
  "No puedes añadir nuevas sugerencias ni actualizar el Marco Estratégico Límbico desde aquí hasta actualizar la Lectura Límbica en el sistema. La memoria de ajustes muestra cambios anteriores.";

const MSG_TRACE =
  "Última sugerencia aplicada: guardada en la memoria de ajustes del sistema.";

const MSG_MARCO_MUST_REFRESH_BEFORE_APPROVE =
  "Este Marco necesita actualizarse antes de aprobarse.";

const FINAL_REVIEW_SECTION_TITLE = "Revisión final del Marco";
const FINAL_REVIEW_SECTION_INTRO =
  "Después de revisar el Marco completo, puedes aprobarlo para crear piezas narrativas o dejar una sugerencia editorial para generar una nueva versión.";
const SUGGESTION_MEMORY_HELP =
  "Tu sugerencia se guardará en la memoria de ajustes del sistema y se usará para crear una nueva versión del Marco.";
const HISTORY_SECTION_INTRO =
  "Aquí queda el rastro de las sugerencias que se han usado para generar nuevas versiones del Marco.";

const APPLYING_SUGGESTION =
  "Aplicando tu sugerencia al Marco Estratégico Límbico…";

type FrameworkPayload = Record<string, unknown>;

type VisibleFrameworkRow = {
  id: string;
  project_id: string;
  master_document_id: string | null;
  version: number;
  status: string;
  created_at: string;
  framework: FrameworkPayload;
};

type ProjectDetail = {
  id: string;
  status: string;
};

function readRecord(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  return obj as Record<string, unknown>;
}

function readString(obj: unknown, key: string): string {
  const v = readRecord(obj)[key];
  return typeof v === "string" ? v : "";
}

function readStringArray(obj: unknown, key: string): string[] {
  const v = readRecord(obj)[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

type ConceptualAxis = {
  axis_title: string;
  strategic_meaning: string;
  narrative_use: string;
};

function readConceptualAxes(ns: unknown): {
  axes: ConceptualAxis[];
  hadLegacyStringAxes: boolean;
} {
  const raw = readRecord(ns).conceptual_axes;
  if (!Array.isArray(raw)) return { axes: [], hadLegacyStringAxes: false };
  let hadLegacyStringAxes = false;
  const axes: ConceptualAxis[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      hadLegacyStringAxes = true;
      continue;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const axis_title = typeof o.axis_title === "string" ? o.axis_title.trim() : "";
    const strategic_meaning =
      typeof o.strategic_meaning === "string" ? o.strategic_meaning.trim() : "";
    const narrative_use =
      typeof o.narrative_use === "string" ? o.narrative_use.trim() : "";
    if (axis_title || strategic_meaning || narrative_use) {
      axes.push({ axis_title, strategic_meaning, narrative_use });
    }
  }
  return { axes, hadLegacyStringAxes };
}

function isNewVisibleFramework(fw: Record<string, unknown>): boolean {
  return (
    typeof fw.executive_summary === "string" &&
    fw.executive_summary.trim().length > 0 &&
    typeof fw.strategic_diagnosis === "object" &&
    fw.strategic_diagnosis !== null &&
    !Array.isArray(fw.strategic_diagnosis)
  );
}

function isLegacyVisibleFramework(fw: Record<string, unknown>): boolean {
  return !isNewVisibleFramework(fw);
}

function statusBadgeLabel(status: string): string {
  if (status === "draft") return "Borrador";
  if (status === "approved") return "Aprobado";
  if (status === "archived") return "Archivado";
  return status;
}

function canOfferGenerateMarco(projectStatus: string | undefined): boolean {
  if (!projectStatus) return false;
  return (
    projectStatus === "master_created" ||
    projectStatus === "framework_created" ||
    projectStatus === "framework_approved"
  );
}

type Props = {
  projectId: string;
  projectDisplayName: string;
  userDisplayName: string;
};

function parseRevisionHistory(raw: unknown): RevisionHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: RevisionHistoryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const revision_note_event_id =
      typeof o.revision_note_event_id === "string"
        ? o.revision_note_event_id
        : "";
    const revision_note =
      typeof o.revision_note === "string" ? o.revision_note : "";
    const source_framework_id =
      typeof o.source_framework_id === "string" ? o.source_framework_id : "";
    const new_framework_id =
      typeof o.new_framework_id === "string" ? o.new_framework_id : "";
    const source_framework_version =
      typeof o.source_framework_version === "number" &&
      Number.isFinite(o.source_framework_version)
        ? o.source_framework_version
        : 0;
    const new_framework_version =
      typeof o.new_framework_version === "number" &&
      Number.isFinite(o.new_framework_version)
        ? o.new_framework_version
        : 0;
    const created_at =
      typeof o.created_at === "string" ? o.created_at : "";
    if (!source_framework_id || !new_framework_id) continue;
    out.push({
      revision_note_event_id,
      revision_note,
      source_framework_id,
      source_framework_version,
      new_framework_id,
      new_framework_version,
      created_at,
    });
  }
  return out;
}

function formatHistoryDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function previewNote(text: string, max = 160): string {
  const t = text.trim();
  if (t.length <= max) return t || "—";
  return `${t.slice(0, max)}…`;
}

export function FrameworkPageClient({
  projectId,
  projectDisplayName,
  userDisplayName,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<VisibleFrameworkRow | null | undefined>(
    undefined,
  );
  const [projectStatus, setProjectStatus] = useState<string | undefined>();
  const [regenerating, setRegenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [responsesChangedSinceMaster, setResponsesChangedSinceMaster] =
    useState<boolean | null>(null);
  const [frameworkOutdatedSinceMaster, setFrameworkOutdatedSinceMaster] =
    useState<boolean | null>(null);
  const [revisionDraft, setRevisionDraft] = useState("");
  const [applySuggestionBusy, setApplySuggestionBusy] = useState(false);
  const [applyFlowHint, setApplyFlowHint] = useState<string | null>(null);
  const [suggestionSuccessMessage, setSuggestionSuccessMessage] = useState<
    string | null
  >(null);
  const [showSuggestionTraceLine, setShowSuggestionTraceLine] =
    useState(false);
  const [revisionHistory, setRevisionHistory] = useState<RevisionHistoryEntry[]>(
    [],
  );
  const [applyFromHistoryMode, setApplyFromHistoryMode] = useState(false);
  const [baseFromHistoryNotice, setBaseFromHistoryNotice] = useState<
    string | null
  >(null);
  const [hasPersistedRevisionNoteOnMarco, setHasPersistedRevisionNoteOnMarco] =
    useState(false);

  const finalReviewRef = useRef<HTMLDivElement>(null);

  const scrollToFinalReview = useCallback(() => {
    finalReviewRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fwRes, projRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/framework`, {
          credentials: "include",
        }),
        fetch(`/api/projects/${projectId}`, { credentials: "include" }),
      ]);

      const fwJson = (await fwRes.json().catch(() => ({}))) as {
        visible_framework?: VisibleFrameworkRow | null;
        latest_revision_note?: string | null;
        revision_history?: unknown;
        responses_have_changed_since_master?: boolean;
        framework_is_outdated_since_master?: boolean;
        error?: unknown;
      };
      if (!fwRes.ok) {
        const msg =
          typeof fwJson.error === "string"
            ? fwJson.error
            : "No se pudo cargar el marco.";
        throw new Error(msg);
      }

      const projJson = (await projRes.json().catch(() => ({}))) as {
        project?: ProjectDetail;
        error?: unknown;
      };
      if (!projRes.ok) {
        const msg =
          typeof projJson.error === "string"
            ? projJson.error
            : "No se pudo cargar el sistema.";
        throw new Error(msg);
      }
      if (!projJson.project?.status) {
        throw new Error("Respuesta del sistema inválida.");
      }
      setProjectStatus(projJson.project.status);

      setRow(fwJson.visible_framework ?? null);
      setResponsesChangedSinceMaster(
        typeof fwJson.responses_have_changed_since_master === "boolean"
          ? fwJson.responses_have_changed_since_master
          : null,
      );
      setFrameworkOutdatedSinceMaster(
        typeof fwJson.framework_is_outdated_since_master === "boolean"
          ? fwJson.framework_is_outdated_since_master
          : null,
      );
      setRevisionHistory(parseRevisionHistory(fwJson.revision_history));
      setApplyFromHistoryMode(false);
      setBaseFromHistoryNotice(null);
      const lr = fwJson.latest_revision_note;
      setHasPersistedRevisionNoteOnMarco(
        typeof lr === "string" && lr.trim().length > 0,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Error al cargar el Marco Estratégico Límbico.",
      );
      setRow(undefined);
      setHasPersistedRevisionNoteOnMarco(false);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Solo marcos legacy: regeneración sin sugerencia (cuerpo vacío). */
  const handleLegacyRegenerate = async () => {
    if (!row) return;
    if (row.status === "approved") {
      const confirmed = window.confirm(
        "Actualizar creará un nuevo borrador del Marco Estratégico Límbico. El marco aprobado seguirá siendo la versión oficial hasta que apruebes el nuevo borrador. ¿Quieres continuar?",
      );
      if (!confirmed) return;
    }
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/generate-framework`,
        { method: "POST", credentials: "include" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: unknown;
      };
      if (!res.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : "No se pudo actualizar el Marco Estratégico Límbico.";
        throw new Error(msg);
      }
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Error al actualizar el Marco Estratégico Límbico.",
      );
    } finally {
      setRegenerating(false);
    }
  };

  const handleApplySuggestionAndRegenerate = async () => {
    if (!row?.id) return;
    const trimmed = revisionDraft.trim();
    if (trimmed.length < 10) {
      setError("La sugerencia debe tener al menos 10 caracteres.");
      return;
    }
    setApplySuggestionBusy(true);
    setError(null);
    setApplyFlowHint(null);
    setSuggestionSuccessMessage(null);
    setShowSuggestionTraceLine(false);
    try {
      const noteRes = await fetch(
        `/api/projects/${projectId}/framework/${row.id}/revision-note`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision_note: trimmed }),
        },
      );
      const noteJson = (await noteRes.json().catch(() => ({}))) as {
        event?: { id?: unknown };
        error?: unknown;
      };
      if (!noteRes.ok) {
        const msg =
          typeof noteJson.error === "string"
            ? noteJson.error
            : "No se pudo guardar la sugerencia.";
        throw new Error(msg);
      }
      const eventId = noteJson.event?.id;
      if (typeof eventId !== "string" || eventId.length === 0) {
        throw new Error(
          "Respuesta del servidor incompleta al guardar la sugerencia.",
        );
      }

      setApplyFlowHint(MSG_RELEVANCE_IA);
      await new Promise((resolve) => setTimeout(resolve, 350));
      setApplyFlowHint(APPLYING_SUGGESTION);
      const genRes = await fetch(
        `/api/projects/${projectId}/generate-framework`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_framework_id: row.id,
            revision_note_event_id: eventId,
          }),
        },
      );
      const genJson = (await genRes.json().catch(() => ({}))) as {
        error?: unknown;
      };
      if (!genRes.ok) {
        const msg =
          typeof genJson.error === "string"
            ? genJson.error
            : "No se pudo generar el Marco Estratégico Límbico con tu sugerencia.";
        throw new Error(msg);
      }

      setApplyFlowHint(null);
      setRevisionDraft("");
      setApplyFromHistoryMode(false);
      setBaseFromHistoryNotice(null);
      setSuggestionSuccessMessage(MSG_SUCCESS_APPLY);
      setShowSuggestionTraceLine(true);
      await load();
    } catch (e) {
      setApplyFlowHint(null);
      setError(
        e instanceof Error
          ? e.message
          : "Error al aplicar la sugerencia al Marco Límbico.",
      );
    } finally {
      setApplySuggestionBusy(false);
      setApplyFlowHint(null);
    }
  };

  const handleUseSuggestionAsBase = (entry: RevisionHistoryEntry) => {
    setRevisionDraft(entry.revision_note);
    setApplyFromHistoryMode(true);
    setBaseFromHistoryNotice(MSG_BASE_FROM_HISTORY);
    setSuggestionSuccessMessage(null);
    setShowSuggestionTraceLine(false);
    setError(null);
  };

  const handleApprove = async () => {
    if (!row?.id || row.status !== "draft") return;
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/framework/${row.id}/approve`,
        { method: "POST", credentials: "include" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: unknown;
      };
      if (res.status === 400 || res.status === 409) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : "No se pudo aprobar el Marco Estratégico Límbico.";
        throw new Error(msg);
      }
      if (!res.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : "No se pudo aprobar el Marco Estratégico Límbico.";
        throw new Error(msg);
      }
      router.push(`/projects/${projectId}/content`);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Error al aprobar el Marco Estratégico Límbico.",
      );
    } finally {
      setApproving(false);
    }
  };

  const handleGenerateFirst = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/generate-framework`,
        { method: "POST", credentials: "include" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: unknown;
      };
      if (!res.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : "No se pudo crear el Marco Estratégico Límbico.";
        throw new Error(msg);
      }
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Error al crear el Marco Estratégico Límbico.",
      );
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <Card
        className={cn(
          "border-dashed border-limbi-border bg-limbi-bg-soft/70 shadow-limbi",
        )}
      >
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Loader2
            className="size-8 animate-spin text-limbi-green"
            aria-hidden
          />
          <p className="text-sm text-limbi-muted">
            {limbiLoadingMessage(`framework-${projectId}`)}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!loading && error && row === undefined) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">
            No se pudo cargar el Marco Estratégico Límbico
          </CardTitle>
          <CardDescription className="text-destructive/90">
            {error}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void load()}>
            Reintentar
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}`}>
              <ArrowLeft className="size-4" aria-hidden />
              Volver al sistema
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (row === null) {
    const canGenerate = canOfferGenerateMarco(projectStatus);
    return (
      <div className="flex flex-col gap-6">
        <Card className="border-dashed border-limbi-border bg-limbi-bg-soft/70 shadow-limbi">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-limbi-border/80 bg-limbi-surface-soft">
                <BookOpen className="size-5 text-limbi-muted" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-xl">Aún no hay marco visible</CardTitle>
                <CardDescription className="mt-2 text-base leading-relaxed">
                  {canGenerate
                    ? "Crea el Marco Estratégico Límbico a partir de tu Lectura Límbica activa."
                    : "Primero necesitas una Lectura Límbica activa. Cuando esté lista, podrás crear el marco visible aquí."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canGenerate ? (
              <Button
                type="button"
                className={cn("gap-2", limbiPrimaryButtonClass)}
                disabled={regenerating}
                onClick={() => void handleGenerateFirst()}
              >
                {regenerating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                Crear Marco Estratégico Límbico
              </Button>
            ) : null}
            <Button variant="outline" asChild className={limbiOutlineButtonClass}>
              <Link href={`/projects/${projectId}`}>
                <ArrowLeft className="size-4" aria-hidden />
                Volver al sistema
              </Link>
            </Button>
            {canGenerate ? (
              <Button variant="outline" asChild className={limbiOutlineButtonClass}>
                <Link href={`/projects/new?projectId=${projectId}`}>
                  Continuar cuestionario
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (!row) {
    return null;
  }

  const fw = row.framework;
  const legacy = isLegacyVisibleFramework(fw);
  const { hadLegacyStringAxes: legacyConceptualAxesStrings } = readConceptualAxes(
    readRecord(fw.narrative_strategy),
  );
  const cannotApproveDraft =
    row.status === "draft" && (legacy || legacyConceptualAxesStrings);

  const responsesStale = responsesChangedSinceMaster === true;
  const masterStale = frameworkOutdatedSinceMaster === true;
  const marcoStaleForApprove = responsesStale || masterStale;

  const showRevisionNoteSection =
    !legacy &&
    !legacyConceptualAxesStrings &&
    row.status !== "archived" &&
    !responsesStale &&
    !masterStale;

  const showLegacyRegenerateButton =
    row.status !== "archived" && (legacy || legacyConceptualAxesStrings);

  const showHistorySection =
    !legacy &&
    !legacyConceptualAxesStrings &&
    row.status !== "archived";

  const marcoNeedsRefreshBeforeApprove = responsesStale || masterStale;
  const showApprovedPdfExport =
    row.status === "approved" && !marcoNeedsRefreshBeforeApprove;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-limbi-border/80 pb-4">
        <span className="inline-flex items-center rounded-full border border-limbi-border bg-limbi-bg-soft px-3 py-1 text-xs font-medium text-limbi-text">
          {statusBadgeLabel(row.status)}
        </span>
        <span className="inline-flex items-center rounded-full border border-limbi-border bg-limbi-surface px-3 py-1 text-xs font-medium text-limbi-muted">
          v{row.version}
        </span>
      </div>

      {marcoNeedsRefreshBeforeApprove ? (
        <Card className="border-limbi-yellow/35 bg-limbi-yellow/8 shadow-limbi">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg text-limbi-text">
              {MSG_MARCO_MUST_REFRESH_BEFORE_APPROVE}
            </CardTitle>
            <CardDescription className="text-base leading-relaxed text-limbi-muted">
              {responsesStale ? MSG_RESPONSES_STALE : MSG_MASTER_MISMATCH}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className={cn(limbiPrimaryButtonClass)} asChild>
              <Link href={`/projects/${projectId}`}>Volver al sistema</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {row.status === "archived" ? (
        <Card className="border-limbi-border bg-limbi-bg-soft/80 shadow-limbi">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-foreground">
              Marco Límbico archivado
            </CardTitle>
            <CardDescription className="text-base leading-relaxed text-muted-foreground">
              Este marco fue reemplazado por una versión posterior.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {cannotApproveDraft ? (
        <Card className="rounded-[22px] border border-limbi-yellow/40 bg-limbi-yellow/8 shadow-limbi">
          <CardHeader>
            <CardTitle className="font-heading text-lg text-limbi-text">
              No se puede aprobar este marco
            </CardTitle>
            <div className="space-y-3 text-base leading-relaxed text-limbi-muted">
              <p className="font-medium text-limbi-text">
                Este marco fue generado con una versión anterior. Regenera el
                marco para poder aprobarlo.
              </p>
              {legacy ? (
                <p>
                  Este documento usa la estructura antigua del marco; al
                  regenerar verás el esquema estratégico actualizado.
                </p>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild className={limbiOutlineButtonClass}>
              <Link href={`/projects/${projectId}`}>
                <ArrowLeft className="size-4" aria-hidden />
                Volver al sistema
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {row.status !== "archived" && !marcoNeedsRefreshBeforeApprove ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {row.status === "approved" ? (
            <>
              <Button size="lg" className={cn(limbiPrimaryButtonClass)} asChild>
                <Link href={`/projects/${projectId}/content`}>
                  Ir a Piezas narrativas
                </Link>
              </Button>
              {showApprovedPdfExport ? (
                <FrameworkPdfExportButton
                  framework={fw}
                  version={row.version}
                  projectDisplayName={projectDisplayName}
                  userDisplayName={userDisplayName}
                  className="h-10 shrink-0"
                />
              ) : null}
              <Button variant="outline" asChild className={limbiOutlineButtonClass}>
                <Link href={`/projects/${projectId}`}>
                  <ArrowLeft className="size-4" aria-hidden />
                  Volver al sistema
                </Link>
              </Button>
            </>
          ) : row.status === "draft" && !cannotApproveDraft ? (
            <>
              <Button variant="outline" asChild className={limbiOutlineButtonClass}>
                <Link href={`/projects/${projectId}`}>
                  <ArrowLeft className="size-4" aria-hidden />
                  Volver al sistema
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto gap-1 px-2 py-1.5 text-sm font-normal text-limbi-green underline decoration-limbi-green/40 underline-offset-4 hover:bg-limbi-green/10"
                disabled={regenerating || applySuggestionBusy}
                onClick={scrollToFinalReview}
              >
                Ir al bloque de aprobación final
              </Button>
            </>
          ) : row.status === "draft" && cannotApproveDraft && showLegacyRegenerateButton ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={regenerating || approving || applySuggestionBusy}
              onClick={() => void handleLegacyRegenerate()}
            >
              {regenerating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              Actualizar Marco Estratégico Límbico
            </Button>
          ) : null}
          {showLegacyRegenerateButton && !marcoNeedsRefreshBeforeApprove && !cannotApproveDraft ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2 sm:ml-0"
              disabled={regenerating || approving || applySuggestionBusy}
              onClick={() => void handleLegacyRegenerate()}
            >
              {regenerating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              Actualizar Marco Estratégico Límbico
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {legacy ? (
        <LegacyFrameworkBody fw={fw} />
      ) : (
        <NewFrameworkBody fw={fw} />
      )}

      {row.status !== "archived" ? (
      <section
        ref={finalReviewRef}
        id="revision-final-marco"
        aria-labelledby="revision-final-heading"
        className="scroll-mt-28 space-y-8 border-t border-limbi-border/80 pt-10"
      >
        <h2
          id="revision-final-heading"
          className="font-heading text-xl font-semibold tracking-tight text-limbi-text"
        >
          {FINAL_REVIEW_SECTION_TITLE}
        </h2>

        {marcoNeedsRefreshBeforeApprove ? (
          <>
            <Card className="border-limbi-yellow/35 bg-limbi-yellow/8 shadow-limbi">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-lg text-limbi-text">
                  {MSG_MARCO_MUST_REFRESH_BEFORE_APPROVE}
                </CardTitle>
                <CardDescription className="text-base leading-relaxed text-limbi-muted">
                  {responsesStale ? MSG_RESPONSES_STALE : MSG_MASTER_MISMATCH}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className={cn(limbiPrimaryButtonClass)} asChild>
                  <Link href={`/projects/${projectId}`}>Volver al sistema</Link>
                </Button>
              </CardContent>
            </Card>
            {showHistorySection ? (
              <Card className="rounded-[22px] border border-limbi-border bg-limbi-surface shadow-limbi">
                <CardHeader className="pb-2">
                  <CardTitle className="font-heading text-base font-semibold text-limbi-text">
                    Memoria de ajustes del sistema
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed text-limbi-muted">
                    {HISTORY_SECTION_INTRO}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {responsesStale ? (
                    <p className="rounded-xl border border-limbi-yellow/40 bg-limbi-yellow/10 px-3 py-2 text-sm leading-relaxed text-limbi-text">
                      {MSG_HISTORY_BLOCKED_BY_BASE}
                    </p>
                  ) : null}
                  {revisionHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aún no hay sugerencias aplicadas en el historial.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-4">
                      {revisionHistory.map((entry, index) => (
                        <li
                          key={`${entry.revision_note_event_id}-${entry.created_at}-${entry.new_framework_id}`}
                          className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-1">
                              {index === 0 ? (
                                <p className="text-xs font-semibold uppercase tracking-wide text-limbi-green">
                                  Última sugerencia aplicada
                                </p>
                              ) : null}
                              <p className="text-xs text-muted-foreground">
                                Fecha: {formatHistoryDate(entry.created_at)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Marco fuente: v{entry.source_framework_version} ·
                                Generada: v{entry.new_framework_version}
                              </p>
                              <p className="mt-2 text-sm leading-relaxed text-foreground">
                                {previewNote(entry.revision_note)}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}

        {!marcoNeedsRefreshBeforeApprove && row.status === "approved" ? (
          <div className="space-y-6">
            <Card className="rounded-[22px] border border-limbi-green/30 bg-limbi-green/6 shadow-limbi">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-lg text-limbi-text">
                  Marco aprobado
                </CardTitle>
                <CardDescription className="text-base leading-relaxed text-limbi-muted">
                  Este Marco Estratégico Límbico ya está aprobado y puede usarse
                  como base para crear piezas narrativas.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button size="lg" className={cn(limbiPrimaryButtonClass)} asChild>
                  <Link href={`/projects/${projectId}/content`}>
                    Ir a Piezas narrativas
                  </Link>
                </Button>
                {showApprovedPdfExport ? (
                  <FrameworkPdfExportButton
                    framework={fw}
                    version={row.version}
                    projectDisplayName={projectDisplayName}
                    userDisplayName={userDisplayName}
                    className="h-10 shrink-0"
                  />
                ) : null}
                <Button variant="outline" asChild className={limbiOutlineButtonClass}>
                  <Link href={`/projects/${projectId}`}>
                    <ArrowLeft className="size-4" aria-hidden />
                    Volver al sistema
                  </Link>
                </Button>
              </CardContent>
            </Card>
            {showRevisionNoteSection ? (
              <Card className="rounded-[22px] border border-limbi-border bg-limbi-surface shadow-limbi">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    Sugerencia para una nueva versión
                  </CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    Opcional: si quieres un nuevo borrador del Marco, deja una
                    sugerencia editorial. No sustituye la Lectura Límbica ni la
                    evidencia.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {hasPersistedRevisionNoteOnMarco ? (
                    <p className="text-xs text-muted-foreground">
                      Última sugerencia vigente del marco: guardada en la memoria
                      de ajustes del sistema.
                    </p>
                  ) : null}
                  <p className="rounded-xl border border-limbi-border bg-limbi-surface-soft px-3 py-2 text-sm leading-relaxed text-limbi-text">
                    {MSG_APPROVED_SUGGESTION_DRAFT}
                  </p>
                  {baseFromHistoryNotice ? (
                    <p
                      className="rounded-xl border border-limbi-border bg-limbi-bg-soft px-3 py-2 text-sm leading-relaxed text-limbi-text"
                      role="status"
                    >
                      {baseFromHistoryNotice}
                    </p>
                  ) : null}
                  {suggestionSuccessMessage ? (
                    <p
                      className="rounded-xl border border-limbi-green/35 bg-limbi-green/10 px-3 py-2 text-sm text-limbi-text"
                      role="status"
                    >
                      {suggestionSuccessMessage}
                    </p>
                  ) : null}
                  {showSuggestionTraceLine ? (
                    <p className="text-sm text-muted-foreground" role="status">
                      {MSG_TRACE}
                    </p>
                  ) : null}
                  {applyFlowHint ? (
                    <p
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                      role="status"
                      aria-live="polite"
                    >
                      {applySuggestionBusy ? (
                        <Loader2
                          className="mt-0.5 size-4 shrink-0 animate-spin"
                          aria-hidden
                        />
                      ) : null}
                      {applyFlowHint}
                    </p>
                  ) : null}
                  <Textarea
                    value={revisionDraft}
                    onChange={(e) => {
                      setRevisionDraft(e.target.value);
                      setSuggestionSuccessMessage(null);
                      setShowSuggestionTraceLine(false);
                    }}
                    rows={5}
                    placeholder="Mínimo 10 caracteres…"
                    disabled={applySuggestionBusy}
                  />
                  <p className="text-xs text-muted-foreground">{MSG_RELEVANCE_IA}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={applySuggestionBusy || regenerating || approving}
                      className={cn("gap-2", limbiOutlineButtonClass)}
                      onClick={() => void handleApplySuggestionAndRegenerate()}
                    >
                      {applySuggestionBusy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : null}
                      {applyFromHistoryMode
                        ? "Aplicar nueva sugerencia y generar versión"
                        : "Aplicar sugerencia y generar nueva versión"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        {!marcoNeedsRefreshBeforeApprove &&
        row.status === "draft" &&
        !cannotApproveDraft ? (
          <div className="space-y-8">
            <p className="text-sm leading-relaxed text-limbi-muted">
              {FINAL_REVIEW_SECTION_INTRO}
            </p>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-limbi-muted">
                Aprobar
              </h3>
              <Button
                type="button"
                size="lg"
                className={cn(limbiPrimaryButtonClass)}
                disabled={
                  approving ||
                  regenerating ||
                  applySuggestionBusy ||
                  marcoStaleForApprove
                }
                onClick={() => void handleApprove()}
              >
                {approving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Aprobar Marco y crear piezas narrativas
              </Button>
            </div>
            {showRevisionNoteSection ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-limbi-muted">
                  Sugerencia editorial
                </h3>
                <p className="text-sm text-limbi-text">
                  {SUGGESTION_MEMORY_HELP}
                </p>
                <p className="text-xs text-muted-foreground">{MSG_RELEVANCE_IA}</p>
                <Card className="rounded-[22px] border border-limbi-border bg-limbi-surface shadow-limbi">
                  <CardContent className="flex flex-col gap-3 pt-6">
                    {hasPersistedRevisionNoteOnMarco ? (
                      <p className="text-xs text-muted-foreground">
                        Última sugerencia vigente del marco: guardada en la
                        memoria de ajustes del sistema.
                      </p>
                    ) : null}
                    {baseFromHistoryNotice ? (
                      <p
                        className="rounded-xl border border-limbi-border bg-limbi-bg-soft px-3 py-2 text-sm leading-relaxed text-limbi-text"
                        role="status"
                      >
                        {baseFromHistoryNotice}
                      </p>
                    ) : null}
                    {suggestionSuccessMessage ? (
                      <p
                        className="rounded-xl border border-limbi-green/35 bg-limbi-green/10 px-3 py-2 text-sm text-limbi-text"
                        role="status"
                      >
                        {suggestionSuccessMessage}
                      </p>
                    ) : null}
                    {showSuggestionTraceLine ? (
                      <p className="text-sm text-muted-foreground" role="status">
                        {MSG_TRACE}
                      </p>
                    ) : null}
                    {applyFlowHint ? (
                      <p
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                        role="status"
                        aria-live="polite"
                      >
                        {applySuggestionBusy ? (
                          <Loader2
                            className="mt-0.5 size-4 shrink-0 animate-spin"
                            aria-hidden
                          />
                        ) : null}
                        {applyFlowHint}
                      </p>
                    ) : null}
                    <Textarea
                      value={revisionDraft}
                      onChange={(e) => {
                        setRevisionDraft(e.target.value);
                        setSuggestionSuccessMessage(null);
                        setShowSuggestionTraceLine(false);
                      }}
                      rows={5}
                      placeholder="Mínimo 10 caracteres…"
                      disabled={applySuggestionBusy}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={applySuggestionBusy || regenerating || approving}
                        className={cn("gap-2", limbiOutlineButtonClass)}
                        onClick={() => void handleApplySuggestionAndRegenerate()}
                      >
                        {applySuggestionBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : null}
                        {applyFromHistoryMode
                          ? "Aplicar nueva sugerencia y generar versión"
                          : "Aplicar sugerencia y generar nueva versión"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        ) : null}

        {!marcoNeedsRefreshBeforeApprove && cannotApproveDraft ? (
          <p className="text-sm text-muted-foreground">
            Este borrador no se puede aprobar en esta versión. Regenera el Marco
            desde el aviso superior o desde el botón de actualización.
          </p>
        ) : null}

        {showHistorySection && !marcoNeedsRefreshBeforeApprove ? (
          <Card className="rounded-[22px] border border-limbi-border bg-limbi-surface shadow-limbi">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-base font-semibold text-limbi-text">
                Memoria de ajustes del sistema
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed text-limbi-muted">
                {HISTORY_SECTION_INTRO}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {responsesStale ? (
                <p className="rounded-xl border border-limbi-yellow/40 bg-limbi-yellow/10 px-3 py-2 text-sm leading-relaxed text-limbi-text">
                  {MSG_HISTORY_BLOCKED_BY_BASE}
                </p>
              ) : null}
              {revisionHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hay sugerencias aplicadas en el historial.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {revisionHistory.map((entry, index) => (
                    <li
                      key={`${entry.revision_note_event_id}-${entry.created_at}-${entry.new_framework_id}`}
                      className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          {index === 0 ? (
                            <p className="text-xs font-semibold uppercase tracking-wide text-limbi-green">
                              Última sugerencia aplicada
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            Fecha: {formatHistoryDate(entry.created_at)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Marco fuente: v{entry.source_framework_version} ·
                            Generada: v{entry.new_framework_version}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-foreground">
                            {previewNote(entry.revision_note)}
                          </p>
                        </div>
                        {!responsesStale ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={applySuggestionBusy}
                            onClick={() => handleUseSuggestionAsBase(entry)}
                          >
                            Usar como base para nueva sugerencia
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}

function LegacyFrameworkBody({ fw }: { fw: Record<string, unknown> }) {
  const ptm = readRecord(fw.perception_to_move);
  const secondary = readStringArray(fw, "secondary_messages");
  const avoid = readStringArray(fw, "what_to_avoid");
  const opportunities = readStringArray(fw, "content_opportunities");

  return (
    <div className="grid gap-6">
      <FrameworkSection
        title="Qué estás comunicando realmente"
        body={readString(fw, "what_is_really_communicated")}
      />
      <FrameworkSection title="Audiencia" body={readString(fw, "audience_summary")} />
      <FrameworkSection
        title="Tensión principal"
        body={readString(fw, "central_tension")}
      />
      <Card className={limbiDocumentCardClass}>
        <CardHeader className={cn("pb-4", limbiDocumentCardHeaderClass)}>
          <CardTitle className="text-lg">Percepción a mover</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6 sm:grid-cols-2">
          <FieldBlock
            label="Percepción actual"
            text={readString(ptm, "current_perception")}
          />
          <FieldBlock
            label="Percepción deseada"
            text={readString(ptm, "desired_perception")}
          />
        </CardContent>
      </Card>
      <FrameworkSection
        title="Promesa narrativa"
        body={readString(fw, "narrative_promise")}
      />
      <FrameworkSection
        title="Territorio de comunicación"
        body={readString(fw, "communication_territory")}
      />
      <FrameworkSection
        title="Personalidad de voz"
        body={readString(fw, "voice_personality")}
      />
      <FrameworkSection
        title="Atmósfera emocional"
        body={readString(fw, "emotional_atmosphere")}
      />
      <FrameworkSection title="Idea fuerza" body={readString(fw, "big_idea")} />
      <FrameworkSection
        title="Mensaje principal"
        body={readString(fw, "main_message")}
      />
      <FrameworkListSection title="Mensajes secundarios" items={secondary} />
      <FrameworkListSection title="Qué evitar" items={avoid} />
      <FrameworkListSection
        title="Oportunidades de contenido"
        items={opportunities}
      />
    </div>
  );
}

function NewFrameworkBody({ fw }: { fw: Record<string, unknown> }) {
  const sd = readRecord(fw.strategic_diagnosis);
  const aud = readRecord(fw.audience);
  const cm = readRecord(fw.conflict_map);
  const rm = readRecord(fw.risk_map);
  const ns = readRecord(fw.narrative_strategy);
  const ma = readRecord(fw.message_architecture);
  const cso = readRecord(fw.content_strategy_opportunities);
  const sig = readRecord(fw.success_signals);
  const { axes: conceptualAxes } = readConceptualAxes(ns);

  return (
    <div className="grid gap-6">
      <FrameworkSection
        title="Resumen ejecutivo"
        body={readString(fw, "executive_summary")}
      />

      <Card className={limbiDocumentCardClass}>
        <CardHeader className={cn("pb-4", limbiDocumentCardHeaderClass)}>
          <CardTitle className="text-lg">Diagnóstico estratégico</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6">
          <FieldBlock
            label="Situación actual"
            text={readString(sd, "current_situation")}
          />
          <FieldBlock
            label="Problema de comunicación"
            text={readString(sd, "communication_problem")}
          />
          <FieldBlock
            label="Oportunidad estratégica"
            text={readString(sd, "strategic_opportunity")}
          />
          <FieldBlock
            label="Resultado esperado"
            text={readString(sd, "expected_result")}
          />
        </CardContent>
      </Card>

      <Card className={limbiDocumentCardClass}>
        <CardHeader className={cn("pb-4", limbiDocumentCardHeaderClass)}>
          <CardTitle className="text-lg">Audiencia y movimiento esperado</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6 sm:grid-cols-2">
          <FieldBlock
            label="A quién necesitamos mover"
            text={readString(aud, "who_we_need_to_move")}
          />
          <FieldBlock label="Estado actual" text={readString(aud, "current_state")} />
          <FieldBlock
            label="Estado deseado"
            text={readString(aud, "desired_state")}
          />
          <FieldBlock
            label="Acción esperada"
            text={readString(aud, "expected_action")}
          />
        </CardContent>
      </Card>

      <Card className={limbiDocumentCardClass}>
        <CardHeader className={cn("pb-4", limbiDocumentCardHeaderClass)}>
          <CardTitle className="text-lg">Mapa de conflictos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6">
          <FieldBlock label="Conflicto principal" text={readString(cm, "main_conflict")} />
          <FieldBlock
            label="Conflicto de percepción"
            text={readString(cm, "perception_conflict")}
          />
          <FieldBlock
            label="Conflicto emocional"
            text={readString(cm, "emotional_conflict")}
          />
          <FieldBlock
            label="Conflicto de categoría o mercado"
            text={readString(cm, "category_or_market_conflict")}
          />
          <FieldBlock
            label="Conflicto interno de comunicación"
            text={readString(cm, "internal_communication_conflict")}
          />
        </CardContent>
      </Card>

      <Card className={limbiDocumentCardClass}>
        <CardHeader className={cn("pb-4", limbiDocumentCardHeaderClass)}>
          <CardTitle className="text-lg">Mapa de riesgos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-8 pt-6">
          <FrameworkListSection
            title="Riesgos principales"
            items={readStringArray(rm, "main_risks")}
            embedded
          />
          <FrameworkListSection
            title="Riesgos de credibilidad"
            items={readStringArray(rm, "credibility_risks")}
            embedded
          />
          <FrameworkListSection
            title="Riesgos de tono"
            items={readStringArray(rm, "tone_risks")}
            embedded
          />
          <FrameworkListSection
            title="Brechas de evidencia"
            items={readStringArray(rm, "evidence_gaps")}
            embedded
          />
          <FrameworkListSection
            title="Qué podría salir mal"
            items={readStringArray(rm, "what_could_go_wrong")}
            embedded
          />
        </CardContent>
      </Card>

      <Card className={limbiDocumentCardClass}>
        <CardHeader className={cn("pb-4", limbiDocumentCardHeaderClass)}>
          <CardTitle className="text-lg">Estrategia narrativa</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6">
          <FieldBlock
            label="Promesa narrativa"
            text={readString(ns, "narrative_promise")}
          />
          <FieldBlock
            label="Territorio de comunicación"
            text={readString(ns, "communication_territory")}
          />
          <ConceptualAxesSection axes={conceptualAxes} />
          <FieldBlock
            label="Atmósfera emocional"
            text={readString(ns, "emotional_atmosphere")}
          />
          <FieldBlock
            label="Personalidad de voz"
            text={readString(ns, "voice_personality")}
          />
        </CardContent>
      </Card>

      <Card className={limbiDocumentCardClass}>
        <CardHeader className={cn("pb-4", limbiDocumentCardHeaderClass)}>
          <CardTitle className="text-lg">Arquitectura de mensajes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-8 pt-6">
          <FieldBlock
            label="Mensaje principal"
            text={readString(ma, "main_message")}
          />
          <FrameworkListSection
            title="Mensajes de apoyo"
            items={readStringArray(ma, "supporting_messages")}
            embedded
          />
          <FrameworkListSection
            title="Pruebas disponibles"
            items={readStringArray(ma, "proof_points")}
            embedded
          />
          <FrameworkListSection
            title="Mensajes a evitar"
            items={readStringArray(ma, "messages_to_avoid")}
            embedded
          />
        </CardContent>
      </Card>

      <Card className={limbiDocumentCardClass}>
        <CardHeader className={cn("pb-4", limbiDocumentCardHeaderClass)}>
          <CardTitle className="text-lg">
            Oportunidades estratégicas de contenido
          </CardTitle>
          <CardDescription className="text-sm">
            {readString(cso, "not_final_content_warning") ||
              NOT_FINAL_CONTENT_WARNING}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 pt-6">
          <FrameworkListSection
            title="Roles de contenido estratégicos"
            items={readStringArray(cso, "strategic_content_roles")}
            embedded
          />
          <FrameworkListSection
            title="Oportunidades de contenido"
            items={readStringArray(cso, "content_opportunities")}
            embedded
          />
          <FrameworkListSection
            title="Ángulos recomendados"
            items={readStringArray(cso, "recommended_angles")}
            embedded
          />
        </CardContent>
      </Card>

      <Card className={limbiDocumentCardClass}>
        <CardHeader className={cn("pb-4", limbiDocumentCardHeaderClass)}>
          <CardTitle className="text-lg">Señales de éxito</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-8 pt-6">
          <FrameworkListSection
            title="Indicadores de percepción"
            items={readStringArray(sig, "perception_indicators")}
            embedded
          />
          <FrameworkListSection
            title="Indicadores de engagement"
            items={readStringArray(sig, "engagement_indicators")}
            embedded
          />
          <FrameworkListSection
            title="Indicadores de conversión o acción"
            items={readStringArray(sig, "conversion_or_action_indicators")}
            embedded
          />
          <FrameworkListSection
            title="Señales cualitativas"
            items={readStringArray(sig, "qualitative_signals")}
            embedded
          />
        </CardContent>
      </Card>

      <FrameworkListSection
        title="Recomendaciones estratégicas"
        items={readStringArray(fw, "strategic_recommendations")}
      />

      <FrameworkListSection
        title="Guardrails / qué evitar"
        items={readStringArray(fw, "guardrails")}
      />
    </div>
  );
}

function ConceptualAxesSection({ axes }: { axes: ConceptualAxis[] }) {
  if (axes.length === 0) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Ejes conceptuales
        </p>
        <p className="mt-2 text-sm text-muted-foreground">—</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Ejes conceptuales
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {axes.map((axis, i) => (
          <Card
            key={`axis-${i}-${axis.axis_title.slice(0, 24)}`}
            className={limbiDocumentCardClass}
          >
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base leading-snug">
                {axis.axis_title || `Eje ${i + 1}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4 text-sm leading-relaxed">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Significado estratégico
                </p>
                <p className="mt-1.5 text-foreground">
                  {axis.strategic_meaning || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Uso narrativo
                </p>
                <p className="mt-1.5 text-foreground">
                  {axis.narrative_use || "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FieldBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-foreground sm:text-[15px]">
        {text || "—"}
      </p>
    </div>
  );
}

function FrameworkSection({ title, body }: { title: string; body: string }) {
  return (
    <Card className={limbiDocumentCardClass}>
      <CardHeader className={cn("pb-4", limbiDocumentCardHeaderClass)}>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
          {body || "—"}
        </p>
      </CardContent>
    </Card>
  );
}

function FrameworkListSection({
  title,
  items,
  embedded,
}: {
  title: string;
  items: string[];
  embedded?: boolean;
}) {
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">—</p>
      ) : (
        <div className="mt-2 space-y-3">
          {items.map((item, i) => (
            <p
              key={`${title}-${i}`}
              className="border-l-2 border-limbi-border pl-3 text-sm leading-relaxed text-limbi-text sm:text-[15px]"
            >
              {item}
            </p>
          ))}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div>{inner}</div>;
  }

  return (
    <Card className={limbiDocumentCardClass}>
      <CardHeader className={cn("pb-4", limbiDocumentCardHeaderClass)}>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">{inner}</CardContent>
    </Card>
  );
}
