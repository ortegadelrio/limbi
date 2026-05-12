"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BrandSectionImprovementContextPayload } from "@/lib/brands/build-brand-section-improvement-context";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";
import type { BrandDiagnosisSectionScoreParsed } from "@/lib/schemas/brand-diagnosis";
import { brandSectionImproveTurnOutputSchema } from "@/lib/schemas/brand-section-improvement";
import {
  limbiDocumentCardClass,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { QualityScoreRing } from "@/components/projects/quality-score-ring";
import { cn } from "@/lib/utils";
import {
  buildQuestionKeyDisplayLabelMap,
  displayLabelForQuestionKey,
} from "@/lib/brands/question-key-display-label";
import type {
  BrandImprovementMessageRow,
  BrandImprovementSessionRow,
  BrandSectionImprovementRow,
} from "@/types/database";

type SectionSummary = {
  section_key: string;
  pending_review_count: number;
  has_active_diagnosis: boolean;
  context_ok: boolean;
  context_error: { code: string; message: string } | null;
  diagnosis_section: BrandDiagnosisSectionScoreParsed | null;
  active_improvement: BrandSectionImprovementRow | null;
  open_session: BrandImprovementSessionRow | null;
  improvement_context: BrandSectionImprovementContextPayload | null;
};

type Props = {
  brandId: string;
  brandName: string;
  sectionKey: string;
};

function qualityLevelLabelEs(level: string): string {
  switch (level) {
    case "critical":
      return "Crítico";
    case "weak":
      return "Débil";
    case "acceptable":
      return "Aceptable";
    case "strong":
      return "Sólido";
    case "excellent":
      return "Excelente";
    default:
      return level;
  }
}

function priorityLabelEs(p: string): string {
  if (p === "high") return "Alta";
  if (p === "medium") return "Media";
  if (p === "low") return "Baja";
  return p;
}

function conversationStateLabelEs(state: string): string {
  switch (state) {
    case "asking_questions":
      return "Afinando información";
    case "draft_ready":
      return "Propuesta lista";
    case "needs_user_decision":
      return "Pendiente de decisión";
    case "completed":
      return "Completado";
    case "blocked":
      return "Bloqueado";
    default:
      return "En revisión";
  }
}

function confidenceLabelEs(confidence: string): string {
  switch (confidence) {
    case "low":
      return "Baja";
    case "medium":
      return "Media";
    case "high":
      return "Alta";
    default:
      return "Media";
  }
}

export function BrandSectionImproveClient({ brandId, brandName, sectionKey }: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState<SectionSummary | null>(null);
  const [session, setSession] = useState<BrandImprovementSessionRow | null>(null);
  const [messages, setMessages] = useState<BrandImprovementMessageRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [justApproved, setJustApproved] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLLIElement | null>(null);
  const draftPanelRef = useRef<HTMLDivElement | null>(null);

  const sectionTitle = brandQuestionnaireSectionLabelEs(sectionKey);

  const loadSummary = useCallback(async (): Promise<SectionSummary | null> => {
    setLoadError(null);
    const enc = encodeURIComponent(sectionKey);
    const sRes = await fetch(`/api/brands/${brandId}/improve/sections/${enc}`, {
      cache: "no-store",
    });
    if (!sRes.ok) {
      setLoadError("No se pudo cargar la sección.");
      return null;
    }
    const data = (await sRes.json()) as SectionSummary;
    setSummary(data);
    return data;
  }, [brandId, sectionKey]);

  const hydrateOpenSession = useCallback(
    async (data: SectionSummary) => {
      if (data.open_session) {
        const mRes = await fetch(
          `/api/brands/${brandId}/improve/sessions/${data.open_session.id}`,
          { cache: "no-store" },
        );
        if (mRes.ok) {
          const bundle = (await mRes.json()) as {
            session: BrandImprovementSessionRow;
            messages: BrandImprovementMessageRow[];
          };
          setSession(bundle.session);
          setMessages(bundle.messages);
          return;
        }
      }
      setSession(null);
      setMessages([]);
    },
    [brandId],
  );

  const loadAll = useCallback(async () => {
    const data = await loadSummary();
    if (data) await hydrateOpenSession(data);
  }, [loadSummary, hydrateOpenSession]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const draftParsed = useMemo(() => {
    if (!session?.draft_payload) return null;
    return brandSectionImproveTurnOutputSchema.safeParse(session.draft_payload);
  }, [session]);

  const ctx = summary?.improvement_context ?? null;
  const questionLabelByKey = useMemo(
    () => buildQuestionKeyDisplayLabelMap(ctx?.question_definitions ?? []),
    [ctx?.question_definitions],
  );

  const turnsRemaining = session
    ? Math.max(0, session.max_user_turns - session.user_turn_count)
    : 8;

  const canSendMessage =
    session &&
    (session.status === "open" || session.status === "draft_ready") &&
    turnsRemaining > 0 &&
    !busy;

  const showDraftPanel =
    draftParsed?.success &&
    (draftParsed.data.conversation_state === "draft_ready" ||
      draftParsed.data.proposed_changes.length > 0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (showDraftPanel) {
      draftPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [showDraftPanel, session?.updated_at]);

  useEffect(() => {
    if (!justApproved) return;
    const timeout = window.setTimeout(() => {
      router.push(`/brands/${brandId}/diagnosis`);
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [brandId, justApproved, router]);

  const handleApiError = useCallback(
    async (res: Response) => {
      let code: string | undefined;
      let message = res.statusText;
      try {
        const j = (await res.json()) as { error?: string; code?: string };
        message = j.error ?? message;
        code = j.code;
      } catch {
        /* ignore */
      }
      if (res.status === 409 && code === "pending_review_blocking") {
        router.push(`/brands/${brandId}/source-facts`);
        return;
      }
      if (res.status === 409 && code === "diagnosis_required") {
        router.push(`/brands/${brandId}/diagnosis`);
        return;
      }
      setActionError(message);
    },
    [brandId, router],
  );

  const startSession = async () => {
    setActionError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/improve/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section_key: sectionKey }),
      });
      if (!res.ok) {
        await handleApiError(res);
        return;
      }
      const data = (await res.json()) as {
        session: BrandImprovementSessionRow;
        messages: BrandImprovementMessageRow[];
      };
      setSession(data.session);
      setMessages(data.messages);
      await loadSummary();
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!session || !input.trim()) return;
    setActionError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/brands/${brandId}/improve/sessions/${session.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: input.trim() }),
        },
      );
      if (!res.ok) {
        await handleApiError(res);
        return;
      }
      const data = (await res.json()) as {
        session: BrandImprovementSessionRow;
        messages: BrandImprovementMessageRow[];
      };
      setSession(data.session);
      setMessages(data.messages);
      setInput("");
      await loadSummary();
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!session) return;
    setActionError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/brands/${brandId}/improve/sessions/${session.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        await handleApiError(res);
        return;
      }
      setJustApproved(true);
      setSession(null);
      setMessages([]);
      await loadSummary();
    } finally {
      setBusy(false);
    }
  };

  const abandon = async () => {
    if (!session) return;
    setActionError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/brands/${brandId}/improve/sessions/${session.id}/abandon`,
        { method: "POST" },
      );
      if (!res.ok) {
        await handleApiError(res);
        return;
      }
      setSession(null);
      setMessages([]);
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  if (loadError || !summary) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-limbi-muted">
          {loadError ?? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </span>
          )}
        </p>
      </div>
    );
  }

  if (justApproved) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-limbi-text">Mejora aprobada</h1>
        <p className="mt-3 inline-flex items-center justify-center gap-2 text-sm leading-relaxed text-limbi-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Volviendo al diagnóstico…
        </p>
      </div>
    );
  }

  const pendingBlock = summary.pending_review_count > 0;
  const noDiagnosis = !summary.has_active_diagnosis;
  const ctxErr = summary.context_error;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 text-limbi-muted" asChild>
          <Link href={`/brands/${brandId}/diagnosis`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Diagnóstico
          </Link>
        </Button>
        <span className="text-limbi-muted">·</span>
        <span className="text-sm text-limbi-muted">{brandName}</span>
      </div>

      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-limbi-text">{sectionTitle}</h1>
        <p className="text-sm text-limbi-muted">
          Mejora asistida por sección. Limbi actúa como editor estratégico; no modifica tu
          cuestionario hasta que consolidés en un paso futuro.
        </p>
      </header>

      {pendingBlock ? (
        <div
          className={cn(
            limbiDocumentCardClass,
            "mb-6 border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-limbi-text",
          )}
        >
          <p className="font-medium">Hay hallazgos pendientes de revisión</p>
          <p className="mt-1 text-limbi-muted">
            Revisá la bandeja de fuentes antes de iniciar o continuar una sesión de mejora.
          </p>
          <Button className={cn(limbiPrimaryButtonClass, "mt-4")} asChild>
            <Link href={`/brands/${brandId}/source-facts`}>Ir a hallazgos</Link>
          </Button>
        </div>
      ) : null}

      {noDiagnosis && !pendingBlock ? (
        <div
          className={cn(
            limbiDocumentCardClass,
            "mb-6 border border-limbi-border p-4 text-sm",
          )}
        >
          <p className="font-medium text-limbi-text">Necesitás un diagnóstico activo</p>
          <p className="mt-1 text-limbi-muted">
            Generá o activá un diagnóstico concluido para esta marca antes de mejorar una sección.
          </p>
          <Button className={cn(limbiPrimaryButtonClass, "mt-4")} asChild>
            <Link href={`/brands/${brandId}/diagnosis`}>Ir al diagnóstico</Link>
          </Button>
        </div>
      ) : null}

      {ctxErr && !pendingBlock ? (
        <div
          className={cn(
            limbiDocumentCardClass,
            "mb-6 border border-limbi-border p-4 text-sm text-limbi-muted",
          )}
        >
          <p className="font-medium text-limbi-text">No se puede mejorar esta sección</p>
          <p className="mt-1">{ctxErr.message}</p>
        </div>
      ) : null}

      {summary.diagnosis_section && ctx && !ctxErr ? (
        <div
          className={cn(
            limbiDocumentCardClass,
            "mb-6 border border-limbi-border p-4 sm:p-5",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <QualityScoreRing
              score={summary.diagnosis_section.score}
              size="sm"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-limbi-muted">
                  Diagnóstico de la sección
                </p>
                <p className="mt-1 text-xs text-limbi-muted">
                  {qualityLevelLabelEs(summary.diagnosis_section.quality_level)} · Prioridad:{" "}
                  {priorityLabelEs(summary.diagnosis_section.priority)}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-limbi-muted">
                {summary.diagnosis_section.diagnosis}
              </p>
              {summary.diagnosis_section.gaps.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-limbi-text">Principales vacíos</p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-limbi-muted">
                    {summary.diagnosis_section.gaps.slice(0, 6).map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {summary.diagnosis_section.recommendations.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-limbi-text">Recomendaciones</p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-limbi-muted">
                    {summary.diagnosis_section.recommendations.slice(0, 6).map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {ctx && !ctxErr ? (
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className={cn(limbiDocumentCardClass, "border border-limbi-border p-4")}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-limbi-muted">
              Información actual
            </h2>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs text-limbi-muted">
              {ctx.brand_responses.map((r) => (
                <li key={r.question_key} className="rounded-lg bg-limbi-surface/50 px-3 py-2">
                  <p className="font-medium text-limbi-text">
                    {displayLabelForQuestionKey(r.question_key, questionLabelByKey)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">
                    {r.answer_text?.trim() ||
                      (typeof r.answer_value === "object"
                        ? JSON.stringify(r.answer_value)
                        : String(r.answer_value ?? ""))}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className={cn(limbiDocumentCardClass, "border border-limbi-border p-4")}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-limbi-muted">
              Hallazgos aprobados (esta sección)
            </h2>
            {ctx.approved_source_facts.length === 0 ? (
              <p className="mt-3 text-xs text-limbi-muted">No hay hallazgos aprobados vinculados.</p>
            ) : (
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs text-limbi-muted">
                {ctx.approved_source_facts.map((f, i) => (
                  <li key={i} className="rounded-lg bg-limbi-surface/50 px-3 py-2">
                    <p className="whitespace-pre-wrap">{f.usable_text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {summary.active_improvement && !session ? (
        <div
          className={cn(
            limbiDocumentCardClass,
            "mb-6 border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm",
          )}
        >
          <p className="font-medium text-limbi-text">Ya hay una mejora aprobada para esta sección</p>
          <p className="mt-1 text-xs text-limbi-muted">
            Podés iniciar una nueva sesión para refinar; al aprobar de nuevo, la versión anterior
            quedará reemplazada.
          </p>
        </div>
      ) : null}

      {!session && summary.context_ok && !pendingBlock && !noDiagnosis && !ctxErr ? (
        <div className="mb-8">
          <Button
            className={limbiPrimaryButtonClass}
            disabled={busy}
            type="button"
            onClick={() => void startSession()}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando…
              </>
            ) : (
              "Iniciar sesión de mejora"
            )}
          </Button>
        </div>
      ) : null}

      {session ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div
              className={cn(
                limbiDocumentCardClass,
                "flex flex-wrap items-center justify-between gap-2 border border-limbi-border px-4 py-3 text-sm",
              )}
            >
              <span className="text-limbi-muted">
                Turnos restantes:{" "}
                <span className="font-medium text-limbi-text">{turnsRemaining}</span> /{" "}
                {session.max_user_turns}
              </span>
              {draftParsed?.success && draftParsed.data.should_warn_max_turns ? (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Quedan pocos turnos: conviene cerrar o aprobar el borrador.
                </span>
              ) : null}
            </div>

            <div
              className={cn(
                limbiDocumentCardClass,
                "min-h-[280px] border border-limbi-border p-4",
              )}
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-limbi-muted">
                Conversación
              </h2>
              <ul className="mt-4 max-h-[420px] space-y-4 overflow-y-auto pr-1 text-sm">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      "rounded-xl px-3 py-2",
                      m.role === "user"
                        ? "ml-4 bg-limbi-surface text-limbi-text"
                        : "mr-4 border border-limbi-border bg-limbi-surface/40 text-limbi-muted",
                    )}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-limbi-muted">
                      {m.role === "user" ? "Vos" : "Limbi"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  </li>
                ))}
                <li ref={messagesEndRef} aria-hidden className="h-px" />
              </ul>
            </div>

            {session.status === "failed" ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                La sesión falló{session.error_message ? `: ${session.error_message}` : "."}{" "}
                Iniciá una nueva sesión cuando quieras.
              </p>
            ) : null}

            <div className="space-y-2">
              <Textarea
                ref={chatInputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tu respuesta o comentario…"
                rows={3}
                disabled={!canSendMessage}
                className="resize-none border-limbi-border bg-limbi-surface"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className={limbiPrimaryButtonClass}
                  disabled={!canSendMessage || !input.trim()}
                  onClick={() => void sendMessage()}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
                </Button>
                <Button variant="outline" className={limbiOutlineButtonClass} asChild>
                  <Link href={`/brands/${brandId}/diagnosis`}>Volver al diagnóstico</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-2">
            {showDraftPanel && draftParsed?.success ? (
              <div
                ref={draftPanelRef}
                className={cn(limbiDocumentCardClass, "border border-emerald-500/40 p-4")}
              >
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-limbi-muted">
                  Propuesta (borrador)
                </h2>
                <span className="mt-2 inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
                  {conversationStateLabelEs(draftParsed.data.conversation_state)}
                </span>
                <ul className="mt-4 max-h-[360px] space-y-4 overflow-y-auto text-xs">
                  {draftParsed.data.proposed_changes.map((c, i) => (
                    <li
                      key={`${c.question_key}-${i}`}
                      className="rounded-lg border border-limbi-border bg-limbi-surface/40 p-3"
                    >
                      <p className="font-medium text-limbi-text">
                        {displayLabelForQuestionKey(c.question_key, questionLabelByKey)}
                      </p>
                      <p className="mt-1 text-limbi-muted">
                        <span className="font-medium text-limbi-text">Resumen actual: </span>
                        {c.current_summary}
                      </p>
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-limbi-muted">
                        Propuesta mejorada
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-limbi-text">
                        {c.proposed_improved_text}
                      </p>
                      <p className="mt-2 text-limbi-muted">
                        <span className="font-medium">Por qué mejora: </span>
                        {c.rationale}
                      </p>
                      <p className="mt-1 text-[10px] uppercase text-limbi-muted">
                        Nivel de confianza: {confidenceLabelEs(c.confidence)}
                      </p>
                    </li>
                  ))}
                </ul>
                {draftParsed.data.remaining_gaps.length > 0 ? (
                  <div className="mt-4 border-t border-limbi-border pt-3">
                    <p className="text-xs font-medium text-limbi-text">Vacíos pendientes</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-limbi-muted">
                      {draftParsed.data.remaining_gaps.map((g, i) => (
                        <li key={i}>
                          <span className="font-medium text-limbi-text">Vacío pendiente: </span>
                          {g.gap}
                          <span className="block text-[10px]">
                            <span className="font-medium">Por qué importa: </span>
                            {g.why_it_matters}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {session.status === "open" || session.status === "draft_ready" ? (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  className={limbiPrimaryButtonClass}
                  disabled={
                    busy ||
                    draftParsed?.success !== true ||
                    draftParsed.data.proposed_changes.length === 0
                  }
                  onClick={() => void approve()}
                >
                  Aprobar mejora
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={limbiOutlineButtonClass}
                  disabled={busy}
                  onClick={() => {
                    chatInputRef.current?.focus();
                    chatInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  Seguir ajustando
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={limbiOutlineButtonClass}
                  disabled={busy}
                  onClick={() => void abandon()}
                >
                  Dejar pendiente
                </Button>
                <Button variant="ghost" className="text-limbi-muted" asChild>
                  <Link href={`/brands/${brandId}/diagnosis`}>Volver al diagnóstico</Link>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {actionError ? (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400">{actionError}</p>
      ) : null}
    </div>
  );
}
