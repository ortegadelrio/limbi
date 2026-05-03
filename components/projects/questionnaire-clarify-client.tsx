"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  limbiDocumentCardClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  questionnaireEvaluationPayloadSchema,
  shouldRequireClarificationScreen,
  type ClarificationQuestion,
} from "@/lib/questionnaire-evaluation/schema";
import { validateClarificationAnswersAgainstQuestions } from "@/lib/questionnaire-evaluation/validate-clarification-submit";

type Props = { projectId: string };

type AnswerDraft = { optionId?: string; freeText: string };

function buildAnswersPayload(
  questions: ClarificationQuestion[],
  drafts: Record<string, AnswerDraft>,
) {
  return questions.map((q) => {
    const d = drafts[q.id] ?? { freeText: "" };
    const ft = d.freeText.trim();
    const out: {
      question_id: string;
      selected_option_id?: string;
      free_text?: string;
    } = { question_id: q.id };
    if (d.optionId) out.selected_option_id = d.optionId;
    if (ft.length > 0) out.free_text = ft;
    return out;
  });
}

export function QuestionnaireClarifyClient({ projectId }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<
    "loading" | "form" | "saving" | "generating" | "ready_generate"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({});
  const [alreadySaved, setAlreadySaved] = useState(false);

  const total = questions.length;
  const current = total > 0 ? questions[step] : null;

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const [rRes, sRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/responses`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/status`, { credentials: "include" }),
      ]);
      const rJson = (await rRes.json().catch(() => ({}))) as {
        project_responses?: {
          questionnaire_pre_master_evaluation?: unknown;
          questionnaire_clarifications?: unknown;
        } | null;
        error?: unknown;
      };
      const sJson = (await sRes.json().catch(() => ({}))) as {
        active_master_document?: unknown;
        error?: unknown;
      };
      if (!rRes.ok) {
        throw new Error(
          typeof rJson.error === "string"
            ? rJson.error
            : "No se pudieron cargar las respuestas.",
        );
      }
      let evaluation = rJson.project_responses
        ?.questionnaire_pre_master_evaluation;

      if (!evaluation) {
        const evRes = await fetch(
          `/api/projects/${projectId}/evaluate-questionnaire`,
          { method: "POST", credentials: "include" },
        );
        const evJson = (await evRes.json().catch(() => ({}))) as {
          evaluation?: unknown;
          error?: unknown;
        };
        if (!evRes.ok) {
          throw new Error(
            typeof evJson.error === "string"
              ? evJson.error
              : "No se pudo evaluar el cuestionario.",
          );
        }
        evaluation = evJson.evaluation;
      }

      const parsed = questionnaireEvaluationPayloadSchema.safeParse(evaluation);
      if (!parsed.success) {
        throw new Error(
          "La evaluación guardada no es válida. Vuelve a completar el cuestionario o contacta soporte.",
        );
      }

      if (!shouldRequireClarificationScreen(parsed.data)) {
        router.replace(`/projects/${projectId}`);
        return;
      }

      const clar = rJson.project_responses?.questionnaire_clarifications;
      const clarObj =
        clar && typeof clar === "object" && !Array.isArray(clar)
          ? (clar as Record<string, unknown>)
          : null;
      const hasSaved =
        clarObj &&
        Array.isArray(clarObj.answers) &&
        clarObj.answers.length > 0;

      setScore(parsed.data.overall_quality_score);
      setQuestions(parsed.data.clarification_questions);
      setAlreadySaved(Boolean(hasSaved));

      const initialDrafts: Record<string, AnswerDraft> = {};
      for (const q of parsed.data.clarification_questions) {
        initialDrafts[q.id] = { freeText: "" };
      }
      setDrafts(initialDrafts);
      setStep(0);

      if (hasSaved && !sJson.active_master_document) {
        setPhase("ready_generate");
        return;
      }
      if (hasSaved && sJson.active_master_document) {
        router.replace(`/projects/${projectId}`);
        return;
      }

      setPhase("form");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar.");
      setPhase("loading");
    }
  }, [projectId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const setDraft = useCallback((qid: string, patch: Partial<AnswerDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [qid]: { ...(prev[qid] ?? { freeText: "" }), ...patch },
    }));
  }, []);

  const canAdvance = useMemo(() => {
    if (!current) return false;
    const d = drafts[current.id] ?? { freeText: "" };
    const ft = d.freeText.trim();
    const opts = current.options ?? [];
    if (opts.length > 0) {
      if (d.optionId) return true;
      if (current.allow_free_text !== false && ft.length > 0) return true;
      return false;
    }
    return ft.length > 0;
  }, [current, drafts]);

  const submitAll = useCallback(async () => {
    const answers = buildAnswersPayload(questions, drafts);
    const v = validateClarificationAnswersAgainstQuestions(questions, answers);
    if (!v.ok) {
      setError(v.message);
      return;
    }
    setError(null);
    setPhase("saving");
    let clarificationsSaved = false;
    try {
      const cRes = await fetch(
        `/api/projects/${projectId}/questionnaire-clarifications`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        },
      );
      const cJson = (await cRes.json().catch(() => ({}))) as {
        error?: unknown;
      };
      if (!cRes.ok) {
        throw new Error(
          typeof cJson.error === "string"
            ? cJson.error
            : "No se pudieron guardar las aclaraciones.",
        );
      }
      clarificationsSaved = true;
      setAlreadySaved(true);

      setPhase("generating");
      const gRes = await fetch(`/api/projects/${projectId}/generate-master`, {
        method: "POST",
        credentials: "include",
      });
      const gJson = (await gRes.json().catch(() => ({}))) as {
        error?: unknown;
      };
      if (!gRes.ok) {
        throw new Error(
          typeof gJson.error === "string"
            ? gJson.error
            : "No se pudo generar la Lectura Límbica.",
        );
      }

      router.refresh();
      router.replace(`/projects/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
      setPhase(clarificationsSaved ? "ready_generate" : "form");
    }
  }, [drafts, projectId, questions, router]);

  const postGenerateMaster = useCallback(async () => {
    setError(null);
    setPhase("generating");
    try {
      const gRes = await fetch(`/api/projects/${projectId}/generate-master`, {
        method: "POST",
        credentials: "include",
      });
      const gJson = (await gRes.json().catch(() => ({}))) as {
        error?: unknown;
      };
      if (!gRes.ok) {
        throw new Error(
          typeof gJson.error === "string"
            ? gJson.error
            : "No se pudo generar la Lectura Límbica.",
        );
      }
      router.refresh();
      router.replace(`/projects/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar.");
      setPhase("ready_generate");
    }
  }, [projectId, router]);

  if (phase === "generating") {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16">
        <Loader2 className="size-10 animate-spin text-limbi-green" aria-hidden />
        <p className="text-center text-sm text-limbi-muted">
          Generando la Lectura Límbica con tus aclaraciones…
        </p>
        {error ? (
          <p className="text-center text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    );
  }

  if (phase === "loading" && !error) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16">
        <Loader2 className="size-10 animate-spin text-limbi-green" aria-hidden />
        <p className="text-center text-sm text-limbi-muted">
          Limbi revisa tu cuestionario antes de la Lectura Límbica…
        </p>
      </div>
    );
  }

  if (phase === "ready_generate") {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <div className={cn(limbiDocumentCardClass, "space-y-4 p-6 sm:p-8")}>
          <h1 className="font-heading text-xl font-semibold text-limbi-text">
            Aclaraciones guardadas
          </h1>
          <p className="text-sm leading-relaxed text-limbi-muted">
            Ya incorporamos tus refinamientos estratégicos. Falta generar la
            Lectura Límbica con el contexto completo.
          </p>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            className={limbiPrimaryButtonClass}
            onClick={() => void postGenerateMaster()}
          >
            Generar Lectura Límbica
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "form" || phase === "saving") {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <div className={cn(limbiDocumentCardClass, "space-y-5 p-6 sm:p-8")}>
          <header className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
              Refinamiento estratégico
            </p>
            <h1 className="font-heading text-xl font-semibold text-limbi-text">
              Afinemos unos puntos antes del Sistema Límbico
            </h1>
            {score !== null ? (
              <p className="text-sm text-limbi-muted">
                Calidad global del cuestionario (0–100):{" "}
                <span className="font-semibold text-limbi-text">{score}</span>.
                Con estas respuestas Limbi podrá alinear mejor la Lectura Límbica
                sin reescribir tu cuestionario original.
              </p>
            ) : null}
          </header>

          {alreadySaved ? (
            <p className="text-sm text-limbi-muted">
              Ya habías guardado aclaraciones. Puedes revisar y volver a enviar
              si ajustas algo.
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {current ? (
            <div className="space-y-4">
              <p className="text-xs text-limbi-muted">
                Pregunta {step + 1} de {total}
              </p>
              <blockquote className="rounded-xl border border-limbi-border/80 bg-limbi-bg-soft/80 px-3 py-2 text-sm italic text-limbi-text">
                «{current.referenced_user_answer}»
              </blockquote>
              <p className="text-sm text-limbi-muted">{current.why_it_matters}</p>
              <p className="text-base font-medium text-limbi-text">
                {current.question_text}
              </p>

              {current.options && current.options.length > 0 ? (
                <div className="space-y-2" role="radiogroup" aria-label="Opciones">
                  {current.options.map((opt) => {
                    const sel =
                      (drafts[current.id]?.optionId ?? "") === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                          sel
                            ? "border-limbi-green/50 bg-limbi-green/[0.07]"
                            : "border-limbi-border hover:bg-limbi-bg-soft/80",
                        )}
                      >
                        <input
                          type="radio"
                          name={`q-${current.id}`}
                          className="mt-1"
                          checked={sel}
                          onChange={() =>
                            setDraft(current.id, { optionId: opt.id })
                          }
                        />
                        <span className="text-limbi-text">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {current.allow_free_text !== false ? (
                <div className="space-y-2">
                  <label
                    htmlFor={`ft-${current.id}`}
                    className="text-sm font-medium text-limbi-text"
                  >
                    {current.options && current.options.length > 0
                      ? "Detalle opcional (texto libre)"
                      : "Tu respuesta"}
                  </label>
                  <Textarea
                    id={`ft-${current.id}`}
                    rows={3}
                    value={drafts[current.id]?.freeText ?? ""}
                    onChange={(e) =>
                      setDraft(current.id, { freeText: e.target.value })
                    }
                    placeholder="Escribe aquí si quieres precisar algo más…"
                    className="resize-none rounded-xl border-limbi-border"
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={step === 0 || phase !== "form"}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  Anterior
                </Button>
                {step < total - 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    className={cn("rounded-xl", limbiPrimaryButtonClass)}
                    disabled={!canAdvance || phase !== "form"}
                    onClick={() =>
                      canAdvance ? setStep((s) => Math.min(total - 1, s + 1)) : undefined
                    }
                  >
                    Siguiente
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className={cn("rounded-xl", limbiPrimaryButtonClass)}
                    disabled={!canAdvance || phase !== "form"}
                    onClick={() => void submitAll()}
                  >
                    Guardar y generar Lectura Límbica
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {phase === "saving" && !error ? (
            <p className="flex items-center gap-2 text-sm text-limbi-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Guardando aclaraciones…
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (error && phase === "loading") {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return null;
}
