"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { isGuidedIntakePilotEnabled } from "@/lib/intake/guided-intake-flag";
import type { LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";
import {
  buildOfferingPilotSummary,
  OFFERING_PILOT_NO_ALERTS_COPY,
  type OfferingPilotSummary,
} from "@/lib/intake/offering-pilot-summary";
import {
  PILOT_ESCAPE_CHIPS,
  pilotMainQuestionText,
} from "@/lib/intake/question-bank";
import type { PilotEscapeChipId } from "@/lib/intake/question-bank";
import { nameStatusSchema } from "@/lib/schemas/project";
import type { z } from "zod";

type NameStatus = z.infer<typeof nameStatusSchema>;

type IntakeTurnResponse = {
  extraction: IntakeExtractionOutput;
  trace: LimbicInterviewTraceV1;
  follow_up_question: string | null;
  suggested_chips: string[];
  summary: OfferingPilotSummary | null;
};

export function GuidedIntakePilot() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [nameOrDescriptor, setNameOrDescriptor] = useState("");
  const [nameStatus, setNameStatus] = useState<NameStatus | null>("provisional");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [challengeType, setChallengeType] = useState<string | null>(null);
  const [mainQuestion, setMainQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [suggestedChips, setSuggestedChips] = useState<string[]>([]);
  const [tracePhase, setTracePhase] =
    useState<LimbicInterviewTraceV1["phase"]>("main");
  const [summary, setSummary] = useState<OfferingPilotSummary | null>(null);

  useEffect(() => {
    if (!isGuidedIntakePilotEnabled()) {
      router.replace("/projects/new");
    }
  }, [router]);

  useEffect(() => {
    if (!projectId) return;
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
        setChallengeType(pJson.project?.challenge_type ?? null);
        const resp = rJson.project_responses?.responses ?? {};
        const tr = resp._limbic_interview_v1 as LimbicInterviewTraceV1 | undefined;
        if (tr?.phase === "done") {
          setTracePhase("done");
          setSummary(buildOfferingPilotSummary(resp, {}));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    setMainQuestion(pilotMainQuestionText(challengeType));
  }, [challengeType]);

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

  const sendTurn = useCallback(
    async (opts: { text?: string; action?: PilotEscapeChipId }) => {
      if (!projectId) return;
      setError(null);
      setSending(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/intake-turn`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: opts.text?.trim() || undefined,
            action: opts.action,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as IntakeTurnResponse & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(
            typeof json.error === "string" ? json.error : "Error al guardar",
          );
        }
        setFollowUp(json.follow_up_question);
        setSuggestedChips(json.suggested_chips ?? []);
        setTracePhase(json.trace.phase);
        setAnswer("");
        if (json.summary) {
          setSummary(json.summary);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setSending(false);
      }
    },
    [projectId],
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
              Entrevista guiada (piloto)
            </CardTitle>
            <CardDescription>
              Módulo: Lo que ofreces y para qué sirve. Crea el sistema para
              empezar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Input
              value={nameOrDescriptor}
              onChange={(e) => setNameOrDescriptor(e.target.value)}
              placeholder="Nombre o descriptor"
              className="text-base"
            />
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
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              className={limbiPrimaryButtonClass}
              disabled={creating}
              onClick={() => void createProject()}
            >
              {creating ? "Creando…" : "Crear y empezar entrevista"}
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

  if (tracePhase === "done") {
    const continueBaseHref = projectId
      ? `/projects/new?projectId=${encodeURIComponent(projectId)}`
      : "/projects/new";

    return (
      <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
        <Card className="rounded-[22px] border border-limbi-border shadow-limbi">
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              Primer módulo listo
            </CardTitle>
            <CardDescription>
              Ya guardamos esta parte como base inicial. Ahora seguimos
              completando el resto del Sistema Límbico.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div>
              <p className="font-medium text-foreground">Lo que entendí</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                {(summary?.understood ?? []).map((s, i) => (
                  <li key={`${i}-${s.slice(0, 24)}`}>{s}</li>
                ))}
              </ul>
            </div>
            {summary?.pendingInfoNote ? (
              <p className="rounded-lg border border-limbi-border bg-muted/40 px-3 py-2 text-muted-foreground">
                {summary.pendingInfoNote}
              </p>
            ) : null}
            <div>
              <p className="font-medium text-foreground">
                Lo que conviene mejorar
              </p>
              {summary?.showWeakSection && (summary.weak?.length ?? 0) > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                  {summary.weak.map((s, i) => (
                    <li key={`${i}-${s.slice(0, 24)}`}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  {OFFERING_PILOT_NO_ALERTS_COPY}
                </p>
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">
                Cómo lo usará Limbi
              </p>
              <p className="mt-2 text-muted-foreground">
                {summary?.limbiUseParagraph ??
                  "Esta información ayudará a construir la base de valor del proyecto y a evitar que Limbi invente beneficios o promesas que no estén claras."}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex w-full flex-col gap-3">
            <div className="w-full space-y-1.5">
              <Button
                type="button"
                className={`${limbiPrimaryButtonClass} w-full`}
                asChild
              >
                <Link href={continueBaseHref}>
                  Seguir construyendo el Sistema
                </Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Continuaremos con las preguntas que faltan para completar la base
                estratégica.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className={`${limbiOutlineButtonClass} w-full`}
              asChild
            >
              <Link href={continueBaseHref}>Completar lo que falta</Link>
            </Button>
            <Link
              href="/projects"
              className="text-center text-sm text-muted-foreground underline underline-offset-4"
            >
              Guardar y salir
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const optionBtnClass =
    "h-auto min-h-[2.75rem] w-full justify-start whitespace-normal px-3 py-2 text-left text-sm font-normal leading-snug";

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex gap-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full",
              i === 2 ? "bg-limbi-green" : "bg-limbi-border",
            )}
            title={i === 2 ? "Módulo activo (piloto)" : ""}
          />
        ))}
      </div>
      <Card className="rounded-[22px] border border-limbi-border shadow-limbi">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Piloto · Módulo 3 de 8
          </p>
          <CardTitle className="font-heading text-xl">
            Lo que ofreces y para qué sirve
          </CardTitle>
          <CardDescription>
            Una pregunta a la vez. Limbi extrae datos estructurados; no redacta
            la campaña todavía.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <p className="text-base font-medium leading-snug text-foreground">
            {followUp ?? mainQuestion}
          </p>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Responde con la esencia: qué ofreces y qué problema o situación resuelve."
            rows={5}
            className="resize-y text-base"
            disabled={sending}
          />
          {suggestedChips.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {suggestedChips.map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="text-xs"
                  disabled={sending}
                  onClick={() => setAnswer((a) => (a ? `${a} ${c}` : c))}
                >
                  {c}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              Si aún no lo tienes claro
            </p>
            <div className="grid gap-2 sm:grid-cols-1">
              {PILOT_ESCAPE_CHIPS.map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  variant="outline"
                  className={optionBtnClass}
                  disabled={sending}
                  onClick={() => void sendTurn({ action: c.id })}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            className={limbiPrimaryButtonClass}
            disabled={sending || !answer.trim()}
            onClick={() => void sendTurn({ text: answer })}
          >
            {sending ? "Enviando…" : "Enviar respuesta"}
          </Button>
        </CardFooter>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href={`/projects/new?projectId=${encodeURIComponent(projectId!)}`}>
          Cambiar al cuestionario clásico
        </Link>
      </p>
    </div>
  );
}
