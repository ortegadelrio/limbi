"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Copy, Loader2, PenLine, Sparkles } from "lucide-react";
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
import {
  limbiLoadingMessage,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
  limbiTabActiveClass,
  limbiTabInactiveClass,
} from "@/components/projects/limbi-ui";
import {
  CONTENT_GENERATION_MAX_QUANTITY,
  CONTENT_TYPE_DEFAULT_QUANTITY,
  type ContentGenerationType,
} from "@/lib/content/build-input";
import {
  CONTENT_REFINEMENT_CUSTOM_NOTE_MAX,
  REFINEMENT_QUICK_OPTIONS,
  isRefinementPreset,
  refinementPresetLabelEs,
  type RefinementPreset,
} from "@/lib/content/refine-input";
import { formatGeneratedContentForCopy } from "@/lib/content/format-generated-content-for-copy";

type GeneratedContentRow = {
  id: string;
  project_id: string;
  content_type: string;
  status: string;
  created_at: string;
  request: Record<string, unknown>;
  output: Record<string, unknown>;
};

type StatusPayload = {
  approved_visible_framework: { id: string } | null;
};

const SPECS: Record<
  ContentGenerationType,
  { title: string; description: string }
> = {
  short_pitch: {
    title: "Pitch Corto",
    description:
      "Versiones breves para explicar la propuesta con claridad estratégica.",
  },
  captions: {
    title: "Captions",
    description:
      "Piezas para redes sociales, alineadas con el tono y la narrativa aprobada.",
  },
  content_ideas: {
    title: "Ideas de Contenido",
    description:
      "Territorios e ideas accionables para desarrollar más piezas narrativas.",
  },
  graphic_phrases: {
    title: "Frases Gráficas",
    description:
      "Frases breves para piezas visuales, titulares o recursos gráficos.",
  },
};

const CONTENT_TAB_ORDER: ContentGenerationType[] = [
  "short_pitch",
  "captions",
  "content_ideas",
  "graphic_phrases",
];

function readItems(output: Record<string, unknown>): unknown[] {
  const raw = output.items;
  return Array.isArray(raw) ? raw : [];
}

function readRequestMeta(req: Record<string, unknown>): {
  quantity: number | null;
  user_note: string | null;
  attempts_used: number | null;
  validation_feedback_used: boolean | null;
  source_generated_content_id: string | null;
  refinement_preset: string | null;
} {
  const q = req.quantity;
  const quantity =
    typeof q === "number" && Number.isInteger(q) && q >= 1 ? q : null;
  const un = req.user_note;
  const user_note =
    typeof un === "string" && un.trim().length > 0 ? un.trim() : null;
  const au = req.attempts_used;
  const attempts_used =
    typeof au === "number" && Number.isInteger(au) ? au : null;
  const vf = req.validation_feedback_used;
  const validation_feedback_used = typeof vf === "boolean" ? vf : null;
  const sid = req.source_generated_content_id;
  const source_generated_content_id =
    typeof sid === "string" && sid.trim().length > 0 ? sid.trim() : null;
  const rp = req.refinement_preset;
  const refinement_preset =
    typeof rp === "string" && rp.trim().length > 0 ? rp.trim() : null;
  return {
    quantity,
    user_note,
    attempts_used,
    validation_feedback_used,
    source_generated_content_id,
    refinement_preset,
  };
}

function FieldBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
        {value}
      </p>
    </div>
  );
}

function renderShortPitchItem(
  item: unknown,
  index: number,
  contentType: ContentGenerationType,
  onCopyError: (message: string) => void,
) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const o = item as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title : "";
  const pitch = typeof o.pitch === "string" ? o.pitch : "";
  const si =
    typeof o.strategic_intention === "string" ? o.strategic_intention : "";
  const bu = typeof o.best_use === "string" ? o.best_use : "";
  return (
    <li
      key={index}
      className="rounded-2xl border border-limbi-border/90 bg-limbi-surface p-4 shadow-limbi space-y-3"
    >
      <FieldBlock label="Título" value={title} />
      <FieldBlock label="Pitch" value={pitch} />
      <FieldBlock label="Intención estratégica" value={si} />
      <FieldBlock label="Mejor uso" value={bu} />
      <CopyPieceFooter
        contentType={contentType}
        item={item}
        onError={onCopyError}
      />
    </li>
  );
}

