import { challengeTypeSchema } from "@/lib/schemas/project";
import type { z } from "zod";

type ChallengeType = z.infer<typeof challengeTypeSchema>;

/** Canonical mini journey before summary (stored in trace.mini_step). */
export const GUIDED_MINI_STEPS = [
  "challenge_type",
  "tailored_what",
  "problem",
  "transformation",
  "audience",
  "evidence",
  "complete",
] as const;

export type GuidedMiniStepId = (typeof GUIDED_MINI_STEPS)[number];

export function nextMiniStep(
  current: GuidedMiniStepId,
): GuidedMiniStepId | null {
  const i = GUIDED_MINI_STEPS.indexOf(current);
  if (i < 0 || i >= GUIDED_MINI_STEPS.length - 1) return null;
  return GUIDED_MINI_STEPS[i + 1]!;
}

/** UI labels → DB `projects.challenge_type` (except Otro → null + other flag). */
export const GUIDED_CHALLENGE_PICKS = [
  { pick: "product" as const, label: "Producto" },
  { pick: "service" as const, label: "Servicio" },
  { pick: "brand" as const, label: "Marca" },
  { pick: "event" as const, label: "Evento" },
  { pick: "project_venture" as const, label: "Proyecto social" },
  {
    pick: "corporate_communication" as const,
    label: "Comunicación corporativa",
  },
  { pick: "personal_brand" as const, label: "Marca personal" },
  { pick: "other" as const, label: "Otro" },
] as const;

export type GuidedChallengePick =
  (typeof GUIDED_CHALLENGE_PICKS)[number]["pick"];

export function parseGuidedChallengePick(
  raw: string,
): GuidedChallengePick | null {
  const hit = GUIDED_CHALLENGE_PICKS.find((p) => p.pick === raw);
  return hit?.pick ?? null;
}

/** Tailored question for step C (after challenge type is known). */
export function tailoredWhatQuestion(
  challengeType: string | null,
  otherChallenge: boolean,
): string {
  if (otherChallenge || !challengeType) {
    return "Cuéntame qué quieres trabajar y qué necesitas comunicar mejor.";
  }
  switch (challengeType as ChallengeType) {
    case "service":
      return "¿Qué ofrece este servicio y qué problema o situación ayuda a resolver?";
    case "product":
      return "¿Qué es este producto y qué necesidad, deseo o problema ayuda a resolver?";
    case "brand":
      return "¿Qué representa esta marca y qué percepción necesita construir o cambiar?";
    case "event":
      return "¿Qué tipo de evento es y qué experiencia o conversación busca activar?";
    case "project_venture":
      return "¿Qué situación social busca atender y a quién necesita beneficiar o movilizar?";
    case "corporate_communication":
      return "¿Qué percepción, mensaje o situación necesita aclarar, fortalecer o transformar?";
    case "personal_brand":
      return "¿Qué quieres que la gente entienda de ti y desde qué experiencia o punto de vista?";
    default:
      return "Cuéntame qué quieres trabajar y qué necesitas comunicar mejor.";
  }
}

export const GUIDED_QUESTION_PROBLEM =
  "¿Qué situación, fricción o necesidad concreta está en el centro de este reto?";

export const GUIDED_QUESTION_TRANSFORMATION =
  "¿Qué cambio, resultado o beneficio buscas que la gente sienta o logre cuando esto funciona bien?";

export const GUIDED_QUESTION_AUDIENCE =
  "A veces hay varios actores (por ejemplo quien vive la experiencia vs quien autoriza o paga). ¿A quién debe convencer primero la comunicación hoy, y quiénes son decisores o vetos clave además?";

export const GUIDED_QUESTION_EVIDENCE =
  "¿Qué evidencia o pruebas reales tienes hoy? Si aún no hay claridad, dilo con franqueza: Limbi lo usará para no prometer de más.";

export function questionForMiniStep(
  step: GuidedMiniStepId,
  challengeType: string | null,
  otherChallenge: boolean,
): string | null {
  switch (step) {
    case "challenge_type":
      return "¿Qué tipo de reto quieres trabajar?";
    case "tailored_what":
      return tailoredWhatQuestion(challengeType, otherChallenge);
    case "problem":
      return GUIDED_QUESTION_PROBLEM;
    case "transformation":
      return GUIDED_QUESTION_TRANSFORMATION;
    case "audience":
      return GUIDED_QUESTION_AUDIENCE;
    case "evidence":
      return GUIDED_QUESTION_EVIDENCE;
    default:
      return null;
  }
}
