"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BrandFieldImprovementContextPayload } from "@/lib/brands/build-brand-field-improvement-context";
import { brandFieldImproveTurnOutputSchema } from "@/lib/schemas/brand-field-improvement";
import {
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import type { QuestionDefinitionRow } from "@/types/database";

const MAX_USER_TURNS = 6;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  brandId: string;
  definition: QuestionDefinitionRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: (args: { proposedText: string }) => void;
};

function buildConversationExcerpt(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "Usuario" : "Limbi"}: ${m.content}`)
    .join("\n\n");
}

export function BrandQuestionFieldImproveDialog({
  brandId,
  definition,
  open,
  onOpenChange,
  onApplied,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [context, setContext] = useState<BrandFieldImprovementContextPayload | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [proposal, setProposal] = useState<{
    proposed_answer_text: string;
    rationale: string | null;
    assistant_message: string;
  } | null>(null);
  const [userTurnCount, setUserTurnCount] = useState(0);
  const [appliedNotice, setAppliedNotice] = useState<{
    diagnosisIsStale: boolean;
    hasActiveBases: boolean;
    basesStale: boolean;
  } | null>(null);
  const messagesEndRef = useRef<HTMLLIElement | null>(null);

  const encKey = encodeURIComponent(definition.question_key);
  const turnsRemaining = Math.max(0, MAX_USER_TURNS - userTurnCount);

  const resetState = useCallback(() => {
    setLoadError(null);
    setActionError(null);
    setContext(null);
    setMessages([]);
    setInput("");
    setProposal(null);
    setUserTurnCount(0);
    setAppliedNotice(null);
  }, []);

  const loadContext = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/brands/${brandId}/field-improve/${encKey}`,
        { cache: "no-store" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        context_ok?: boolean;
        context_error?: { message?: string };
        field_improvement_context?: BrandFieldImprovementContextPayload | null;
        can_improve_field?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo cargar el asistente.");
      }
      if (!data.can_improve_field || !data.field_improvement_context) {
        throw new Error(
          data.context_error?.message ??
            "Esta pregunta no admite «Mejorar con Limbi» en este momento.",
        );
      }
      setContext(data.field_improvement_context);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Error al cargar.");
    } finally {
      setLoading(false);
    }
  }, [brandId, encKey]);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    void loadContext();
  }, [open, loadContext, resetState]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, proposal]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || turnsRemaining <= 0) return;
    setBusy(true);
    setActionError(null);
    setProposal(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setUserTurnCount((c) => c + 1);

    try {
      const res = await fetch(`/api/brands/${brandId}/field-improve/${encKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_message: text,
          conversation_excerpt: buildConversationExcerpt(messages),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        turn?: unknown;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo enviar el mensaje.");
      }
      const parsed = brandFieldImproveTurnOutputSchema.safeParse(data.turn);
      if (!parsed.success) {
        throw new Error("Respuesta del asistente inválida.");
      }
      const turn = parsed.data;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: turn.assistant_message },
      ]);
      if (turn.conversation_state === "proposal_ready" && turn.proposed_answer_text) {
        setProposal({
          proposed_answer_text: turn.proposed_answer_text,
          rationale: turn.rationale,
          assistant_message: turn.assistant_message,
        });
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al enviar.");
    } finally {
      setBusy(false);
    }
  }, [brandId, busy, encKey, input, messages, turnsRemaining]);

  const applyProposal = useCallback(async () => {
    if (!proposal || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/field-improve/${encKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposed_answer_text: proposal.proposed_answer_text,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        diagnosis_is_stale?: boolean;
        has_active_bases?: boolean;
        bases_stale?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo guardar la mejora.");
      }
      onApplied({ proposedText: proposal.proposed_answer_text });
      setAppliedNotice({
        diagnosisIsStale: Boolean(data.diagnosis_is_stale),
        hasActiveBases: Boolean(data.has_active_bases),
        basesStale: Boolean(data.bases_stale),
      });
      setProposal(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setBusy(false);
    }
  }, [brandId, busy, encKey, onApplied, proposal]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-improve-title"
        className={cn(
          "flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-limbi-border bg-limbi-surface shadow-xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-limbi-border px-5 py-4">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-limbi-muted">
              <Sparkles className="size-3.5 text-limbi-green" aria-hidden />
              Mejorar con Limbi
            </p>
            <h2 id="field-improve-title" className="text-base font-semibold text-limbi-text">
              {definition.question_text}
            </h2>
            {context?.section_label ? (
              <p className="text-sm text-limbi-muted">Sección: {context.section_label}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-limbi-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Preparando contexto de marca…
            </p>
          ) : null}
          {loadError ? (
            <p className="text-sm text-red-600" role="alert">
              {loadError}
            </p>
          ) : null}

          {appliedNotice ? (
            <div
              className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              <p className="font-medium">Respuesta actualizada en el cuestionario.</p>
              {appliedNotice.diagnosisIsStale ? (
                <p className="mt-1 leading-relaxed">
                  El diagnóstico quedó desactualizado.{" "}
                  <Link
                    href={`/brands/${brandId}`}
                    className="font-medium underline underline-offset-2"
                  >
                    Actualizar diagnóstico
                  </Link>{" "}
                  desde el dashboard de la marca.
                </p>
              ) : null}
              {appliedNotice.hasActiveBases && appliedNotice.basesStale ? (
                <p className="mt-1 leading-relaxed">
                  La Base de Marca también quedó desactualizada. Cuando el diagnóstico esté al día,{" "}
                  <Link
                    href={`/brands/${brandId}/bases`}
                    className="font-medium underline underline-offset-2"
                  >
                    actualizá la Base de Marca
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          ) : null}

          {context && !loading && !loadError ? (
            <>
              <div className="rounded-xl border border-limbi-border/80 bg-limbi-surface-soft/60 px-3 py-2 text-sm text-limbi-muted">
                <p className="font-medium text-limbi-text">Respuesta actual</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {context.target_question.current_answer_text?.trim() ||
                    "[Sin respuesta guardada aún]"}
                </p>
              </div>

              {messages.length === 0 && !proposal ? (
                <p className="text-sm text-limbi-muted">
                  Limbi tiene el diagnóstico de esta sección y el resto de respuestas de la marca.
                  Contale qué querés mejorar o pedile una propuesta directa.
                </p>
              ) : null}

              <ul className="space-y-3">
                {messages.map((m, i) => (
                  <li
                    key={i}
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm leading-relaxed",
                      m.role === "user"
                        ? "ml-8 bg-limbi-green/10 text-limbi-text"
                        : "mr-8 border border-limbi-border bg-limbi-surface-soft text-limbi-text",
                    )}
                  >
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-limbi-muted">
                      {m.role === "user" ? "Tú" : "Limbi"}
                    </span>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </li>
                ))}
                <li ref={messagesEndRef} />
              </ul>

              {proposal ? (
                <div className="space-y-3 rounded-xl border border-limbi-green/30 bg-limbi-green/5 p-4">
                  <p className="text-sm font-medium text-limbi-text">Propuesta para aprobar</p>
                  <p className="whitespace-pre-wrap text-sm text-limbi-text">
                    {proposal.proposed_answer_text}
                  </p>
                  {proposal.rationale ? (
                    <p className="text-sm text-limbi-muted">
                      <span className="font-medium">Por qué:</span> {proposal.rationale}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className={limbiPrimaryButtonClass}
                      disabled={busy}
                      onClick={() => void applyProposal()}
                    >
                      {busy ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                          Guardando…
                        </>
                      ) : (
                        "Aprobar y actualizar respuesta"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={limbiOutlineButtonClass}
                      disabled={busy}
                      onClick={() => setProposal(null)}
                    >
                      Seguir conversando
                    </Button>
                  </div>
                </div>
              ) : null}

              {actionError ? (
                <p className="text-sm text-red-600" role="alert">
                  {actionError}
                </p>
              ) : null}

              {!proposal && !appliedNotice ? (
                <div className="space-y-2 border-t border-limbi-border pt-3">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      turnsRemaining > 0
                        ? "Escribí tu mensaje o pedí una mejora concreta…"
                        : "Alcanzaste el máximo de mensajes en esta sesión."
                    }
                    disabled={busy || turnsRemaining <= 0}
                    rows={3}
                    className="resize-y rounded-xl border-limbi-border bg-limbi-surface"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-limbi-muted">
                      {turnsRemaining > 0
                        ? `${turnsRemaining} mensaje${turnsRemaining === 1 ? "" : "s"} restante${turnsRemaining === 1 ? "" : "s"}`
                        : "Sin mensajes restantes"}
                    </p>
                    <Button
                      type="button"
                      className={limbiPrimaryButtonClass}
                      disabled={busy || !input.trim() || turnsRemaining <= 0}
                      onClick={() => void sendMessage()}
                    >
                      {busy ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                          Pensando…
                        </>
                      ) : (
                        "Enviar"
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