function renderCaptionItem(
  item: unknown,
  index: number,
  contentType: ContentGenerationType,
  onCopyError: (message: string) => void,
) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const o = item as Record<string, unknown>;
  return (
    <li
      key={index}
      className="rounded-2xl border border-limbi-border/90 bg-limbi-surface p-4 shadow-limbi space-y-3"
    >
      <FieldBlock label="Caption" value={String(o.caption ?? "")} />
      <FieldBlock label="Tono" value={String(o.tone ?? "")} />
      <FieldBlock
        label="Intención estratégica"
        value={String(o.strategic_intention ?? "")}
      />
      <FieldBlock
        label="Canal sugerido"
        value={String(o.suggested_channel ?? "")}
      />
      <CopyPieceFooter
        contentType={contentType}
        item={item}
        onError={onCopyError}
      />
    </li>
  );
}

function renderIdeaItem(
  item: unknown,
  index: number,
  contentType: ContentGenerationType,
  onCopyError: (message: string) => void,
) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const o = item as Record<string, unknown>;
  return (
    <li
      key={index}
      className="rounded-2xl border border-limbi-border/90 bg-limbi-surface p-4 shadow-limbi space-y-3"
    >
      <FieldBlock label="Título" value={String(o.idea_title ?? "")} />
      <FieldBlock
        label="Descripción"
        value={String(o.idea_description ?? "")}
      />
      <FieldBlock label="Rol estratégico" value={String(o.strategic_role ?? "")} />
      <FieldBlock
        label="Formato posible"
        value={String(o.possible_format ?? "")}
      />
      <FieldBlock label="Por qué funciona" value={String(o.why_it_works ?? "")} />
      <CopyPieceFooter
        contentType={contentType}
        item={item}
        onError={onCopyError}
      />
    </li>
  );
}

function renderGraphicItem(
  item: unknown,
  index: number,
  contentType: ContentGenerationType,
  onCopyError: (message: string) => void,
) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const o = item as Record<string, unknown>;
  return (
    <li
      key={index}
      className="rounded-2xl border border-limbi-border/90 bg-limbi-surface p-4 shadow-limbi space-y-3"
    >
      <FieldBlock label="Frase" value={String(o.phrase ?? "")} />
      <FieldBlock label="Intención" value={String(o.intention ?? "")} />
      <FieldBlock
        label="Contexto visual"
        value={String(o.visual_context ?? "")}
      />
      <FieldBlock label="Nota de uso" value={String(o.usage_note ?? "")} />
      <CopyPieceFooter
        contentType={contentType}
        item={item}
        onError={onCopyError}
      />
    </li>
  );
}

function renderItemsForType(
  contentType: ContentGenerationType,
  items: unknown[],
  onCopyError: (message: string) => void,
) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay piezas en esta generación.
      </p>
    );
  }
  return (
    <ol className="space-y-4 list-none pl-0">
      {contentType === "short_pitch"
        ? items.map((it, i) =>
            renderShortPitchItem(it, i, contentType, onCopyError),
          )
        : null}
      {contentType === "captions"
        ? items.map((it, i) => renderCaptionItem(it, i, contentType, onCopyError))
        : null}
      {contentType === "content_ideas"
        ? items.map((it, i) => renderIdeaItem(it, i, contentType, onCopyError))
        : null}
      {contentType === "graphic_phrases"
        ? items.map((it, i) => renderGraphicItem(it, i, contentType, onCopyError))
        : null}
    </ol>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function CopyPlainTextButton({
  text,
  label = "Copiar texto",
  doneLabel = "Texto copiado",
  className,
  disabled,
  onError,
}: {
  text: string;
  label?: string;
  doneLabel?: string;
  className?: string;
  disabled?: boolean;
  onError?: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    const t = text.trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      onError?.("No se pudo copiar al portapapeles.");
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || !text.trim()}
      onClick={() => void handle()}
      className={cn(
        "gap-1.5 text-xs font-medium shadow-none",
        limbiOutlineButtonClass,
        className,
      )}
    >
      <Copy className="size-3.5 shrink-0 opacity-80" aria-hidden />
      {copied ? doneLabel : label}
    </Button>
  );
}

