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
import { inferClarificationTargetMasterFields } from "@/lib/questionnaire-evaluation/clarification-chip-sanitize";
import {
  CLARIFICATION_SKIP_CONTINUE_BASE_ID,
  CLARIFICATION_SKIP_IMPROVE_LATER_ID,
  CLARIFICATION_SKIP_NOT_AVAILABLE_ID,
  isUniversalClarificationSkipOptionId,
} from "@/lib/questionnaire-evaluation/clarification-skip-constants";
import { finalizeEvaluationPayload } from "@/lib/questionnaire-evaluation/clarification-questions-sanitize";
import { getClarificationQuestionCap } from "@/lib/questionnaire-evaluation/clarification-round-cap";
import type { GuidedCaptureContextTier } from "@/lib/questionnaire-evaluation/strategic-capture-context";
import { mergeClarificationSuggestionChips } from "@/lib/questionnaire-evaluation/clarification-ui-suggestions";
import {
  questionnaireEvaluationPayloadSchema,
  shouldRequireClarificationScreen,
  type ClarificationAnswer,
  type ClarificationQuestion,
} from "@/lib/questionnaire-evaluation/schema";
import { validateClarificationAnswersAgainstQuestions } from "@/lib/questionnaire-evaluation/validate-clarification-submit";
import { isVagueClarificationAnswerText } from "@/lib/questionnaire-evaluation/vague-clarification-answer";

type Props = { projectId: string };

type AnswerDraft = { optionId?: string; freeText: string };

type Phase =
  | "loading"
  | "form"
  | "saving"
  | "after_round1"
  | "form_followup"
  | "saving_followup"
  | "generating"
  | "ready_generate";

function answerCombinedText(
  q: ClarificationQuestion,
  d: AnswerDraft | undefined,
): string {
  const ft = (d?.freeText ?? "").trim();
  const opts = q.options ?? [];
  if (d?.optionId && opts.length > 0) {
    const lab = opts.find((o) => o.id === d.optionId)?.label?.trim() ?? "";
    return [lab, ft].filter(Boolean).join(" ").trim();
  }
  return ft;
}

const CLAIM_LIMITS_NOT_AVAILABLE_ES =
  "Evitar afirmaciones contundentes y no inventar evidencia en este tema hasta contar con datos reales.";

function buildAnswersPayload(
  questions: ClarificationQuestion[],
  drafts: Record<string, AnswerDraft>,
  pendingInline: Record<string, string>,
): ClarificationAnswer[] {
  return questions.map((q) => {
    const d = drafts[q.id] ?? { freeText: "" };
    let ft = d.freeText.trim();
    const extra = (pendingInline[q.id] ?? "").trim();
    if (extra.length > 0) {
      ft = ft.length > 0 ? `${ft}\n\n(Aclaración adicional): ${extra}` : extra;
    }

    const oid = d.optionId;
    if (oid === CLARIFICATION_SKIP_NOT_AVAILABLE_ID) {
      const out: ClarificationAnswer = {
        question_id: q.id,
        selected_option_id: oid,
        answer_status: "not_available_yet",
        should_update_master: true,
        confidence_level: "low",
        strategic_topic: q.question_text,
        target_master_fields: inferClarificationTargetMasterFields(q),
        claim_limits: CLAIM_LIMITS_NOT_AVAILABLE_ES,
      };
      if (ft.length > 0) out.free_text = ft;
      return out;
    }
    if (oid === CLARIFICATION_SKIP_CONTINUE_BASE_ID) {
      const out: ClarificationAnswer = {
        question_id: q.id,
        selected_option_id: oid,
        answer_status: "continue_with_base",
        should_update_master: false,
        confidence_level: "low",
        strategic_topic: q.question_text,
        target_master_fields: inferClarificationTargetMasterFields(q),
        claim_limits:
          "Continuar con la base actual; evitar promesas nuevas no sustentadas en este tema.",
      };
      if (ft.length > 0) out.free_text = ft;
      return out;
    }
    if (oid === CLARIFICATION_SKIP_IMPROVE_LATER_ID) {
      const out: ClarificationAnswer = {
        question_id: q.id,
        selected_option_id: oid,
        answer_status: "improve_later",
        should_update_master: true,
        confidence_level: "low",
        strategic_topic: q.question_text,
        target_master_fields: inferClarificationTargetMasterFields(q),
        claim_limits:
          "Marcar el tema como mejorable más adelante; comunicación cautelosa hasta contar con más información.",
      };
      if (ft.length > 0) out.free_text = ft;
      return out;
    }

    const out: ClarificationAnswer = { question_id: q.id };
    if (d.optionId) out.selected_option_id = d.optionId;
    if (ft.length > 0) out.free_text = ft;
    return out;
  });
}

