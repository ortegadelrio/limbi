"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OperationalSummaryCard } from "@/components/brainstormer/operational-summary-card";
import {
  applyTurnSnapshotUpdate,
  isSnapshotNewer,
} from "@/lib/brainstormer/apply-turn-snapshot-update";
import { ArrowLeft, Loader2, Pause, Play, DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { limbiDocumentCardClass, limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import {
  coerceBrainstormerSessionProgress,
  type BrainstormerSuggestedProjectType,
} from "@/lib/schemas/brainstormer-session";
import { formatThinkingModelChipLabel } from "@/lib/ai/thinking-models";
import { coerceSessionThinkingModelKey } from "@/lib/brainstormer/session-thinking-model";
import type {
  BrainstormBrandContextStatus,
  BrainstormMessageRow,
  BrainstormSessionRow,
  BrainstormSessionSnapshotRow,
  BrainstormSessionStatus,
} from "@/types/database";

const FROZEN_NOTE =
  "Esta sesión usa la versión de Base de Marca y Base Límbica guardada al crearla. Si consolidaste de nuevo en otras partes de Limbi, aquí seguimos con esta versión hasta que exista «actualizar contexto de sesión».";

function statusLabel(s: BrainstormSessionStatus): string {
  switch (s) {
    case "open":
      return "Abierta";
    case "paused":
      return "Pausada";
    case "closed":
      return "Cerrada";
    case "converted_to_project_base":
      return "Cerrada";
    default:
      return s;
  }
}

function contextLabel(c: BrainstormBrandContextStatus): string {
  switch (c) {
    case "ready":
      return "Contexto listo";
    case "advisory":
      return "Contexto con advertencias";
    case "blocked":
      return "Contexto bloqueado";
    default:
      return c;
  }
}

function suggestedProjectTypeLabel(t: BrainstormerSuggestedProjectType): string {
  switch (t) {
    case "campaign_360":
      return "Campaña 360";
    case "content_generation":
      return "Generación de contenido";
    case "brand_activation":
      return "Activación de marca";
    case "audiovisual":
      return "Producción audiovisual";
    case "event_promotion":
      return "Promoción de evento";
    case "other":
      return "Proyecto de comunicación";
  }
}

export function BrainstormerSessionPanel(props: {
  sessionId: string;
  initialSession: BrainstormSessionRow;
  initialMessages: BrainstormMessageRow[];
  initialSnapshot: BrainstormSessionSnapshotRow | null;
  brandName: string;
}) {
  const router = useRouter();
  const [session, setSession] = useState(props.initialSession);
  const [messages, setMessages] = useState(props.initialMessages);
  const [snapshot, setSnapshot] = useState(props.initialSnapshot);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [patching, setPatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const incoming = props.initialSnapshot;
    if (!incoming) return;
    setSnapshot((prev) => (isSnapshotNewer(prev, incoming) ? incoming : prev));
  }, [props.initialSnapshot]);

  const sessionProgress = useMemo(
    () => coerceBrainstormerSessionProgress(snapshot?.snapshot_payload ?? null),
    [snapshot],
  );

  const thinkingChipLabel = useMemo(
    () =>
      formatThinkingModelChipLabel({
        thinking_model_key: coerceSessionThinkingModelKey(session.thinking_model_key),
        resolved_primary_model_key: session.resolved_primary_model_key
          ? coerceSessionThinkingModelKey(session.resolved_primary_model_key)
          : null,
        resolved_secondary_model_key: session.resolved_secondary_model_key
          ? coerceSessionThinkingModelKey(session.resolved_secondary_model_key)
          : null,
      }),
    [
      session.resolved_primary_model_key,
      session.resolved_secondary_model_key,
      session.thinking_model_key,
    ],
  );

  const showProjectMaturityCard = sessionProgress.should_suggest_project_conversion === true;

  const projectMaturityTitle =
    sessionProgress.project_readiness === "high"
      ? "Esto ya tiene forma de proyecto"
      : "Esto empieza a tomar forma de proyecto";

  const canSend = useMemo(() => {
    if (session.status === "closed" || session.status === "converted_to_project_base") return false;
    if (session.status === "paused") return false;
    if (session.brand_context_status === "blocked") return false;
    return true;
  }, [session.brand_context_status, session.status]);

  const advisoryBanner =
    session.brand_context_status === "advisory"
      ? "Hay información pendiente o señales de desactualización. Puedes continuar usando la versión actual de la marca, pero conviene revisar la base más adelante."
      : null;

  const blockedBanner =
    session.brand_context_status === "blocked"
      ? "Esta marca todavía no tiene una Base de Marca activa suficiente para iniciar Brainstormer. Primero debes consolidar o actualizar la marca."
      : null;

  async function patchSession(body: { status?: BrainstormSessionStatus; title?: string }) {
    setPatching(true);
    setError(null);
    try {
      const res = await fetch(`/api/brainstormer/sessions/${props.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as {
        session?: BrainstormSessionRow;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "No se pudo actualizar la sesión.");
      if (j.session) setSession(j.session);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar.");
    } finally {
      setPatching(false);
    }
  }

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || !canSend || sending) return;
    setSending(true);
    setError(null);
    setInput("");
    try {
      const res = await fetch(`/api/brainstormer/sessions/${props.sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        messages?: BrainstormMessageRow[];
        snapshot?: BrainstormSessionSnapshotRow | null;
        session_progress?: ReturnType<typeof coerceBrainstormerSessionProgress>;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "No se pudo enviar el mensaje.");
      if (j.messages) setMessages(j.messages);
      setSnapshot((prev) =>
        applyTurnSnapshotUpdate({
          previous: prev,
          snapshotFromApi: j.snapshot,
          sessionProgress: j.session_progress,
          sessionId: props.sessionId,
          userId: session.user_id,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar.");
    } finally {
      setSending(false);
    }
  }, [canSend, input, props.sessionId, sending, session.user_id]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1 rounded-xl" asChild>
          <Link href="/brainstormer">
            <ArrowLeft className="size-4" aria-hidden />
            Sesiones
          </Link>
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {session.status === "open" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 rounded-xl"
              disabled={patching}
              onClick={() => void patchSession({ status: "paused" })}
            >
              <Pause className="size-4" aria-hidden />
              Pausar sesión
            </Button>
          ) : null}
          {session.status === "paused" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 rounded-xl"
              disabled={patching}
              onClick={() => void patchSession({ status: "open" })}
            >
              <Play className="size-4" aria-hidden />
              Continuar
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 rounded-xl text-limbi-muted"
            disabled={patching}
            asChild
          >
            <Link href="/brainstormer">
              <DoorOpen className="size-4" aria-hidden />
              Salir
            </Link>
          </Button>
        </div>
      </div>

      <header className="mb-6 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
          Brainstormer · {props.brandName}
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-limbi-text sm:text-3xl">
          {session.title}
        </h1>
        <div className="flex flex-wrap gap-2 text-xs text-limbi-muted">
          <span
            className="rounded-lg border border-limbi-green/30 bg-limbi-green/[0.08] px-2 py-1 font-medium text-limbi-text"
            title={
              session.creative_orientation_summary?.trim() ||
              "Modelo de pensamiento activo en esta sesión"
            }
          >
            Pensando como: {thinkingChipLabel}
          </span>
          <span className="rounded-lg border border-limbi-border bg-limbi-bg-soft/50 px-2 py-1">
            Sesión: {statusLabel(session.status)}
          </span>
          <span className="rounded-lg border border-limbi-border bg-limbi-bg-soft/50 px-2 py-1">
            {contextLabel(session.brand_context_status)}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-limbi-muted">{FROZEN_NOTE}</p>
      </header>

      {blockedBanner ? (
        <p className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
          {blockedBanner}
        </p>
      ) : null}
      {advisoryBanner && session.brand_context_status === "advisory" ? (
        <p className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100/90">
          {advisoryBanner}
        </p>
      ) : null}

      <OperationalSummaryCard progress={sessionProgress} />

      <div className={cn(limbiDocumentCardClass, "flex min-h-[320px] flex-1 flex-col p-4 sm:p-5")}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="text-sm text-limbi-muted">No hay mensajes todavía.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[95%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-limbi-green/[0.12] text-limbi-text"
                    : "mr-auto border border-limbi-border bg-limbi-surface text-limbi-text",
                )}
              >
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-limbi-muted">
                  {m.role === "user" ? "Vos" : "Limbi"}
                </span>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))
          )}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 border-t border-limbi-border/80 pt-4 sm:flex-row sm:items-end">
          <textarea
            ref={messageInputRef}
            className="min-h-[88px] flex-1 resize-y rounded-xl border border-limbi-border bg-limbi-surface px-3 py-2.5 text-sm text-limbi-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35 disabled:opacity-50"
            placeholder={
              canSend ? "Escribí tu mensaje…" : "No podés enviar mensajes en este estado de sesión."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!canSend || sending}
            maxLength={100_000}
          />
          <Button
            type="button"
            className={cn("h-11 shrink-0 sm:min-w-[7rem]", limbiPrimaryButtonClass)}
            disabled={!canSend || sending || !input.trim()}
            onClick={() => void send()}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Enviando
              </>
            ) : (
              "Enviar"
            )}
          </Button>
        </div>
      </div>

      {showProjectMaturityCard ? (
        <aside
          className="mt-6 rounded-2xl border border-limbi-green/25 bg-limbi-green/[0.06] px-4 py-4 shadow-sm sm:px-5 sm:py-5"
          aria-label="Avance hacia proyecto"
        >
          <p className="font-heading text-base font-semibold text-limbi-text sm:text-lg">
            {projectMaturityTitle}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-limbi-muted">
            Limbi detectó que esta sesión ya tiene suficiente estructura para convertirse más adelante
            en una base preliminar de proyecto. Por ahora podés seguir pensando, ajustar la ruta o dejar
            guardada esta conversación.
          </p>

          <p className="mt-3 text-xs text-limbi-muted">
            <span className="font-medium text-limbi-text">Tipo sugerido: </span>
            <span className="rounded-md border border-limbi-border bg-limbi-surface/80 px-2 py-0.5 text-limbi-text">
              {suggestedProjectTypeLabel(sessionProgress.suggested_project_type)}
            </span>
          </p>

          {sessionProgress.project_seed_summary.trim().length > 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-limbi-text">
              <span className="font-medium">Ruta detectada: </span>
              {sessionProgress.project_seed_summary.trim()}
            </p>
          ) : null}

          {sessionProgress.missing_project_inputs.length > 0 ? (
            <div className="mt-3 text-sm text-limbi-muted">
              <p className="font-medium text-limbi-text">Para convertirlo mejor después, faltaría precisar:</p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 pl-0.5">
                {sessionProgress.missing_project_inputs.slice(0, 3).map((item, i) => (
                  <li key={`${i}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 border-t border-limbi-green/15 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full rounded-xl border-limbi-border sm:w-auto"
              onClick={() => messageInputRef.current?.focus()}
            >
              Seguir pensando
            </Button>
            <p className="text-xs leading-relaxed text-limbi-muted sm:max-w-md">
              Próximo paso: convertir esta sesión en una base preliminar de proyecto. Disponible en el
              siguiente paso de Brainstormer.
            </p>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
