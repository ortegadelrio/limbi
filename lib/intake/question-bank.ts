import type { challengeTypeSchema } from "@/lib/schemas/project";
import type { z } from "zod";

type ChallengeType = z.infer<typeof challengeTypeSchema>;

const DEFAULT_MAIN =
  "¿Qué estás ofreciendo y qué problema o situación ayuda a resolver?";

const BY_CHALLENGE: Partial<Record<ChallengeType, string>> = {
  brand:
    "¿Qué ofrece esta marca y qué problema o tensión de percepción ayuda a resolver para las personas a las que importa?",
  product:
    "¿Qué producto ofreces y qué fricción o necesidad concreta alivia para quien lo usa?",
  service:
    "¿Qué servicio entregas y qué resultado o alivio busca obtener quien lo contrata?",
  event:
    "¿Qué experiencia convoca este evento y qué cambio o valor busca quien asiste?",
  personal_brand:
    "¿Qué ofrece esta marca personal y qué problema o oportunidad ayuda a resolver a tu comunidad o cliente?",
  project_venture:
    "¿Qué propuesta lleva este proyecto y qué problema o situación está resolviendo para su audiencia?",
  corporate_communication:
    "¿Qué comunica esta organización en esta pieza y qué problema interno o externo ordena o aclara?",
};

export function pilotMainQuestionText(
  challengeType: string | null,
): string {
  if (!challengeType) return DEFAULT_MAIN;
  const specific = BY_CHALLENGE[challengeType as ChallengeType];
  return specific ?? DEFAULT_MAIN;
}

export const PILOT_ESCAPE_CHIPS = [
  { id: "no_info" as const, label: "No tengo esta información todavía" },
  { id: "improve_later" as const, label: "Lo puedo mejorar después" },
  { id: "continue_base" as const, label: "Continuar con esta base" },
];

export type PilotEscapeChipId = (typeof PILOT_ESCAPE_CHIPS)[number]["id"];