function CopyPieceFooter({
  contentType,
  item,
  onError,
}: {
  contentType: ContentGenerationType;
  item: unknown;
  onError: (message: string) => void;
}) {
  const text = formatGeneratedContentForCopy(contentType, [item]);
  if (!text.trim()) return null;
  return (
    <div className="border-t border-limbi-border/80 pt-3">
      <CopyPlainTextButton
        text={text}
        label="Copiar pieza"
        onError={onError}
        className="h-8"
      />
    </div>
  );
}

function refinementPresetDisplayLabel(preset: string | null): string | null {
  if (!preset) return null;
  if (isRefinementPreset(preset)) return refinementPresetLabelEs(preset);
  return preset;
}

function CreativeRefinePanel({
  projectId,
  sourceRowId,
  disabled,
  onClose,
  onRefineError,
  onSuccess,
}: {
  projectId: string;
  sourceRowId: string;
  disabled: boolean;
  onClose: () => void;
  onRefineError: (message: string) => void;
  onSuccess: () => void;
}) {
  const [preset, setPreset] = useState<RefinementPreset | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = note.trim();
    if (preset === null && trimmed.length === 0) {
      setLocalError("Elige un ajuste rápido o escribe una instrucción adicional.");
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {};
      if (preset !== null) body.refinement_preset = preset;
      if (trimmed.length > 0) body.custom_refinement_note = trimmed;

      const res = await fetch(
        `/api/projects/${projectId}/generated-content/${sourceRowId}/refine`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        user_guidance?: unknown;
        validation_failure?: { offending_rule?: unknown };
      };
      if (!res.ok) {
        const serverError =
          typeof json.error === "string"
            ? json.error
            : "No se pudo crear la versión refinada.";
        if (res.status === 422) {
          const guidance =
            typeof json.user_guidance === "string"
              ? json.user_guidance
              : "No se pudo generar esta versión porque la respuesta no pasó la validación de calidad. Intenta con una nota más específica o vuelve a generar.";
          const rule =
            json.validation_failure &&
            typeof json.validation_failure.offending_rule === "string"
              ? ` (${String(json.validation_failure.offending_rule)})`
              : "";
          onRefineError(`${guidance}${rule}\n\n${serverError}`);
        } else if (res.status === 409) {
          onRefineError(serverError);
        } else {
          onRefineError(serverError);
        }
        return;
      }
      onSuccess();
    } catch (e) {
      onRefineError(
        e instanceof Error ? e.message : "Error al refinar la pieza.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-5 space-y-4 rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/60 p-4 shadow-limbi sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-heading text-sm font-semibold tracking-tight text-limbi-text">
            Ajuste creativo
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-limbi-muted">
            Afina esta pieza sin alterar la estrategia del sistema.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-limbi-muted hover:text-limbi-text"
          disabled={submitting}
          onClick={onClose}
        >
          Cerrar
        </Button>
      </div>
      {localError ? (
        <p className="text-xs text-destructive" role="alert">
          {localError}
        </p>
      ) : null}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-limbi-muted">
          Presets editoriales
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {REFINEMENT_QUICK_OPTIONS.map((opt) => {
            const active = preset === opt.preset;
            return (
              <Button
                key={opt.preset}
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "h-auto min-h-9 justify-center px-2 py-2 text-center text-xs font-normal leading-snug",
                  active
                    ? "border-limbi-green/40 bg-limbi-green/10 text-limbi-text shadow-sm ring-1 ring-limbi-green/15"
                    : "border-limbi-border bg-limbi-surface text-limbi-text hover:bg-limbi-bg-soft",
                )}
                disabled={disabled || submitting}
                onClick={() =>
                  setPreset((prev) => (prev === opt.preset ? null : opt.preset))
                }
              >
                {opt.label}
              </Button>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          htmlFor={`refine-note-${sourceRowId}`}
        >
          Dale una instrucción adicional a Limbi para mejorar esta pieza.
        </label>
        <Textarea
          id={`refine-note-${sourceRowId}`}
          rows={3}
          className="resize-y min-h-[72px] text-sm"
          disabled={disabled || submitting}
          maxLength={CONTENT_REFINEMENT_CUSTOM_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej.: Hazlo menos genérico, más directo para empresarios y con un cierre más memorable."
        />
        <p className="text-[11px] text-muted-foreground text-right">
          {note.length}/{CONTENT_REFINEMENT_CUSTOM_NOTE_MAX}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className={cn("gap-2", limbiPrimaryButtonClass)}
          disabled={disabled || submitting}
          onClick={() => void submit()}
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <PenLine className="size-4" aria-hidden />
          )}
          Crear versión refinada
        </Button>
      </div>
      {submitting ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Aplicando ajuste creativo…
        </p>
      ) : null}
    </div>
  );
}

type Props = {
  projectId: string;
};

export function ContentPageClient({ projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [rows, setRows] = useState<GeneratedContentRow[]>([]);
  const [quantities, setQuantities] = useState<Record<ContentGenerationType, number>>(
    () => ({ ...CONTENT_TYPE_DEFAULT_QUANTITY }),
  );
  const [notes, setNotes] = useState<Record<ContentGenerationType, string>>({
    short_pitch: "",
    captions: "",
    content_ideas: "",
    graphic_phrases: "",
  });
  const [generating, setGenerating] = useState<ContentGenerationType | null>(
    null,
  );
  const [refiningTarget, setRefiningTarget] = useState<{
    rowId: string;
    contentType: ContentGenerationType;
  } | null>(null);
  const [refinementSuccess, setRefinementSuccess] = useState<string | null>(
    null,
  );
  const [activeType, setActiveType] =
    useState<ContentGenerationType>("short_pitch");

  const byType = useMemo(() => {
    const m: Record<ContentGenerationType, GeneratedContentRow[]> = {
      short_pitch: [],
      captions: [],
      content_ideas: [],
      graphic_phrases: [],
    };
    for (const r of rows) {
      const t = r.content_type as ContentGenerationType;
      if (t in m) m[t].push(r);
    }
    return m;
  }, [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stRes, gcRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/status`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/generated-content`, {
          credentials: "include",
        }),
      ]);
      const stJson = (await stRes.json().catch(() => ({}))) as {
        error?: unknown;
        approved_visible_framework?: unknown;
      } & Partial<StatusPayload>;
      if (!stRes.ok) {
        throw new Error(
          typeof stJson.error === "string"
            ? stJson.error
            : "No se pudo cargar el estado del sistema.",
        );
      }
      setApproved(stJson.approved_visible_framework !== null);

      const gcJson = (await gcRes.json().catch(() => ({}))) as {
        error?: unknown;
        generated_contents?: GeneratedContentRow[];
      };
      if (!gcRes.ok) {
        throw new Error(
          typeof gcJson.error === "string"
            ? gcJson.error
            : "No se pudo cargar el historial de piezas.",
        );
      }
      setRows(
        Array.isArray(gcJson.generated_contents)
          ? gcJson.generated_contents
          : [],
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Error al cargar la página de piezas narrativas.",
      );
      setRows([]);
      setApproved(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGenerate = async (contentType: ContentGenerationType) => {
    setGenerating(contentType);
    setError(null);
    setRefinementSuccess(null);
    setRefiningTarget(null);
    try {
      const qty = quantities[contentType];
      const note = notes[contentType].trim();
      const res = await fetch(
        `/api/projects/${projectId}/generate-content`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_type: contentType,
            quantity: qty,
            ...(note.length > 0 ? { user_note: note } : {}),
          }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        user_guidance?: unknown;
        validation_failure?: { offending_rule?: unknown; message?: unknown };
      };
      if (!res.ok) {
        const serverError =
          typeof json.error === "string"
            ? json.error
            : "No se pudo generar la pieza.";
        if (res.status === 422) {
          const guidance =
            typeof json.user_guidance === "string"
              ? json.user_guidance
              : "No se pudo generar esta versión porque la respuesta no pasó la validación de calidad. Intenta con una nota más específica o vuelve a generar.";
          const rule =
            json.validation_failure &&
            typeof json.validation_failure.offending_rule === "string"
              ? ` (${json.validation_failure.offending_rule})`
              : "";
          throw new Error(`${guidance}${rule}\n\n${serverError}`);
        }
        throw new Error(serverError);
      }
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error al generar la pieza.",
      );
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Loader2
          className="size-8 animate-spin text-limbi-green"
          aria-hidden
        />
        <p className="text-sm text-limbi-muted">
          {limbiLoadingMessage(`content-${projectId}`)}
        </p>
      </div>
    );
  }

  if (approved === false) {
    return (
      <Card className="border-amber-500/40 bg-amber-500/10">
        <CardHeader>
          <CardTitle className="text-lg">
            Primero aprueba el Marco Estratégico Límbico para crear piezas desde
            una base validada.
          </CardTitle>
          <CardDescription className="text-base text-amber-950/90 dark:text-amber-50/90">
            Las piezas narrativas se anclan al Marco Estratégico Límbico aprobado
            y a la Lectura Límbica activa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/projects/${projectId}/framework`}>
              Ver Marco Estratégico Límbico
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const list = byType[activeType];
  const latest = list[0];
  const history = list.slice(1);
  const spec = SPECS[activeType];
  const busy = generating === activeType;
  const refinePanelOpenForType =
    refiningTarget !== null && refiningTarget.contentType === activeType;
  const defQty = CONTENT_TYPE_DEFAULT_QUANTITY[activeType];

  const versionCountLabel = (n: number) =>
    `${n} ${n === 1 ? "versión" : "versiones"}`;

  const newVersionFields = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1">
        <label
          className="text-[11px] font-medium uppercase tracking-[0.08em] text-limbi-muted"
          htmlFor={`qty-${activeType}`}
        >
          Cantidad (máx. {CONTENT_GENERATION_MAX_QUANTITY}, por defecto {defQty})
        </label>
        <select
          id={`qty-${activeType}`}
          className={cn(
            "h-9 rounded-xl border border-limbi-border bg-limbi-surface px-3 text-sm text-limbi-text shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35",
          )}
          value={quantities[activeType]}
          disabled={busy || refinePanelOpenForType}
          onChange={(e) =>
            setQuantities((prev) => ({
              ...prev,
              [activeType]: Number(e.target.value),
            }))
          }
        >
          {Array.from(
            { length: CONTENT_GENERATION_MAX_QUANTITY },
            (_, i) => i + 1,
          ).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <label
          className="text-[11px] font-medium uppercase tracking-[0.08em] text-limbi-muted"
          htmlFor={`note-${activeType}`}
        >
          Nota para esta generación (opcional)
        </label>
        <Textarea
          id={`note-${activeType}`}
          rows={2}
          className="resize-y min-h-[60px] border-limbi-border bg-limbi-surface text-sm"
          disabled={busy || refinePanelOpenForType}
          value={notes[activeType]}
          onChange={(e) =>
            setNotes((prev) => ({
              ...prev,
              [activeType]: e.target.value,
            }))
          }
          placeholder="Orientación breve; no sustituye al Marco Límbico ni a la Lectura Límbica."
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {refinementSuccess ? (
        <p className="text-sm text-limbi-green" role="status">
          {refinementSuccess}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-limbi-border/80 pb-4 text-xs text-limbi-muted">
        {CONTENT_TAB_ORDER.map((t) => {
          const label =
            t === "content_ideas" ? "Ideas de Contenido" : SPECS[t].title;
          return (
            <span key={t}>
              <span className="font-medium text-limbi-text">
                {label}
              </span>
              {": "}
              {versionCountLabel(byType[t].length)}
            </span>
          );
        })}
      </div>

      <div
        className="-mx-1 flex gap-0 overflow-x-auto border-b border-limbi-border/90 px-1"
        role="tablist"
        aria-label="Tipos de pieza narrativa"
      >
        {CONTENT_TAB_ORDER.map((t) => {
          const selected = t === activeType;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "relative shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
                selected ? limbiTabActiveClass : limbiTabInactiveClass,
              )}
              onClick={() => {
                setActiveType(t);
                setRefinementSuccess(null);
              }}
            >
              {SPECS[t].title}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        <p className="text-sm leading-relaxed text-limbi-muted">
          {spec.description}
        </p>

        {!latest ? (
          <div className="rounded-[22px] border border-dashed border-limbi-border bg-limbi-surface/90 px-5 py-10 text-center shadow-limbi sm:px-8">
            <p className="text-sm leading-relaxed text-limbi-muted">
              Aún no has creado este tipo de pieza.
            </p>
            <div className="mt-5 flex flex-col items-center gap-3">
              <Button
                type="button"
                className={cn("gap-2", limbiPrimaryButtonClass)}
                disabled={busy || refinePanelOpenForType}
                onClick={() => void handleGenerate(activeType)}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                Crear primera versión
              </Button>
              <details className="w-full max-w-md text-left [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer text-center text-xs text-limbi-green underline decoration-limbi-green/35 underline-offset-4">
                  Cantidad y nota (opcional)
                </summary>
                <div className="mt-4 text-left">{newVersionFields}</div>
              </details>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-[22px] border border-limbi-border/90 bg-limbi-surface px-4 py-5 shadow-limbi sm:px-6 sm:py-6">
              {(() => {
                const meta = readRequestMeta(latest.request);
                return (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-limbi-muted">
                        Última versión
                      </span>
                      {meta.source_generated_content_id ? (
                        <span className="rounded-full border border-limbi-green/25 bg-limbi-green/10 px-2.5 py-0.5 text-xs font-medium text-limbi-text">
                          Versión refinada
                        </span>
                      ) : (
                        <span className="rounded-full border border-limbi-border bg-limbi-bg-soft px-2.5 py-0.5 text-xs font-medium text-limbi-text">
                          Generada desde el Marco
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-limbi-muted">
                      {formatDate(latest.created_at)} ·{" "}
                      {meta.quantity != null
                        ? `${meta.quantity} ${meta.quantity === 1 ? "pieza" : "piezas"}`
                        : "—"}
                    </p>
                    {meta.refinement_preset ? (
                      <p className="text-xs text-limbi-muted">
                        Ajuste en esta versión:{" "}
                        <span className="font-medium text-limbi-text">
                          {refinementPresetDisplayLabel(meta.refinement_preset)}
                        </span>
                      </p>
                    ) : null}
                    {meta.user_note ? (
                      <p className="text-xs text-limbi-muted">
                        Nota:{" "}
                        <span className="text-limbi-text">
                          {meta.user_note}
                        </span>
                      </p>
                    ) : null}
                  </div>
                );
              })()}
              <div className="mt-5">
                {renderItemsForType(
                  activeType,
                  readItems(latest.output),
                  (m) => setError(m),
                )}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <CopyPlainTextButton
                  text={formatGeneratedContentForCopy(
                    activeType,
                    readItems(latest.output),
                  )}
                  onError={(m) => setError(m)}
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("gap-2", limbiOutlineButtonClass)}
                  disabled={busy}
                  onClick={() => {
                    setRefinementSuccess(null);
                    setError(null);
                    setRefiningTarget({
                      rowId: latest.id,
                      contentType: activeType,
                    });
                  }}
                >
                  <PenLine className="size-4" aria-hidden />
                  Ajuste creativo
                </Button>
              </div>
              {refiningTarget?.rowId === latest.id &&
              refiningTarget.contentType === activeType ? (
                <CreativeRefinePanel
                  key={`refine-${latest.id}-${activeType}`}
                  projectId={projectId}
                  sourceRowId={latest.id}
                  disabled={busy}
                  onClose={() => {
                    setRefiningTarget(null);
                  }}
                  onRefineError={(msg) => setError(msg)}
                  onSuccess={() => {
                    setError(null);
                    setRefiningTarget(null);
                    setRefinementSuccess("Versión refinada creada.");
                    void load();
                  }}
                />
              ) : null}
            </div>

            <details className="group rounded-2xl border border-limbi-border/80 bg-limbi-bg-soft/50 px-3 py-1 sm:px-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-3 text-sm font-medium text-limbi-text">
                <span>Crear nueva versión</span>
                <ChevronDown className="size-4 shrink-0 text-limbi-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-limbi-border/80 pb-4 pt-4">
                {newVersionFields}
                <Button
                  type="button"
                  className={cn("gap-2", limbiPrimaryButtonClass)}
                  disabled={busy || refinePanelOpenForType}
                  onClick={() => void handleGenerate(activeType)}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-4" aria-hidden />
                  )}
                  Generar versión
                </Button>
              </div>
            </details>
          </div>
        )}

        {history.length > 0 ? (
          <details className="group rounded-2xl border border-limbi-border/80 bg-limbi-bg-soft/40 px-3 py-1 sm:px-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-3 text-sm font-medium text-limbi-text">
              <span>
                Ver historial de versiones
                <span className="ml-1.5 font-normal text-limbi-muted">
                  ({history.length})
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-limbi-muted transition-transform group-open:rotate-180" />
            </summary>
            <ul className="space-y-4 border-t border-limbi-border/80 pb-4 pt-4">
              {history.map((row) => {
                const meta = readRequestMeta(row.request);
                const typeLabel = SPECS[activeType].title;
                return (
                  <li
                    key={row.id}
                    className="rounded-2xl border border-limbi-border/90 bg-limbi-surface px-3 py-3 text-sm shadow-limbi sm:px-4"
                  >
                    <div className="space-y-1.5 text-limbi-muted">
                      <p className="font-medium text-limbi-text">
                        {formatDate(row.created_at)}
                      </p>
                      <p>
                        <span className="text-limbi-muted">Tipo: </span>
                        {typeLabel}
                      </p>
                      <p>
                        <span className="text-limbi-muted">Origen: </span>
                        {meta.source_generated_content_id
                          ? "Versión refinada"
                          : "Generada desde el Marco"}
                      </p>
                      {meta.refinement_preset ? (
                        <p>
                          <span className="text-limbi-muted">Ajuste: </span>
                          <span className="text-limbi-text">
                            {refinementPresetDisplayLabel(
                              meta.refinement_preset,
                            )}
                          </span>
                        </p>
                      ) : null}
                      {meta.user_note ? (
                        <p>
                          <span className="text-limbi-muted">Nota: </span>
                          <span className="whitespace-pre-wrap text-limbi-text">
                            {meta.user_note}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <details className="mt-3 group/inner [&_summary::-webkit-details-marker]:hidden">
                      <summary className="cursor-pointer text-xs font-medium text-limbi-green underline decoration-limbi-green/30 underline-offset-4">
                        Ver contenido de esta versión
                      </summary>
                      <div className="mt-3 border-t border-limbi-border/70 pt-3">
                        {renderItemsForType(
                          activeType,
                          readItems(row.output),
                          (m) => setError(m),
                        )}
                      </div>
                    </details>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <CopyPlainTextButton
                        text={formatGeneratedContentForCopy(
                          activeType,
                          readItems(row.output),
                        )}
                        onError={(m) => setError(m)}
                        disabled={busy}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn("gap-2", limbiOutlineButtonClass)}
                        disabled={busy}
                        onClick={() => {
                          setRefinementSuccess(null);
                          setError(null);
                          setRefiningTarget({
                            rowId: row.id,
                            contentType: activeType,
                          });
                        }}
                      >
                        <PenLine className="size-4" aria-hidden />
                        Ajuste creativo
                      </Button>
                    </div>
                    {refiningTarget?.rowId === row.id &&
                    refiningTarget.contentType === activeType ? (
                      <CreativeRefinePanel
                        key={`refine-${row.id}-${activeType}`}
                        projectId={projectId}
                        sourceRowId={row.id}
                        disabled={busy}
                        onClose={() => {
                          setRefiningTarget(null);
                        }}
                        onRefineError={(msg) => setError(msg)}
                        onSuccess={() => {
                          setError(null);
                          setRefiningTarget(null);
                          setRefinementSuccess("Versión refinada creada.");
                          void load();
                        }}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