export function QuestionnaireClarifyClient({ projectId }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({});
  const [pendingInlineFollowUps, setPendingInlineFollowUps] = useState<
    Record<string, string>
  >({});
  const [inlineFollowUpParentId, setInlineFollowUpParentId] = useState<
    string | null
  >(null);
  const [inlineFollowDraft, setInlineFollowDraft] = useState("");
  const [followUpsUsed, setFollowUpsUsed] = useState(0);
  const [followUpUsedIds, setFollowUpUsedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [scoreBeforeRound, setScoreBeforeRound] = useState<number | null>(null);
  const [scoreAfterRound, setScoreAfterRound] = useState<number | null>(null);
  const [dimensionNotes, setDimensionNotes] = useState<string[]>([]);
  const [followUpQuestions, setFollowUpQuestions] = useState<
    ClarificationQuestion[]
  >([]);
  const [wizardResponses, setWizardResponses] = useState<
    Record<string, unknown>
  >({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [suppressNumericScore, setSuppressNumericScore] = useState(false);
  const [guidedCaptureTier, setGuidedCaptureTier] =
    useState<GuidedCaptureContextTier | null>(null);

  const total = questions.length;
  const current = total > 0 ? questions[step] : null;

  const roundDisplayCap = useMemo(() => {
    if (suppressNumericScore) {
      if (guidedCaptureTier === "insufficient") return 1;
      if (guidedCaptureTier === "thin") return 3;
      return 3;
    }
    return score !== null ? getClarificationQuestionCap(score) : 5;
  }, [suppressNumericScore, guidedCaptureTier, score]);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    setStepError(null);
    try {
      const [rRes, sRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/responses`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/status`, { credentials: "include" }),
      ]);
      const rJson = (await rRes.json().catch(() => ({}))) as {
        project_responses?: {
          responses?: unknown;
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

      const responses: Record<string, unknown> =
        rJson.project_responses?.responses &&
        typeof rJson.project_responses.responses === "object" &&
        rJson.project_responses.responses !== null &&
        !Array.isArray(rJson.project_responses.responses)
          ? (rJson.project_responses.responses as Record<string, unknown>)
          : {};
      setWizardResponses(responses);

      const finalized = finalizeEvaluationPayload(parsed.data, responses);
      setSuppressNumericScore(finalized.suppress_numeric_quality_score === true);
      setGuidedCaptureTier(finalized.guided_capture_context_tier ?? null);

      if (!shouldRequireClarificationScreen(finalized)) {
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

      setScore(
        finalized.suppress_numeric_quality_score === true
          ? null
          : finalized.overall_quality_score,
      );
      const withChips = finalized.clarification_questions.map((q) =>
        mergeClarificationSuggestionChips(q, responses),
      );
      setQuestions(withChips);

      const initialDrafts: Record<string, AnswerDraft> = {};
      for (const q of withChips) {
        initialDrafts[q.id] = { freeText: "" };
      }
      setDrafts(initialDrafts);
      setPendingInlineFollowUps({});
      setInlineFollowUpParentId(null);
      setInlineFollowDraft("");
      setFollowUpsUsed(0);
      setFollowUpUsedIds(new Set());
      setStep(0);

      if (hasSaved && clarObj) {
        const sb =
          typeof clarObj.score_before_clarifications === "number"
            ? clarObj.score_before_clarifications
            : finalized.overall_quality_score;
        const sa =
          typeof clarObj.score_after_clarifications === "number"
            ? clarObj.score_after_clarifications
            : sb;
        setScoreBeforeRound(sb);
        setScoreAfterRound(sa);
        setDimensionNotes(
          Array.isArray(clarObj.dimension_improvement_notes)
            ? (clarObj.dimension_improvement_notes as string[])
            : [],
        );
        const crit = clarObj.critical_follow_up_questions;
        const followDone = Boolean(clarObj.follow_up_round_completed_at);
        if (followDone || !Array.isArray(crit) || crit.length === 0) {
          setFollowUpQuestions([]);
        } else {
          setFollowUpQuestions(
            crit.map((x) =>
              mergeClarificationSuggestionChips(
                x as ClarificationQuestion,
                responses,
              ),
            ),
          );
        }

        if (sJson.active_master_document) {
          router.replace(`/projects/${projectId}`);
          return;
        }

        setPhase("after_round1");
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

  useEffect(() => {
    setStepError(null);
  }, [step, phase]);

  const setDraft = useCallback((qid: string, patch: Partial<AnswerDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [qid]: { ...(prev[qid] ?? { freeText: "" }), ...patch },
    }));
  }, []);

  const canAdvance = useMemo(() => {
    if (!current) return false;
    if (inlineFollowUpParentId === current.id) {
      return inlineFollowDraft.trim().length > 0;
    }
    const d = drafts[current.id] ?? { freeText: "" };
    const ft = d.freeText.trim();
    const opts = current.options ?? [];
    if (d.optionId && isUniversalClarificationSkipOptionId(d.optionId)) {
      return true;
    }
    if (opts.length > 0) {
      if (d.optionId) return true;
      if (current.allow_free_text !== false && ft.length > 0) return true;
      return false;
    }
    return ft.length > 0;
  }, [current, drafts, inlineFollowDraft, inlineFollowUpParentId]);

  const buildClientCaution = useCallback(
    (qs: ClarificationQuestion[], dr: Record<string, AnswerDraft>) => {
      const vagueIds: string[] = [];
      for (const q of qs) {
        const pick = dr[q.id];
        if (
          pick?.optionId &&
          isUniversalClarificationSkipOptionId(pick.optionId)
        ) {
          continue;
        }
        const t = answerCombinedText(q, pick);
        const extra = pendingInlineFollowUps[q.id]?.trim() ?? "";
        const merged = extra ? `${t} ${extra}` : t;
        if (isVagueClarificationAnswerText(merged)) vagueIds.push(q.id);
      }
      if (vagueIds.length === 0) return undefined;
      return `Algunas aclaraciones siguen siendo muy genéricas (${vagueIds.length} tema(s)). La Lectura Límbica incorporará lo dicho con prudencia y sin tratarlo como evidencia verificada.`;
    },
    [pendingInlineFollowUps],
  );

  const submitRound1 = useCallback(async () => {
    const answers = buildAnswersPayload(questions, drafts, pendingInlineFollowUps);
    const v = validateClarificationAnswersAgainstQuestions(questions, answers);
    if (!v.ok) {
      setStepError(v.message);
      setError(null);
      return;
    }
    const caution = buildClientCaution(questions, drafts);
    setError(null);
    setStepError(null);
    setPhase("saving");
    try {
      const cRes = await fetch(
        `/api/projects/${projectId}/questionnaire-clarifications`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers,
            ...(caution ? { client_generation_caution: caution } : {}),
          }),
        },
      );
      const cJson = (await cRes.json().catch(() => ({}))) as {
        post_round?: {
          score_before?: number;
          score_after?: number;
          dimension_improvement_notes?: string[];
          critical_follow_up_questions?: ClarificationQuestion[];
          suppress_numeric_quality_score?: boolean;
          guided_capture_context_tier?: GuidedCaptureContextTier | null;
        };
        error?: unknown;
      };
      if (!cRes.ok) {
        throw new Error(
          typeof cJson.error === "string"
            ? cJson.error
            : "No se pudieron guardar las aclaraciones.",
        );
      }
      const pr = cJson.post_round;
      if (pr) {
        setScoreBeforeRound(pr.score_before ?? null);
        setScoreAfterRound(pr.score_after ?? null);
        setDimensionNotes(pr.dimension_improvement_notes ?? []);
        const crit = pr.critical_follow_up_questions ?? [];
        setFollowUpQuestions(
          crit.map((x) =>
            mergeClarificationSuggestionChips(x, wizardResponses),
          ),
        );
        const sup = pr.suppress_numeric_quality_score === true;
        setSuppressNumericScore(sup);
        setGuidedCaptureTier(pr.guided_capture_context_tier ?? null);
        if (!sup && typeof pr.score_after === "number") {
          setScore(pr.score_after);
        } else if (sup) {
          setScore(null);
        }
      }
      setPhase("after_round1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
      setPhase("form");
    }
  }, [
    buildClientCaution,
    drafts,
    pendingInlineFollowUps,
    projectId,
    questions,
    wizardResponses,
  ]);

  const submitFollowUp = useCallback(async () => {
    const answers = buildAnswersPayload(
      followUpQuestions,
      drafts,
      pendingInlineFollowUps,
    );
    const v = validateClarificationAnswersAgainstQuestions(
      followUpQuestions,
      answers,
    );
    if (!v.ok) {
      setStepError(v.message);
      setError(null);
      return;
    }
    setError(null);
    setStepError(null);
    setPhase("saving_followup");
    try {
      const cRes = await fetch(
        `/api/projects/${projectId}/questionnaire-clarifications`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ follow_up_answers: answers }),
        },
      );
      const cJson = (await cRes.json().catch(() => ({}))) as {
        error?: unknown;
      };
      if (!cRes.ok) {
        throw new Error(
          typeof cJson.error === "string"
            ? cJson.error
            : "No se pudieron guardar las mejoras.",
        );
      }
      setPhase("after_round1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
      setPhase("form_followup");
    }
  }, [drafts, followUpQuestions, pendingInlineFollowUps, projectId]);

  const skipUniversalVagueGate = useCallback(
    (qid: string) => {
      const oid = drafts[qid]?.optionId;
      return Boolean(oid && isUniversalClarificationSkipOptionId(oid));
    },
    [drafts],
  );

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

  const advanceStep = useCallback(() => {
    if (!current) return;
    if (inlineFollowUpParentId === current.id) {
      const t = inlineFollowDraft.trim();
      if (t.length === 0) return;
      setPendingInlineFollowUps((prev) => ({
        ...prev,
        [current.id]: t,
      }));
      setFollowUpsUsed((n) => n + 1);
      setFollowUpUsedIds((s) => new Set(s).add(current.id));
      setInlineFollowUpParentId(null);
      setInlineFollowDraft("");
      setStep((s) => Math.min(total - 1, s + 1));
      return;
    }

    const combined = answerCombinedText(current, drafts[current.id]);
    if (
      !skipUniversalVagueGate(current.id) &&
      followUpsUsed < 2 &&
      !followUpUsedIds.has(current.id) &&
      isVagueClarificationAnswerText(combined)
    ) {
      setInlineFollowUpParentId(current.id);
      setInlineFollowDraft("");
      return;
    }

    setStep((s) => Math.min(total - 1, s + 1));
  }, [
    current,
    drafts,
    followUpUsedIds,
    followUpsUsed,
    inlineFollowDraft,
    inlineFollowUpParentId,
    skipUniversalVagueGate,
    total,
  ]);

  const startFollowUpRound = useCallback(() => {
    if (followUpQuestions.length === 0) return;
    setError(null);
    const initialDrafts: Record<string, AnswerDraft> = {};
    for (const q of followUpQuestions) {
      initialDrafts[q.id] = { freeText: "" };
    }
    setDrafts(initialDrafts);
    setStep(0);
    setQuestions(
      followUpQuestions.map((q) =>
        mergeClarificationSuggestionChips(q, wizardResponses),
      ),
    );
    setPendingInlineFollowUps({});
    setInlineFollowUpParentId(null);
    setInlineFollowDraft("");
    setFollowUpsUsed(0);
    setFollowUpUsedIds(new Set());
    setPhase("form_followup");
  }, [followUpQuestions, wizardResponses]);

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
          Preparando aclaraciones…
        </p>
      </div>
    );
  }

  if (phase === "after_round1") {
    const sb = scoreBeforeRound ?? score ?? 0;
    const sa = scoreAfterRound ?? score ?? sb;
    const canImprove = followUpQuestions.length > 0 && sa < 80;

    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <div className={cn(limbiDocumentCardClass, "space-y-4 p-6 sm:p-8")}>
          <h1 className="font-heading text-xl font-semibold text-limbi-text">
            Afinemos tu Sistema Límbico
          </h1>
          {suppressNumericScore ? (
            <p className="text-sm leading-relaxed text-limbi-muted">
              Incorporamos tus respuestas en esta ronda. Puedes seguir con otra ronda
              breve de profundización, o generar la Lectura con cautela donde la base
              siga fina.
            </p>
          ) : sa < 80 ? (
            <p className="text-sm leading-relaxed text-limbi-muted">
              Podemos generar la Lectura con esta base, pero algunos puntos
              quedarán marcados como débiles para evitar promesas exageradas.
              {scoreBeforeRound !== null && scoreAfterRound !== null ? (
                <>
                  {" "}
                  Tu puntuación pasó de {sb} a {sa}.
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-limbi-muted">
              Tu base alcanzó {sa}/100. Puedes generar la Lectura Límbica.
            </p>
          )}

          {dimensionNotes.length > 0 ? (
            <ul className="list-inside list-disc space-y-2 text-sm text-limbi-text">
              {dimensionNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canImprove ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  void startFollowUpRound();
                }}
              >
                Mejorar otro punto
              </Button>
            ) : null}
            <Button
              type="button"
              className={cn("rounded-xl", limbiPrimaryButtonClass)}
              onClick={() => void postGenerateMaster()}
            >
              Generar con esta base
            </Button>
          </div>
        </div>
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
            Ya incorporamos tus refinamientos. Puedes generar la Lectura Límbica.
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

  if (
    phase === "form" ||
    phase === "saving" ||
    phase === "form_followup" ||
    phase === "saving_followup"
  ) {
    const saving = phase === "saving" || phase === "saving_followup";
    const isFollowUpForm = phase === "form_followup";

    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <div className={cn(limbiDocumentCardClass, "space-y-4 p-6 sm:p-8")}>
          <header className="space-y-2">
            <h1 className="font-heading text-xl font-semibold text-limbi-text">
              Afinemos tu Sistema Límbico
            </h1>
            <p className="text-sm text-limbi-muted">
              Encontré algunos puntos que pueden hacer más precisa la Lectura.
            </p>
            {suppressNumericScore ? (
              <div
                className="space-y-1 text-sm text-limbi-muted"
                data-testid="guided-quality-no-numeric"
              >
                <p className="font-medium text-limbi-text">
                  {guidedCaptureTier === "insufficient"
                    ? "Base actual: captura incompleta"
                    : "Base actual: información insuficiente para puntuar"}
                </p>
                <p className="text-xs leading-relaxed">
                  <span className="font-medium text-limbi-text">
                    Ronda de profundización
                  </span>
                  {" · "}
                  Preguntas sugeridas para esta ronda:{" "}
                  <span className="font-semibold text-limbi-text">{total}</span>
                  {roundDisplayCap ? (
                    <span className="text-limbi-muted"> (hasta {roundDisplayCap})</span>
                  ) : null}
                </p>
              </div>
            ) : score !== null ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-limbi-muted">
                <span>
                  Base actual:{" "}
                  <span className="font-semibold text-limbi-text">
                    {score}/100
                  </span>
                </span>
                <span className="text-xs leading-relaxed sm:text-sm">
                  <span className="font-medium text-limbi-text">
                    Ronda de profundización
                  </span>
                  {" · "}
                  Preguntas para esta ronda:{" "}
                  <span className="font-semibold text-limbi-text">{total}</span>
                  {roundDisplayCap ? (
                    <span className="text-limbi-muted"> (hasta {roundDisplayCap})</span>
                  ) : null}
                </span>
              </div>
            ) : null}
          </header>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {current ? (
            <div className="space-y-4">
              <p className="text-xs text-limbi-muted">
                {isFollowUpForm ? "Mejora crítica " : ""}
                {step + 1} de {total}
              </p>

              {stepError ? (
                <p className="text-sm text-destructive" role="status">
                  {stepError}
                </p>
              ) : null}

              {inlineFollowUpParentId === current.id ? (
                <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3">
                  <p className="text-sm font-medium text-limbi-text">
                    Limbi necesita un matiz más concreto
                  </p>
                  <p className="text-xs text-limbi-muted">
                    Tu respuesta anterior era muy genérica para esta pregunta.
                  </p>
                  <Textarea
                    rows={3}
                    value={inlineFollowDraft}
                    onChange={(e) => setInlineFollowDraft(e.target.value)}
                    placeholder="Ej.: años en colegios X, testimonio de la coordinadora, rutina que observaste…"
                    className="resize-none rounded-xl border-limbi-border"
                  />
                </div>
              ) : (
                <>
                  {current.limbi_detection ? (
                    <p className="text-sm text-limbi-text">{current.limbi_detection}</p>
                  ) : null}
                  <details className="text-xs text-limbi-muted">
                    <summary className="cursor-pointer font-medium text-limbi-text">
                      Ver contexto de tu cuestionario
                    </summary>
                    <blockquote className="mt-2 rounded-lg border border-limbi-border/60 bg-limbi-bg-soft/60 px-2 py-1.5 italic">
                      «{current.referenced_user_answer}»
                    </blockquote>
                    <p className="mt-1">{current.why_it_matters}</p>
                  </details>
                  <p className="text-base font-medium text-limbi-text">
                    {current.question_text}
                  </p>

                  {current.options && current.options.length > 0 ? (
                    <div
                      className="flex flex-wrap gap-2"
                      role="group"
                      aria-label="Opciones sugeridas"
                    >
                      {current.options.map((opt) => {
                        const sel =
                          (drafts[current.id]?.optionId ?? "") === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setStepError(null);
                              setDraft(current.id, { optionId: opt.id });
                            }}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm transition-colors",
                              sel
                                ? "border-limbi-green/60 bg-limbi-green/[0.12] text-limbi-text"
                                : "border-limbi-border text-limbi-muted hover:bg-limbi-bg-soft/80",
                            )}
                          >
                            {opt.label}
                          </button>
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
                          ? "Detalle (opcional)"
                          : "Tu respuesta"}
                      </label>
                      <Textarea
                        id={`ft-${current.id}`}
                        rows={3}
                        value={drafts[current.id]?.freeText ?? ""}
                        onChange={(e) =>
                          setDraft(current.id, { freeText: e.target.value })
                        }
                        placeholder="Sé concreto: hechos, prioridades, ejemplos breves…"
                        className="resize-none rounded-xl border-limbi-border"
                      />
                    </div>
                  ) : null}
                </>
              )}

              <div className="flex flex-wrap justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={step === 0 || saving}
                  onClick={() => {
                    setInlineFollowUpParentId(null);
                    setInlineFollowDraft("");
                    setStep((s) => Math.max(0, s - 1));
                  }}
                >
                  Anterior
                </Button>
                {step < total - 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    className={cn("rounded-xl", limbiPrimaryButtonClass)}
                    disabled={!canAdvance || saving}
                    onClick={() => advanceStep()}
                  >
                    {inlineFollowUpParentId === current.id ? "Listo" : "Siguiente"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className={cn("rounded-xl", limbiPrimaryButtonClass)}
                    disabled={!canAdvance || saving}
                    onClick={() => {
                      if (inlineFollowUpParentId === current.id) {
                        const t = inlineFollowDraft.trim();
                        if (t.length === 0) return;
                        setPendingInlineFollowUps((prev) => ({
                          ...prev,
                          [current.id]: t,
                        }));
                        setFollowUpsUsed((n) => n + 1);
                        setFollowUpUsedIds((s) => new Set(s).add(current.id));
                        setInlineFollowUpParentId(null);
                        setInlineFollowDraft("");
                        if (isFollowUpForm) void submitFollowUp();
                        else void submitRound1();
                        return;
                      }
                      const combined = answerCombinedText(
                        current,
                        drafts[current.id],
                      );
                      if (
                        !skipUniversalVagueGate(current.id) &&
                        followUpsUsed < 2 &&
                        !followUpUsedIds.has(current.id) &&
                        isVagueClarificationAnswerText(combined)
                      ) {
                        setInlineFollowUpParentId(current.id);
                        setInlineFollowDraft("");
                        return;
                      }
                      if (isFollowUpForm) void submitFollowUp();
                      else void submitRound1();
                    }}
                  >
                    {inlineFollowUpParentId === current.id
                      ? "Listo y enviar"
                      : isFollowUpForm
                        ? "Guardar mejoras"
                        : "Continuar"}
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {saving && !error ? (
            <p className="flex items-center gap-2 text-sm text-limbi-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Guardando…
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
