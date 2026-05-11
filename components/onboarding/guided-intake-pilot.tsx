"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import {
  GUIDED_CHALLENGE_PICKS,
  GUIDED_MINI_STEPS,
  questionForMiniStep,
} from "@/lib/intake/guided-interview-flow";
import { isGuidedIntakePilotEnabled } from "@/lib/intake/guided-intake-flag";
import type { LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";
import {
  coerceLegacyTraceForStrategicInterview,
  initialTrace,
  readInterviewTrace,
} from "@/lib/intake/orchestrator";
import { EXTRACTION_USER_RECOVERY_NOTICE } from "@/lib/intake/guided-intake-extraction-recovery";
import {
  INTAKE_TURN_TIMEOUT_MS,
  parseIntakeTurnResponseOrThrow,
  type IntakeTurnResponse,
} from "@/lib/intake/guided-intake-pilot-response";
import type { SegmentConfirmationActionPayload } from "@/lib/intake/segment-confirmation-actions";
import { SEGMENT_CONFIRMATION_UI_ACTIONS } from "@/lib/intake/segment-confirmation-actions";
import {
  buildSegmentConfirmationUiFromTrace,
  type SegmentConfirmationUiPayloadV1,
} from "@/lib/intake/segment-confirmation-ui";
import { pilotHidesOpenComposerDuringSegmentConfirmation } from "@/lib/intake/guided-intake-segment-confirm-ui-state";
import {
  guidedIntakeDebugCompletionSummaryFixture,
  isGuidedIntakeDebugCompleteShortcut,
} from "@/lib/intake/guided-intake-debug-complete";
import { runGuidedIntakeInitialQuestionnaireDiagnosis } from "@/lib/intake/guided-intake-initial-questionnaire-diagnosis";
import { shouldShowGuidedIntakeDiagnosticCompletionPanel } from "@/lib/intake/guided-intake-completion-ui";
import { GuidedIntakeDiagnosticCompletionPanel } from "@/components/onboarding/guided-intake-diagnostic-completion-panel";
import {
  buildStrategicInterviewPilotSummary,
  type StrategicInterviewPilotSummary,
} from "@/lib/intake/strategic-interview-summary";
import {
  PILOT_ESCAPE_CHIPS,
  type PilotEscapeChipId,
} from "@/lib/intake/question-bank";
import { nameStatusSchema } from "@/lib/schemas/project";
import type { z } from "zod";

type NameStatus = z.infer<typeof nameStatusSchema>;

type DialogLine = { role: "limbi" | "user"; text: string };

const MINI_PROGRESS = GUIDED_MINI_STEPS.filter((s) => s !== "complete");

export function GuidedIntakePilot() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const guidedParam = searchParams.get("guided");
  const debugCompleteParam = searchParams.get("debugComplete");

  const [nameOrDescriptor, setNameOrDescriptor] = useState("");
  const [nameStatus, setNameStatus] = useState<NameStatus | null>("provisional");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestedChips, setSuggestedChips] = useState<string[]>([]);
  const [segmentConfirmUi, setSegmentConfirmUi] =
    useState<SegmentConfirmationUiPayloadV1 | null>(null);
  /** Hides segment buttons from the moment a button is clicked until the server responds. */
  const [segmentConfirmBusy, setSegmentConfirmBusy] = useState(false);
  const [tracePhase, setTracePhase] =
    useState<LimbicInterviewTraceV1["phase"]>("main");
  const [miniStep, setMiniStep] = useState<string | null>(null);
  const [lines, setLines] = useState<DialogLine[]>([]);
  const [summary, setSummary] = useState<StrategicInterviewPilotSummary | null>(
    null,
  );
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const progressIndex = useMemo(() => {
    if (!miniStep) return 0;
    const i = MINI_PROGRESS.indexOf(miniStep as (typeof MINI_PROGRESS)[number]);
    return i < 0 ? 0 : i;
  }, [miniStep]);

  const showDiagnosticCompletionPanel = useMemo(
    () =>
      shouldShowGuidedIntakeDiagnosticCompletionPanel({
        tracePhase,
        miniStep,
        summary,
      }),
    [tracePhase, miniStep, summary],
  );

  useEffect(() => {
    if (!isGuidedIntakePilotEnabled()) {
      router.replace("/projects/new");
    }
  }, [router]);

  useEffect(() => {
    if (!projectId) return;
    if (
      isGuidedIntakeDebugCompleteShortcut({
        guidedPilotEnabled: isGuidedIntakePilotEnabled(),
        guidedParam,
        debugCompleteParam,
      })
    ) {
      setTracePhase("done");
      setMiniStep("complete");
      setSummary(guidedIntakeDebugCompletionSummaryFixture());
      setSegmentConfirmUi(null);
      setLines([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [pRes, rRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`, { credentials: "include" }),
          fetch(`/api/projects/${projectId}/responses`, {
            credentials: "include",
          }),
        ]);
        if (!pRes.ok || !rRes.ok) return;
        const pJson = (await pRes.json()) as {
          project: { challenge_type: string | null };
        };
        const rJson = (await rRes.json()) as {
          project_responses: {
            responses: Record<string, unknown>;
          } | null;
        };
        if (cancelled) return;
        const ct = pJson.project?.challenge_type ?? null;
        const resp = rJson.project_responses?.responses ?? {};
        const rawTrace = readInterviewTrace(resp);
        const tr = coerceLegacyTraceForStrategicInterview(
          rawTrace ?? initialTrace(),
        );
        setMiniStep(tr.mini_step ?? null);
        setTracePhase(tr.phase);
        if (tr.phase === "segment_confirmation") {
          setSegmentConfirmUi(buildSegmentConfirmationUiFromTrace(tr));
        } else {
          setSegmentConfirmUi(null);
        }
        if (tr.phase === "done" && tr.mini_step === "complete") {
          setSummary(
            buildStrategicInterviewPilotSummary(
              resp,
              ct,
              Boolean(tr.other_challenge),
              {},
            ),
          );
        } else if (tr.turns?.length) {
          setLines(
            tr.turns.map((t) => ({
              role: t.role === "user" ? "user" : "limbi",
              text: t.summary,
            })),
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, guidedParam, debugCompleteParam]);

  useLayoutEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const createProject = useCallback(async () => {
    setError(null);
    if (!nameOrDescriptor.trim()) {
      setError("Escribe un nombre o descriptor.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name_or_descriptor: nameOrDescriptor.trim(),
          name_status: nameStatus ?? "provisional",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "No se pudo crear",
        );
      }
      const id = (json as { project: { id: string } }).project.id;
      router.replace(`/projects/new?projectId=${encodeURIComponent(id)}&guided=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCreating(false);
    }
  }, [nameOrDescriptor, nameStatus, router]);

  const runInitialQuestionnaireDiagnosis = useCallback(async () => {
    if (!projectId) return;
    setDiagnosisError(null);
    setDiagnosisLoading(true);
    try {
      const result = await runGuidedIntakeInitialQuestionnaireDiagnosis({ projectId });
      if (result.ok) {
        router.push(result.clarifyPath);
      } else {
        setDiagnosisError(result.errorMessage);
      }
    } catch (e) {
      setDiagnosisError(
        e instanceof Error
          ? e.message
          : "No se pudo ejecutar el diagnóstico inicial.",
      );
    } finally {
      setDiagnosisLoading(false);
    }
  }, [projectId, router]);

  const applyIntakeJson = useCallback((json: IntakeTurnResponse) => {
    setSuggestedChips(json.suggested_chips ?? []);
    const tr = coerceLegacyTraceForStrategicInterview(json.trace);
    setTracePhase(tr.phase);
    setMiniStep(tr.mini_step ?? null);
    setSegmentConfirmUi(json.segment_confirmation_ui ?? null);
    if (json.should_not_advance) {
      setSummary(null);
    }
    const followUp = json.follow_up_question?.trim();
    const awaitingSegmentCorrection = Boolean(
      tr.segment_confirmation_pending?.awaiting_segment_correction,
    );
    const blockExtraQuestions =
      Boolean(json.segment_confirmation_ui) || awaitingSegmentCorrection;
    if (followUp) {
      if (json.interviewer_message?.trim()) {
        setLines((prev) => [
          ...prev,
          { role: "limbi", text: json.interviewer_message!.trim() },
        ]);
      }
      if (!blockExtraQuestions) {
        setLines((prev) => [...prev, { role: "limbi", text: followUp }]);
      }
    } else {
      if (json.interviewer_message?.trim()) {
        setLines((prev) => [
          ...prev,
          { role: "limbi", text: json.interviewer_message!.trim() },
        ]);
      }
      if (json.next_question?.trim() && !blockExtraQuestions) {
        setLines((prev) => [
          ...prev,
          { role: "limbi", text: json.next_question!.trim() },
        ]);
      }
    }
    if (json.summary) {
      setSummary(json.summary);
    }
  }, []);

  const sendTurn = useCallback(
    async (opts: {
      text?: string;
      action?: PilotEscapeChipId;
      challenge_type_pick?: string;
      challenge_type_other?: boolean;
      segment_confirmation_action?: SegmentConfirmationActionPayload["action"];
    }) => {
      if (!projectId) return;
      setError(null);
      if (opts.segment_confirmation_action) {
        setSegmentConfirmBusy(true);
      }
      setSending(true);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        INTAKE_TURN_TIMEOUT_MS,
      );
      const userPreview =
        opts.challenge_type_pick !== undefined
          ? `Tipo de reto: ${GUIDED_CHALLENGE_PICKS.find((p) => p.pick === opts.challenge_type_pick)?.label ?? opts.challenge_type_pick}`
          : opts.challenge_type_other
            ? "Tipo de reto: Otro"
            : opts.text?.trim() ?? opts.action ?? "";
      if (
        opts.text?.trim() &&
        !opts.challenge_type_pick &&
        !opts.challenge_type_other
      ) {
        setLines((prev) => [...prev, { role: "user", text: opts.text!.trim() }]);
      } else if (opts.challenge_type_pick || opts.challenge_type_other) {
        setLines((prev) => [...prev, { role: "user", text: userPreview }]);
      } else if (opts.action) {
        setLines((prev) => [
          ...prev,
          { role: "user", text: "No tengo la información" },
        ]);
      } else if (opts.segment_confirmation_action) {
        const label =
          SEGMENT_CONFIRMATION_UI_ACTIONS.find(
            (a) => a.id === opts.segment_confirmation_action,
          )?.label ?? opts.segment_confirmation_action;
        setLines((prev) => [...prev, { role: "user", text: label }]);
      }
      try {
        const res = await fetch(`/api/projects/${projectId}/intake-turn`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            opts.segment_confirmation_action
              ? {
                  type: "segment_confirmation_action",
                  action: opts.segment_confirmation_action,
                }
              : {
                  text: opts.text?.trim() || undefined,
                  action: opts.action,
                  challenge_type_pick: opts.challenge_type_pick,
                  challenge_type_other: opts.challenge_type_other ? true : undefined,
                },
          ),
          signal: controller.signal,
        });
        const jsonRaw = await res.json().catch(() => ({}));
        const errObj = jsonRaw as { error?: string };
        if (!res.ok) {
          const rawErr =
            typeof errObj.error === "string" ? errObj.error : "Error al guardar";
          const safe =
            /extracci|schema|z\.|json\s+válido/i.test(rawErr)
              ? EXTRACTION_USER_RECOVERY_NOTICE
              : rawErr;
          throw new Error(safe);
        }
        const json = parseIntakeTurnResponseOrThrow(jsonRaw);
        applyIntakeJson(json);
        setAnswer("");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setError(
            "La solicitud tardó demasiado. Puedes volver a intentar; no hace falta recargar la página.",
          );
        } else {
          setError(e instanceof Error ? e.message : "Error");
        }
      } finally {
        window.clearTimeout(timeoutId);
        setSending(false);
        setSegmentConfirmBusy(false);
      }
    },
    [projectId, applyIntakeJson],
  );

  if (!isGuidedIntakePilotEnabled()) {
    return null;
  }

  if (!projectId) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6">
        <Card className="rounded-[22px] border border-limbi-border shadow-limbi">
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              Crear Sistema Límbico
            </CardTitle>
            <CardDescription>
              Esto nos ayuda a identificar tu sistema. Si cambia después, podrás
              ajustarlo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">
                Nombre o descriptor del proyecto
              </p>
              <Input
                value={nameOrDescriptor}
                onChange={(e) => setNameOrDescriptor(e.target.value)}
                placeholder="Ej. Marca X, campaña primavera…"
                className="text-base"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">
                Estado del nombre
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { value: "definitive" as const, label: "Definitivo" },
                    { value: "provisional" as const, label: "Provisional" },
                    { value: "unnamed" as const, label: "Sin nombre" },
                  ] as const
                ).map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={nameStatus === opt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const v = nameStatusSchema.safeParse(opt.value);
                      if (v.success) setNameStatus(v.data);
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              className={limbiPrimaryButtonClass}
              disabled={creating}
              onClick={() => void createProject()}
            >
              {creating ? "Creando…" : "Empezar"}
            </Button>
          </CardFooter>
        </Card>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/projects/new" className="underline">
            Volver al cuestionario clásico
          </Link>
        </p>
      </div>
    );
  }

  if (showDiagnosticCompletionPanel) {
    if (!summary) {
      return (
        <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-muted-foreground">
          Cargando resumen…
        </div>
      );
    }
    const continueBaseHref = `/projects/new?projectId=${encodeURIComponent(projectId)}`;

    return (
      <GuidedIntakeDiagnosticCompletionPanel
        summary={summary}
        diagnosisLoading={diagnosisLoading}
        diagnosisError={diagnosisError}
        continueBaseHref={continueBaseHref}
        onRunDiagnosis={runInitialQuestionnaireDiagnosis}
      />
    );
  }

  const onChallengePick = (pick: string) => {
    if (pick === "other") {
      void sendTurn({ challenge_type_other: true });
    } else {
      void sendTurn({ challenge_type_pick: pick });
    }
  };

  const showChallengePicker =
    miniStep === null || miniStep === "challenge_type";

  const optionBtnClass =
    "h-auto min-h-[2.75rem] w-full justify-start whitespace-normal px-3 py-2 text-left text-sm font-normal leading-snug";

  const hideOpenComposer = pilotHidesOpenComposerDuringSegmentConfirmation({
    segmentConfirmationUi: segmentConfirmUi,
    segmentConfirmBusy,
  });

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex gap-1">
        {MINI_PROGRESS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full",
              i <= progressIndex ? "bg-limbi-green" : "bg-limbi-border",
            )}
            title={`Paso ${i + 1} de ${MINI_PROGRESS.length}`}
          />
        ))}
      </div>
      <Card className="rounded-[22px] border border-limbi-border shadow-limbi">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Entrevista guiada · Piloto
          </p>
          <CardTitle className="font-heading text-xl">
            {showChallengePicker ? "Tu Sistema Límbico" : "Seguimos en conversación"}
          </CardTitle>
          <CardDescription>
            Limbi va tomando nota para la estrategia; aún no redacta la campaña.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {lines.length > 0 ? (
            <div
              ref={chatScrollRef}
              className="max-h-[320px] space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-3"
            >
              {lines.map((line, idx) => (
                <div
                  key={`${idx}-${line.text.slice(0, 12)}`}
                  className={cn(
                    "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    line.role === "limbi"
                      ? "ml-0 mr-6 bg-background text-foreground shadow-sm"
                      : "ml-6 mr-0 bg-limbi-green/15 text-foreground",
                  )}
                >
                  {line.role === "limbi" ? (
                    <p className="text-xs font-medium text-muted-foreground">
                      Limbi
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{line.text}</p>
                </div>
              ))}
            </div>
          ) : null}

          {showChallengePicker &&
          (miniStep === "challenge_type" || miniStep === null) ? (
            <div className="space-y-3">
              <p className="text-base font-medium leading-snug text-foreground">
                {questionForMiniStep("challenge_type", null, false)}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {GUIDED_CHALLENGE_PICKS.map((opt) => (
                  <Button
                    key={opt.pick}
                    type="button"
                    variant="outline"
                    className={optionBtnClass}
                    disabled={sending}
                    onClick={() => onChallengePick(opt.pick)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
              {segmentConfirmUi && !segmentConfirmBusy ? (
                <div className="space-y-3 border-b border-border/60 p-3">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {segmentConfirmUi.synthesis}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {segmentConfirmUi.actions.map((a) => (
                      <Button
                        key={a.id}
                        type="button"
                        variant="secondary"
                        className="h-auto min-h-[2.75rem] justify-start whitespace-normal px-3 py-2 text-left text-sm font-normal leading-snug"
                        disabled={sending || segmentConfirmBusy}
                        onClick={() =>
                          void sendTurn({ segment_confirmation_action: a.id })
                        }
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : segmentConfirmBusy ? (
                <div className="border-b border-border/60 px-3 py-2 text-center text-xs text-muted-foreground">
                  Enviando…
                </div>
              ) : null}
              {!hideOpenComposer ? (
                <>
                  <Textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Escribe con naturalidad; no hace falta que sea perfecto."
                    rows={5}
                    className="min-h-[120px] resize-y rounded-none border-0 border-b border-border/80 bg-transparent px-3 py-2 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={sending}
                  />
                  {suggestedChips.length > 0 ? (
                    <div className="flex flex-wrap gap-2 border-b border-border/60 px-3 py-2">
                  {suggestedChips.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="text-xs"
                      data-testid="guided-intake-suggested-answer-chip"
                      disabled={sending}
                      onClick={() => setAnswer((a) => (a ? `${a} ${c}` : c))}
                    >
                          {c}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  <div className="px-3 py-2">
                    {PILOT_ESCAPE_CHIPS.map((c) => (
                      <Button
                        key={c.id}
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start px-2 py-2 text-left text-sm text-muted-foreground hover:text-foreground"
                        disabled={sending}
                        onClick={() => void sendTurn({ action: c.id })}
                      >
                        {c.label}
                      </Button>
                    ))}
                  </div>
                  <div className="border-t border-border bg-muted/30 p-2">
                    <Button
                      type="button"
                      className={`${limbiPrimaryButtonClass} w-full`}
                      disabled={sending || !answer.trim()}
                      onClick={() => void sendTurn({ text: answer })}
                    >
                      {sending ? "Enviando…" : "Enviar"}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href={`/projects/new?projectId=${encodeURIComponent(projectId)}`}>
          Continuar con cuestionario clásico
        </Link>
      </p>
    </div>
  );
}
