"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
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
import { cn } from "@/lib/utils";
import {
  WIZARD_STEP_ORDER,
  wizardReviewEditHref,
  type WizardStepId,
} from "@/lib/constants/wizard";
import { MASTER_DOCUMENT_QUALITY_NOTE } from "@/lib/master-document/quality-note";
import { QualityScoreRing } from "@/components/projects/quality-score-ring";
import { NextActionBanner } from "@/components/projects/next-action-banner";
import { SystemHealthStrip } from "@/components/projects/system-health-strip";
import { SystemStepper } from "@/components/projects/system-stepper";
import {
  deriveNextSystemAction,
  deriveSystemHealthStrip,
  deriveSystemStepperSteps,
  sumGeneratedContentCounts,
  type SystemStatusContext,
} from "@/components/projects/system-status-utils";
import {
  limbiLoadingMessage,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";

const LEGACY_MASTER_NO_IQA_MESSAGE =
  "Esta Lectura Límbica se generó con una versión anterior. Actualiza el Sistema Límbico para ver el diagnóstico de calidad.";

const LEGACY_IQA_NO_SECTION_SCORES =
  "Actualiza el Sistema Límbico para ver la puntuación por sección del cuestionario y acciones de mejora concretas.";

type MasterRow = {
  id: string;
  project_id: string;
  version: number;
  status: string;
  created_at: string;
};

type FrameworkRow = {
  id: string;
  project_id: string;
  master_document_id: string;
  version: number;
  status: string;
  created_at: string;
};

type ProjectRow = {
  id: string;
  user_id: string;
  name_or_descriptor: string;
  name_status: string;
  challenge_type: string | null;
  main_challenge: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type SectionScoreRow = {
  section_label: string;
  quality_score: number;
  status: string;
  diagnosis: string;
  why_it_matters: string;
  recommended_improvement: string;
  edit_target_step: string;
};

type InputQualityAssessment = {
  overall_readiness: string;
  overall_quality_score?: number;
  quality_note?: string;
  section_scores?: SectionScoreRow[];
  strengths: string[];
  weaknesses: string[];
  missing_information: string[];
  recommended_questions_to_improve: string[];
  risk_if_generating_framework_now: string;
  can_generate_framework: boolean;
};

function parseInputQualityAssessment(
  raw: unknown,
): InputQualityAssessment | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const readiness = o.overall_readiness;
  if (readiness !== "low" && readiness !== "medium" && readiness !== "high") {
    return null;
  }
  const readStrArr = (v: unknown): string[] | null => {
    if (!Array.isArray(v)) return null;
    const out: string[] = [];
    for (const el of v) {
      if (typeof el !== "string" || el.trim().length === 0) return null;
      out.push(el.trim());
    }
    return out;
  };
  const strengths = readStrArr(o.strengths);
  const weaknesses = readStrArr(o.weaknesses);
  const missing_information = readStrArr(o.missing_information);
  const recommended_questions_to_improve = readStrArr(
    o.recommended_questions_to_improve,
  );
  const risk = o.risk_if_generating_framework_now;
  const can = o.can_generate_framework;
  if (
    strengths === null ||
    weaknesses === null ||
    missing_information === null ||
    recommended_questions_to_improve === null
  ) {
    return null;
  }
  if (typeof risk !== "string" || risk.trim().length === 0) return null;
  if (typeof can !== "boolean") return null;

  let overall_quality_score: number | undefined;
  const oqs = o.overall_quality_score;
  if (
    typeof oqs === "number" &&
    Number.isInteger(oqs) &&
    oqs >= 0 &&
    oqs <= 100
  ) {
    overall_quality_score = oqs;
  }

  let quality_note: string | undefined;
  if (typeof o.quality_note === "string" && o.quality_note.trim().length > 0) {
    quality_note = o.quality_note.trim();
  }

  let section_scores: SectionScoreRow[] | undefined;
  const rawSections = o.section_scores;
  if (Array.isArray(rawSections) && rawSections.length > 0) {
    const rows: SectionScoreRow[] = [];
    for (const item of rawSections) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const r = item as Record<string, unknown>;
      const label = r.section_label;
      const qs = r.quality_score;
      const st = r.status;
      const diag = r.diagnosis;
      const wim = r.why_it_matters;
      const rec = r.recommended_improvement;
      const ets = r.edit_target_step;
      if (
        typeof label !== "string" ||
        label.trim().length === 0 ||
        typeof qs !== "number" ||
        !Number.isInteger(qs) ||
        qs < 0 ||
        qs > 100 ||
        (st !== "low" && st !== "medium" && st !== "high") ||
        typeof diag !== "string" ||
        diag.trim().length === 0 ||
        typeof wim !== "string" ||
        wim.trim().length === 0 ||
        typeof rec !== "string" ||
        rec.trim().length === 0 ||
        typeof ets !== "string" ||
        !WIZARD_STEP_ORDER.includes(ets as WizardStepId)
      ) {
        continue;
      }
      rows.push({
        section_label: label.trim(),
        quality_score: qs,
        status: st,
        diagnosis: diag.trim(),
        why_it_matters: wim.trim(),
        recommended_improvement: rec.trim(),
        edit_target_step: ets,
      });
    }
    if (rows.length > 0) section_scores = rows;
  }

  return {
    overall_readiness: readiness,
    ...(overall_quality_score !== undefined
      ? { overall_quality_score }
      : {}),
    ...(quality_note !== undefined ? { quality_note } : {}),
    ...(section_scores !== undefined ? { section_scores } : {}),
    strengths,
    weaknesses,
    missing_information,
    recommended_questions_to_improve,
    risk_if_generating_framework_now: risk.trim(),
    can_generate_framework: can,
  };
}

type StatusPayload = {
  project: ProjectRow;
  has_completed_wizard: boolean;
  completed_steps: string[];
  active_master_document: MasterRow | null;
  input_quality_assessment: unknown | null;
  responses_have_changed_since_master?: boolean;
  framework_is_outdated_since_master?: boolean;
  has_active_framework_revision_guidance?: boolean;
  latest_visible_framework: FrameworkRow | null;
  approved_visible_framework: FrameworkRow | null;
  generated_content_counts: {
    short_pitch: number;
    captions: number;
    content_ideas: number;
    graphic_phrases: number;
  };
};

type Props = {
  projectId: string;
};

export function ProjectDetailClient({ projectId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatusPayload | null>(null);
  const [masterBusy, setMasterBusy] = useState(false);
  const [frameworkBusy, setFrameworkBusy] = useState(false);
  const [masterSuccessMessage, setMasterSuccessMessage] = useState<
    string | null
  >(null);

  const systemLoadingLine = useMemo(
    () => limbiLoadingMessage(`project-detail-${projectId}`),
    [projectId],
  );

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/status`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: unknown;
      } & Partial<StatusPayload>;
      if (!res.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : res.status === 404
              ? "Sistema no encontrado."
              : "No se pudo cargar el estado del sistema.";
        throw new Error(msg);
      }
      if (!json.project) throw new Error("Respuesta inválida del servidor.");
      setData({
        project: json.project,
        has_completed_wizard: Boolean(json.has_completed_wizard),
        completed_steps: Array.isArray(json.completed_steps)
          ? json.completed_steps
          : [],
        active_master_document: json.active_master_document ?? null,
        input_quality_assessment:
          json.input_quality_assessment === undefined
            ? null
            : json.input_quality_assessment,
        responses_have_changed_since_master:
          typeof json.responses_have_changed_since_master === "boolean"
            ? json.responses_have_changed_since_master
            : undefined,
        framework_is_outdated_since_master:
          typeof json.framework_is_outdated_since_master === "boolean"
            ? json.framework_is_outdated_since_master
            : undefined,
        has_active_framework_revision_guidance:
          typeof json.has_active_framework_revision_guidance === "boolean"
            ? json.has_active_framework_revision_guidance
            : undefined,
        latest_visible_framework: json.latest_visible_framework ?? null,
        approved_visible_framework: json.approved_visible_framework ?? null,
        generated_content_counts: json.generated_content_counts ?? {
          short_pitch: 0,
          captions: 0,
          content_ideas: 0,
          graphic_phrases: 0,
        },
      });
    } catch (e) {
      if (!silent) {
        setData(null);
      }
      setError(
        e instanceof Error ? e.message : "Error al cargar el sistema.",
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const postGenerateMaster = useCallback(async () => {
    setMasterBusy(true);
    setError(null);
    setMasterSuccessMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-master`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "No se pudo generar la Lectura Límbica.",
        );
      }
      await load({ silent: true });
      router.refresh();
      setMasterSuccessMessage("Lectura Límbica actualizada.");
      window.setTimeout(() => {
        setMasterSuccessMessage(null);
      }, 5000);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error al actualizar la Lectura Límbica.",
      );
    } finally {
      setMasterBusy(false);
    }
  }, [projectId, load, router]);

  const postGenerateFramework = useCallback(async () => {
    setFrameworkBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/generate-framework`,
        { method: "POST", credentials: "include" },
      );
      const json = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "No se pudo crear el Marco Estratégico Límbico.",
        );
      }
      await load({ silent: true });
      router.refresh();
      router.push(`/projects/${projectId}/framework`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error al crear el Marco Límbico.",
      );
    } finally {
      setFrameworkBusy(false);
    }
  }, [projectId, load, router]);

  const handleRegenerateMaster = useCallback(async () => {
    const changed = data?.responses_have_changed_since_master;
    let msg =
      "Se creará una nueva Lectura Límbica y se activará. ¿Continuar?";
    if (changed === true) {
      msg =
        "¿Actualizar el Sistema Límbico con tus respuestas actuales para renovar el diagnóstico?";
    } else if (changed === false) {
      msg =
        "No se detectan cambios en tus respuestas. Actualizar consumirá IA de todas formas. ¿Quieres continuar?";
    }
    if (!window.confirm(msg)) return;
    await postGenerateMaster();
  }, [data, postGenerateMaster]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
        <Card className="rounded-[22px] border border-limbi-border bg-limbi-surface shadow-limbi">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2
              className="size-8 animate-spin text-limbi-green"
              aria-hidden
            />
            <p className="text-sm text-limbi-muted">
              {systemLoadingLine}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
        <Card className="border-destructive/40 shadow-none">
          <CardHeader>
            <CardTitle className="text-destructive">
              No se pudo cargar el sistema
            </CardTitle>
            <CardDescription className="text-destructive/90">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
            <Button variant="outline" asChild className={limbiOutlineButtonClass}>
              <Link href="/projects">
                <ArrowLeft className="size-4" aria-hidden />
                Volver a tus sistemas
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { has_completed_wizard, active_master_document } = data;
  const iqa = parseInputQualityAssessment(data.input_quality_assessment);
  const latest = data.latest_visible_framework;
  const approved = data.approved_visible_framework;
  const hasActiveMaster = active_master_document !== null;
  const hasAnyFramework = latest !== null;
  const hasApprovedFramework = approved !== null;
  const latestIsDraft = latest?.status === "draft";

  const stage1Done = has_completed_wizard && hasActiveMaster;
  const stage2Unlocked = hasActiveMaster;
  const iqaHasSectionScores = Boolean(iqa?.section_scores?.length);
  const responsesChanged =
    data.responses_have_changed_since_master === true;
  const frameworkOutdatedSinceMaster =
    data.framework_is_outdated_since_master === true;

  const marcoAlineado =
    hasAnyFramework &&
    !responsesChanged &&
    !frameworkOutdatedSinceMaster;
  const showGenerarMarcoEnEtapa2 =
    hasActiveMaster && iqa && !hasAnyFramework && !responsesChanged;

  const systemCtx: SystemStatusContext = {
    projectId,
    has_completed_wizard,
    hasActiveMaster,
    hasIqa: Boolean(iqa),
    responsesChanged,
    frameworkOutdatedSinceMaster,
    hasAnyFramework,
    hasApprovedFramework,
    latestIsDraft,
    marcoAlineado,
    contentPiecesTotal: sumGeneratedContentCounts(
      data.generated_content_counts,
    ),
  };
  const nextAction = deriveNextSystemAction(systemCtx);
  const stepperSteps = deriveSystemStepperSteps(systemCtx);
  const healthModel = deriveSystemHealthStrip(systemCtx);
  const suppressResponseDriftCallouts =
    responsesChanged && nextAction.kind === "update_system";
  const suppressFrameworkStaleCallouts =
    frameworkOutdatedSinceMaster &&
    !responsesChanged &&
    nextAction.kind === "update_framework";

  const limbiPrimarySm = cn("gap-2", limbiPrimaryButtonClass);

  const hasActiveRevisionGuidance =
    data.has_active_framework_revision_guidance === true;
  const revisionGuidancePersistenceHint = hasActiveRevisionGuidance ? (
    <p className="mt-2 text-xs text-muted-foreground">
      Se mantendrá la última sugerencia editorial aplicada al Marco Límbico.
    </p>
  ) : null;

  const nextPrimaryNode = (() => {
    switch (nextAction.kind) {
      case "continue_wizard":
        return (
          <Button size="sm" className={limbiPrimarySm} asChild>
            <Link href={nextAction.primaryHref!}>{nextAction.primaryLabel}</Link>
          </Button>
        );
      case "generate_master":
        return (
          <Button
            type="button"
            size="sm"
            className={limbiPrimarySm}
            disabled={masterBusy}
            onClick={() => void postGenerateMaster()}
          >
            {masterBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {nextAction.primaryLabel}
          </Button>
        );
      case "update_system":
      case "renew_reading_diagnosis":
        return (
          <Button
            type="button"
            size="sm"
            className={limbiPrimarySm}
            disabled={masterBusy || frameworkBusy}
            onClick={() => void handleRegenerateMaster()}
          >
            {masterBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {nextAction.primaryLabel}
          </Button>
        );
      case "create_framework":
      case "update_framework":
        return (
          <Button
            type="button"
            size="sm"
            className={limbiPrimarySm}
            disabled={frameworkBusy || masterBusy}
            onClick={() => void postGenerateFramework()}
          >
            {frameworkBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {nextAction.primaryLabel}
          </Button>
        );
      case "review_framework_draft":
      case "create_content":
      case "review_content":
        return (
          <Button size="sm" className={limbiPrimarySm} asChild>
            <Link href={nextAction.primaryHref!}>
              {nextAction.kind === "create_content" ? (
                <Sparkles className="size-4" aria-hidden />
              ) : null}
              {nextAction.primaryLabel}
            </Link>
          </Button>
        );
      default:
        return null;
    }
  })();

  const nextSecondaryNode =
    nextAction.secondaryHref && nextAction.secondaryLabel ? (
      <Button
        variant="outline"
        size="sm"
        className={limbiOutlineButtonClass}
        asChild
      >
        <Link href={nextAction.secondaryHref}>{nextAction.secondaryLabel}</Link>
      </Button>
    ) : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10">
      <SystemHealthStrip model={healthModel} />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <NextActionBanner
        variant={nextAction.variant}
        title={nextAction.title}
        description={nextAction.description}
        primaryAction={nextPrimaryNode}
        secondaryAction={nextSecondaryNode}
      />

      <SystemStepper steps={stepperSteps} />

      <ol className="flex flex-col gap-5">
        {/* Etapa 1: Construcción del sistema */}
        <li>
          <StageCard
            step={1}
            title="Construcción del sistema"
            done={stage1Done}
            locked={false}
          >
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>
                {has_completed_wizard
                  ? "Construcción del sistema completada."
                  : "Por construir: completa el cuestionario."}
              </li>
              <li>
                {hasActiveMaster
                  ? "Lectura Límbica generada al finalizar el cuestionario."
                  : "Aún no hay una Lectura Límbica activa (p. ej. falló la generación automática)."}
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/projects/new?projectId=${projectId}`}>
                  Editar respuestas
                </Link>
              </Button>
              {has_completed_wizard && !hasActiveMaster ? (
                <Button
                  type="button"
                  size="sm"
                  className={limbiPrimarySm}
                  disabled={masterBusy}
                  onClick={() => void postGenerateMaster()}
                >
                  {masterBusy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-4" aria-hidden />
                  )}
                  Generar Lectura Límbica
                </Button>
              ) : null}
            </div>
          </StageCard>
        </li>

        {/* Etapa 2: Lectura Límbica */}
        <li>
          <StageCard
            step={2}
            title="Lectura Límbica"
            done={Boolean(iqa)}
            locked={!stage2Unlocked}
          >
            {!stage2Unlocked ? (
              <LockedHint text="Cuando exista una Lectura Límbica activa, verás aquí el diagnóstico de calidad de los insumos." />
            ) : !iqa ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {LEGACY_MASTER_NO_IQA_MESSAGE}
                </p>
                {masterBusy ? (
                  <p
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {systemLoadingLine}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={limbiOutlineButtonClass}
                  disabled={masterBusy}
                  onClick={() => void handleRegenerateMaster()}
                >
                  {masterBusy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  Renovar Lectura Límbica
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {masterSuccessMessage ? (
                  <p
                    className="rounded-xl border border-limbi-green/35 bg-limbi-green/10 px-3 py-2 text-sm text-limbi-text"
                    role="status"
                  >
                    {masterSuccessMessage}
                  </p>
                ) : null}
                {masterBusy ? (
                  <p
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {systemLoadingLine}
                  </p>
                ) : null}
                {responsesChanged && !suppressResponseDriftCallouts ? (
                  <div className="rounded-xl border border-limbi-yellow/35 bg-limbi-yellow/10 px-3 py-2 text-sm text-limbi-text">
                    El sistema recibió nueva información. Actualiza su lectura
                    antes de crear un nuevo marco.
                  </div>
                ) : null}
                {!iqaHasSectionScores ? (
                  <p className="rounded-xl border border-limbi-border bg-limbi-bg-soft px-3 py-2 text-sm text-limbi-muted">
                    {LEGACY_IQA_NO_SECTION_SCORES}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-start gap-4">
                  {typeof iqa.overall_quality_score === "number" ? (
                    <QualityScoreRing score={iqa.overall_quality_score} />
                  ) : null}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <ReadinessBadge readiness={iqa.overall_readiness} />
                      {typeof iqa.overall_quality_score === "number" ? (
                        <span className="text-sm font-medium text-foreground">
                          Puntuación global de la base
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      No es necesario llegar al 100%. Una base por encima del 80%
                      suele ser suficiente para generar un Marco más preciso.
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {MASTER_DOCUMENT_QUALITY_NOTE}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Volvemos a leer tus respuestas para actualizar la base narrativa
                  del sistema.
                </p>
                {iqa.section_scores && iqa.section_scores.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Calidad por sección
                    </p>
                    <ul className="grid gap-3">
                      {iqa.section_scores.map((row) => (
                        <li
                          key={`${row.section_label}-${row.edit_target_step}`}
                          className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
                              <QualityScoreRing
                                score={row.quality_score}
                                size="sm"
                                className="mt-0.5"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">
                                  {row.section_label}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  <SectionScoreStatusPill status={row.status} /> ·{" "}
                                  <span className="font-mono tabular-nums">
                                    {row.quality_score}%
                                  </span>
                                </p>
                              </div>
                            </div>
                            {WIZARD_STEP_ORDER.includes(
                              row.edit_target_step as WizardStepId,
                            ) ? (
                              <Button variant="outline" size="sm" asChild>
                                <Link
                                  href={wizardReviewEditHref(
                                    projectId,
                                    row.edit_target_step as WizardStepId,
                                    "project",
                                  )}
                                >
                                  Editar sección
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-foreground">
                            <span className="font-medium">Diagnóstico: </span>
                            {row.diagnosis}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">
                              Por qué importa:{" "}
                            </span>
                            {row.why_it_matters}
                          </p>
                          <p className="mt-1 text-sm text-foreground">
                            <span className="font-medium">Recomendación: </span>
                            {row.recommended_improvement}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!iqa.can_generate_framework ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-50/95">
                    <strong className="font-semibold">Atención.</strong> La base
                    todavía puede mejorar.                     Puedes crear el Marco Límbico de todas
                    formas, pero el resultado será más sólido si completas la
                    información sugerida.
                  </div>
                ) : null}
                <IqaList title="Fortalezas" items={iqa.strengths} />
                <IqaList title="Debilidades" items={iqa.weaknesses} />
                <IqaList
                  title="Información faltante"
                  items={iqa.missing_information}
                />
                <IqaList
                  title="Preguntas recomendadas para mejorar"
                  items={iqa.recommended_questions_to_improve}
                />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Riesgo si se crea el Marco Límbico ahora
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    {iqa.risk_if_generating_framework_now}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/projects/new?projectId=${projectId}`}>
                      Mejorar respuestas
                    </Link>
                  </Button>
                  {responsesChanged ? (
                    <Button
                      type="button"
                      size="sm"
                      className={cn(
                        limbiPrimarySm,
                        "ring-2 ring-limbi-green/30 ring-offset-2 ring-offset-background",
                      )}
                      disabled={masterBusy || frameworkBusy}
                      onClick={() => void handleRegenerateMaster()}
                    >
                      {masterBusy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Sparkles className="size-4" aria-hidden />
                      )}
                      Actualizar Sistema Límbico
                    </Button>
                  ) : null}
                  {showGenerarMarcoEnEtapa2 ? (
                    <Button
                      type="button"
                      size="sm"
                      className={limbiPrimarySm}
                      disabled={frameworkBusy || masterBusy}
                      onClick={() => void postGenerateFramework()}
                    >
                      {frameworkBusy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Sparkles className="size-4" aria-hidden />
                      )}
                      Crear Marco Estratégico Límbico
                    </Button>
                  ) : null}
                </div>
                {showGenerarMarcoEnEtapa2 ? revisionGuidancePersistenceHint : null}
              </div>
            )}
          </StageCard>
        </li>

        {/* Etapa 3: Marco Estratégico Límbico */}
        <li>
          <StageCard
            step={3}
            title="Marco Estratégico Límbico"
            done={marcoAlineado}
            locked={!hasActiveMaster}
          >
            {!hasActiveMaster ? (
              <LockedHint text="Primero necesitas una Lectura Límbica activa." />
            ) : latestIsDraft ? (
              <>
                {hasAnyFramework &&
                responsesChanged &&
                !suppressResponseDriftCallouts ? (
                  <div className="mb-4 rounded-lg border border-amber-500/45 bg-amber-500/10 px-3 py-3 text-sm leading-relaxed text-amber-950 dark:text-amber-50/95">
                    El sistema recibió nueva información. Actualiza su lectura
                    antes de crear un nuevo marco.
                    <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className={limbiPrimarySm}
                      disabled={masterBusy || frameworkBusy}
                      onClick={() => void handleRegenerateMaster()}
                    >
                        {masterBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="size-4" aria-hidden />
                        )}
                        Actualizar Sistema Límbico
                      </Button>
                    </div>
                  </div>
                ) : null}
                {hasAnyFramework &&
                frameworkOutdatedSinceMaster &&
                !responsesChanged &&
                !suppressFrameworkStaleCallouts ? (
                  <div className="mb-4 rounded-lg border border-amber-500/45 bg-amber-500/10 px-3 py-3 text-sm leading-relaxed text-amber-950 dark:text-amber-50/95">
                    Este marco fue creado con una lectura anterior del sistema.
                    Actualízalo para alinearlo con la memoria vigente.
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className={limbiPrimarySm}
                        disabled={frameworkBusy || masterBusy}
                        onClick={() => void postGenerateFramework()}
                      >
                        {frameworkBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="size-4" aria-hidden />
                        )}
                        Actualizar Marco Estratégico Límbico
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/projects/${projectId}/framework`}>
                          Ver Marco Estratégico Límbico
                        </Link>
                      </Button>
                    </div>
                    {revisionGuidancePersistenceHint}
                  </div>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Estado: <strong>Marco en borrador</strong>
                  {hasApprovedFramework
                    ? ` (también hay versión aprobada v${approved!.version}).`
                    : "."}
                </p>
                {marcoAlineado ? (
                  <>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Ya existe un borrador del Marco Estratégico Límbico.
                      Revísalo y apruébalo cuando estés conforme.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" className={limbiPrimarySm} asChild>
                        <Link href={`/projects/${projectId}/framework`}>
                          Ver Marco Estratégico Límbico
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/projects/${projectId}/framework`}>
                          Revisar y aprobar Marco Límbico
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : responsesChanged ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/projects/${projectId}/framework`}>
                        Ver Marco Estratégico Límbico
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </>
            ) : hasApprovedFramework ? (
              <>
                {responsesChanged && !suppressResponseDriftCallouts ? (
                  <div className="mb-4 rounded-lg border border-amber-500/45 bg-amber-500/10 px-3 py-3 text-sm leading-relaxed text-amber-950 dark:text-amber-50/95">
                    El sistema recibió nueva información. Actualiza su lectura
                    antes de crear un nuevo marco.
                    <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className={limbiPrimarySm}
                      disabled={masterBusy || frameworkBusy}
                      onClick={() => void handleRegenerateMaster()}
                    >
                        {masterBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="size-4" aria-hidden />
                        )}
                        Actualizar Sistema Límbico
                      </Button>
                    </div>
                  </div>
                ) : null}
                {frameworkOutdatedSinceMaster &&
                !responsesChanged &&
                !suppressFrameworkStaleCallouts ? (
                  <div className="mb-4 rounded-lg border border-amber-500/45 bg-amber-500/10 px-3 py-3 text-sm leading-relaxed text-amber-950 dark:text-amber-50/95">
                    Este marco fue creado con una lectura anterior del sistema.
                    Actualízalo para alinearlo con la memoria vigente.
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className={limbiPrimarySm}
                        disabled={frameworkBusy || masterBusy}
                        onClick={() => void postGenerateFramework()}
                      >
                        {frameworkBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="size-4" aria-hidden />
                        )}
                        Actualizar Marco Estratégico Límbico
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/projects/${projectId}/framework`}>
                          Ver Marco Estratégico Límbico
                        </Link>
                      </Button>
                    </div>
                    {revisionGuidancePersistenceHint}
                  </div>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Estado: <strong>Marco aprobado</strong>. Versión aprobada v
                  {approved!.version}.
                </p>
                {marcoAlineado ? (
                  <>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      El Marco Estratégico Límbico ya fue aprobado y puede usarse
                      como base para crear piezas narrativas.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" className={limbiPrimarySm} asChild>
                        <Link href={`/projects/${projectId}/framework`}>
                          Ver Marco Estratégico Límbico aprobado
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : responsesChanged ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/projects/${projectId}/framework`}>
                        Ver Marco Estratégico Límbico
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </>
            ) : hasAnyFramework ? (
              <>
                {responsesChanged && !suppressResponseDriftCallouts ? (
                  <div className="mb-4 rounded-lg border border-amber-500/45 bg-amber-500/10 px-3 py-3 text-sm leading-relaxed text-amber-950 dark:text-amber-50/95">
                    El sistema recibió nueva información. Actualiza su lectura
                    antes de crear un nuevo marco.
                    <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className={limbiPrimarySm}
                      disabled={masterBusy || frameworkBusy}
                      onClick={() => void handleRegenerateMaster()}
                    >
                        {masterBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="size-4" aria-hidden />
                        )}
                        Actualizar Sistema Límbico
                      </Button>
                    </div>
                  </div>
                ) : null}
                {frameworkOutdatedSinceMaster &&
                !responsesChanged &&
                !suppressFrameworkStaleCallouts ? (
                  <div className="mb-4 rounded-lg border border-amber-500/45 bg-amber-500/10 px-3 py-3 text-sm leading-relaxed text-amber-950 dark:text-amber-50/95">
                    Este marco fue creado con una lectura anterior del sistema.
                    Actualízalo para alinearlo con la memoria vigente.
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className={limbiPrimarySm}
                        disabled={frameworkBusy || masterBusy}
                        onClick={() => void postGenerateFramework()}
                      >
                        {frameworkBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="size-4" aria-hidden />
                        )}
                        Actualizar Marco Estratégico Límbico
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/projects/${projectId}/framework`}>
                          Ver Marco Estratégico Límbico
                        </Link>
                      </Button>
                    </div>
                    {revisionGuidancePersistenceHint}
                  </div>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Última versión del marco:{" "}
                  <strong>
                    {latest?.status ?? "—"} (v{latest?.version ?? "—"})
                  </strong>
                  .
                </p>
                {marcoAlineado ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" className={limbiPrimarySm} asChild>
                      <Link href={`/projects/${projectId}/framework`}>
                        Ver Marco Estratégico Límbico
                      </Link>
                    </Button>
                  </div>
                ) : responsesChanged ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/projects/${projectId}/framework`}>
                        Ver Marco Estratégico Límbico
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {responsesChanged && !suppressResponseDriftCallouts ? (
                  <div className="mb-4 rounded-lg border border-amber-500/45 bg-amber-500/10 px-3 py-3 text-sm leading-relaxed text-amber-950 dark:text-amber-50/95">
                    El sistema recibió nueva información. Actualiza su lectura
                    antes de crear un nuevo marco.
                    <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className={limbiPrimarySm}
                      disabled={masterBusy || frameworkBusy}
                      onClick={() => void handleRegenerateMaster()}
                    >
                        {masterBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="size-4" aria-hidden />
                        )}
                        Actualizar Sistema Límbico
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Aún no hay Marco Estratégico Límbico visible. Crea el
                      borrador desde esta etapa cuando la Lectura Límbica esté al
                      día.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className={limbiPrimarySm}
                        disabled={frameworkBusy || masterBusy}
                        onClick={() => void postGenerateFramework()}
                      >
                        {frameworkBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="size-4" aria-hidden />
                        )}
                        Crear Marco Estratégico Límbico
                      </Button>
                    </div>
                    {revisionGuidancePersistenceHint}
                  </>
                )}
              </>
            )}
          </StageCard>
        </li>

        {/* Etapa 4: Piezas narrativas */}
        <li>
          <StageCard
            step={4}
            title="Piezas narrativas"
            done={hasApprovedFramework}
            locked={!hasApprovedFramework}
          >
            {!hasApprovedFramework ? (
              <>
                <LockedHint text="Primero aprueba el Marco Estratégico Límbico para crear piezas desde una base validada." />
                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className={limbiOutlineButtonClass}
                    asChild
                  >
                    <Link href={`/projects/${projectId}/framework`}>
                      Ver Marco Estratégico Límbico
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                {systemCtx.contentPiecesTotal > 0 ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Ya tienes piezas creadas desde este Sistema Límbico. Puedes
                    revisarlas, refinarlas o crear nuevas versiones desde la
                    misma base.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Listo para crear piezas narrativas. Se anclan al Marco
                    Estratégico Límbico aprobado y a la Lectura Límbica activa;
                    si cambias respuestas o el marco, conviene actualizar la
                    base antes de nuevas generaciones.
                  </p>
                )}
                <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <li className="rounded-xl border border-limbi-border/90 bg-limbi-bg-soft/80 px-3 py-2 text-limbi-muted">
                    Pitch Corto:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {data.generated_content_counts.short_pitch}
                    </span>
                  </li>
                  <li className="rounded-xl border border-limbi-border/90 bg-limbi-bg-soft/80 px-3 py-2 text-limbi-muted">
                    Captions:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {data.generated_content_counts.captions}
                    </span>
                  </li>
                  <li className="rounded-xl border border-limbi-border/90 bg-limbi-bg-soft/80 px-3 py-2 text-limbi-muted">
                    Ideas de Contenido:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {data.generated_content_counts.content_ideas}
                    </span>
                  </li>
                  <li className="rounded-xl border border-limbi-border/90 bg-limbi-bg-soft/80 px-3 py-2 text-limbi-muted">
                    Frases Gráficas:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {data.generated_content_counts.graphic_phrases}
                    </span>
                  </li>
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" className={limbiPrimarySm} asChild>
                    <Link href={`/projects/${projectId}/content`}>
                      {systemCtx.contentPiecesTotal > 0 ? null : (
                        <Sparkles className="size-4" aria-hidden />
                      )}
                      {systemCtx.contentPiecesTotal > 0
                        ? "Ver piezas narrativas"
                        : "Crear piezas narrativas"}
                    </Link>
                  </Button>
                  {systemCtx.contentPiecesTotal > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn("gap-2", limbiOutlineButtonClass)}
                      asChild
                    >
                      <Link href={`/projects/${projectId}/content`}>
                        <Sparkles className="size-4" aria-hidden />
                        Crear nuevas piezas
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </StageCard>
        </li>
      </ol>
    </div>
  );
}

function SectionScoreStatusPill({ status }: { status: string }) {
  const label =
    status === "high" ? "Alta" : status === "medium" ? "Media" : "Baja";
  return <span>{label}</span>;
}

function ReadinessBadge({ readiness }: { readiness: string }) {
  const label =
    readiness === "high"
      ? "Alta"
      : readiness === "medium"
        ? "Media"
        : "Baja";
  const cls =
    readiness === "high"
      ? "border-limbi-green/40 bg-limbi-green/10 text-limbi-text"
      : readiness === "medium"
        ? "border-limbi-yellow/45 bg-limbi-yellow/12 text-limbi-text"
        : "border-limbi-red/40 bg-limbi-red/10 text-limbi-text";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Preparación de insumos
      </span>
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
          cls,
        )}
      >
        {label} ({readiness})
      </span>
    </div>
  );
}

function IqaList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm italic text-muted-foreground">Ninguna.</p>
      ) : (
        <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-foreground">
          {items.map((t, i) => (
            <li key={`${title}-${String(i)}`}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StageCard({
  step,
  title,
  done,
  locked,
  children,
}: {
  step: number;
  title: string;
  done: boolean;
  locked: boolean;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[22px] border border-limbi-border bg-limbi-surface shadow-limbi",
        locked && "border-dashed opacity-95",
      )}
    >
      <CardHeader className="border-b border-limbi-border/80 bg-limbi-surface-soft/90 pb-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0" aria-hidden>
            {locked ? (
              <Lock className="size-5 text-muted-foreground" />
            ) : done ? (
              <CheckCircle2 className="size-5 text-limbi-green" />
            ) : (
              <Circle className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Etapa {step}
            </p>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1">
              {locked
                ? "Bloqueada hasta completar el paso anterior."
                : done
                  ? "Activo."
                  : "Por construir."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

function LockedHint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-950 dark:text-amber-50/95">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </div>
  );
}
