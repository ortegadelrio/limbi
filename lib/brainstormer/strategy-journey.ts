/**
 * Journey estratégico de sesión — orienta el nivel de respuesta antes que tácticas.
 */

import type { ThinkingModelKey } from "@/lib/ai/thinking-models";
import type {
  BrainstormerTurnIntent,
  BrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { z } from "zod";

export const brainstormerStrategyStageSchema = z.enum([
  "challenge_open",
  "challenge_defined",
  "concept_needed",
  "concept_proposed",
  "concept_confirmed",
  "campaign_mechanism_needed",
  "campaign_mechanism_defined",
  "stages_needed",
  "conversion_needed",
  "ready_for_project",
]);

export type BrainstormerStrategyStage = z.infer<typeof brainstormerStrategyStageSchema>;

const STAGE_RANK: Record<BrainstormerStrategyStage, number> = {
  challenge_open: 0,
  challenge_defined: 1,
  concept_needed: 2,
  concept_proposed: 3,
  concept_confirmed: 4,
  campaign_mechanism_needed: 5,
  campaign_mechanism_defined: 6,
  stages_needed: 7,
  conversion_needed: 8,
  ready_for_project: 9,
};

/** Tácticas que no deben dominar antes de concept_confirmed. */
export const PREMATURE_TACTIC_DOMINANCE_PATTERNS: readonly RegExp[] = [
  /\bevento(s)?\b/i,
  /\bteasers?\b/i,
  /\binfluencers?\b/i,
  /\bcalendario\b/i,
  /\bpauta\b/i,
  /\blanding\b/i,
  /\bugc\b/i,
  /\bhashtag(s)?\b/i,
  /\bpiezas?\b/i,
  /\bpublicaciones?\s+en\s+redes\b/i,
  /\bplan\s+de\s+contenidos?\b/i,
  /\bcontenidos?\s+interactivos?\b/i,
  /\bactivaci[oó]n\s+en\s+redes\b/i,
  /\blanzamiento\s+con\s+evento\b/i,
];

const CONCEPTUAL_LEVEL_CORRECTION_PATTERNS: RegExp[] = [
  /\bpero\s+sin\s+concepto\b/,
  /\bsin\s+concepto\s+creativ/,
  /\beso(s)?\s+son\s+t[aá]ctic/,
  /\bson\s+s[oó]lo\s+t[aá]ctic/,
  /\beso\s+es\s+t[aá]ctic/,
  /\bnecesito\s+el\s+(concepto|paraguas|mensaje|idea)\b/,
  /\bprimero\s+definamos\s+(el\s+)?(mensaje|concepto|idea)\b/,
  /\bfalta\s+el\s+(concepto|paraguas|mensaje|eje)\b/,
  /\bno\s+me\s+diste\s+(el\s+)?paraguas\b/,
  /\bno\s+me\s+diste\s+paraguas\b/,
  /\beso\s+est[aá]\s+muy\s+operativ/,
  /\bmuy\s+operativ/,
  /\bbajaste\s+a\s+t[aá]ctic/,
  /\bme\s+fui\s+a\s+t[aá]ctic/,
  /\bantes\s+del\s+concepto\b/,
  /\bantes\s+de\s+concepto\b/,
  /\bno\s+es\s+el\s+concepto\b/,
  /\beso\s+no\s+es\s+el\s+paraguas\b/,
  /\bsubir\s+al\s+(concepto|paraguas|nivel\s+conceptual)\b/,
];

const CHALLENGE_CONTEXT_PATTERNS: RegExp[] = [
  /\bquiero\s+lanzar\b/,
  /\blanzar\s+la\s+marca\b/,
  /\blanzar\s+marca\b/,
  /\bmarca\s+nueva\b/,
  /\bporque\s+es\s+nueva\b/,
  /\borganizar\s+el\s+lanzamiento\b/,
  /\blanzamiento\s+de\s+marca\b/,
  /\bquiero\s+organizar\b/,
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function hasAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((p) => p.test(normalize(text)));
}

function countMatches(text: string, patterns: readonly RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

export function isConceptualLevelCorrection(
  userMessage: string,
  conversationExcerpt = "",
): boolean {
  const t = normalize(userMessage);
  if (hasAny(t, CONCEPTUAL_LEVEL_CORRECTION_PATTERNS)) return true;
  if (
    hasAny(normalize(conversationExcerpt), CONCEPTUAL_LEVEL_CORRECTION_PATTERNS) &&
    hasAny(t, [/concepto|paraguas|mensaje|idea|t[aá]ctic|operativ/])
  ) {
    return true;
  }
  return false;
}

/** Mensaje de contexto de reto (no es paraguas conceptual). */
export function isChallengeContextPhrase(phrase: string): boolean {
  const t = normalize(phrase);
  if (hasAny(t, CHALLENGE_CONTEXT_PATTERNS)) return true;
  if (/\bporque\s+es\s+nueva\b/.test(t) && /\blanzar|marca\b/.test(t)) return true;
  return false;
}

export function isBeforeConceptConfirmed(stage: BrainstormerStrategyStage): boolean {
  return STAGE_RANK[stage] < STAGE_RANK.concept_confirmed;
}

export function maxStrategyStage(
  a: BrainstormerStrategyStage,
  b: BrainstormerStrategyStage,
): BrainstormerStrategyStage {
  return STAGE_RANK[a] >= STAGE_RANK[b] ? a : b;
}

export function coerceStrategyStage(raw: unknown): BrainstormerStrategyStage {
  const parsed = brainstormerStrategyStageSchema.safeParse(raw);
  return parsed.success ? parsed.data : "challenge_open";
}

export function resolveStrategyStage(args: {
  prior: BrainstormerStrategyStage;
  brief: BrainstormerWorkingBrief;
  userMessage: string;
  turnIntent: BrainstormerTurnIntent;
  conversationExcerpt?: string;
}): BrainstormerStrategyStage {
  const corpus = `${args.conversationExcerpt ?? ""}\n${args.userMessage}`;
  let stage = args.prior;

  if (args.brief.confirmed_conceptual_umbrella.trim()) {
    stage = maxStrategyStage(stage, "concept_confirmed");
  }

  if (
    isConceptualLevelCorrection(args.userMessage, args.conversationExcerpt ?? "") &&
    !args.brief.confirmed_conceptual_umbrella.trim()
  ) {
    stage = maxStrategyStage(stage, "concept_needed");
  }

  if (
    args.turnIntent === "conceptual_level_correction" ||
    args.turnIntent === "conceptual_strategy_request" ||
    args.turnIntent === "strategic_concept"
  ) {
    if (!args.brief.confirmed_conceptual_umbrella.trim()) {
      stage = maxStrategyStage(stage, "concept_needed");
    }
  }

  if (
    args.turnIntent === "launch_strategy" ||
    hasAny(corpus, CHALLENGE_CONTEXT_PATTERNS) ||
    args.brief.strategic_moment === "launch"
  ) {
    stage = maxStrategyStage(stage, "challenge_defined");
    if (!args.brief.confirmed_conceptual_umbrella.trim()) {
      stage = maxStrategyStage(stage, "concept_needed");
    }
  }

  if (
    args.turnIntent === "campaign_expectation" ||
    args.turnIntent === "campaign_stage_inquiry"
  ) {
    if (args.brief.confirmed_conceptual_umbrella.trim()) {
      stage = maxStrategyStage(stage, "campaign_mechanism_needed");
    } else {
      stage = maxStrategyStage(stage, "concept_needed");
    }
  }

  if (args.turnIntent === "conversion_bridge") {
    stage = maxStrategyStage(stage, "conversion_needed");
  }

  if (args.turnIntent === "next_step" && args.brief.confirmed_conceptual_umbrella.trim()) {
    stage = maxStrategyStage(stage, "stages_needed");
  }

  return stage;
}

export function responseHasPrematureTacticDominance(
  message: string,
  stage: BrainstormerStrategyStage,
  hasConfirmedUmbrella: boolean,
): boolean {
  if (hasConfirmedUmbrella || !isBeforeConceptConfirmed(stage)) return false;
  const tacticHits = countMatches(message, PREMATURE_TACTIC_DOMINANCE_PATTERNS);
  const proposesConcept =
    /\bparaguas\b/i.test(message) &&
    (/\bmi\s+paraguas\b/i.test(message) ||
      /\bidea\s+rectora\b/i.test(message) ||
      /\bese\s+es\s+el\s+paraguas\b/i.test(message) ||
      /«[^»]{6,}»/.test(message));
  if (proposesConcept && tacticHits <= 2) return false;
  return tacticHits >= 2;
}

export function buildThinkingModelConceptJourneyHint(
  thinkingKey: ThinkingModelKey | null | undefined,
): string {
  switch (thinkingKey) {
    case "explorer":
      return " Desde ruptura/ironía/deseo inesperado: una idea rectora con filo, no tácticas.";
    case "commercial":
      return " Desde conversión: paraguas que pueda llevar a producto real, landing y compra — sin bajar a piezas aún.";
    case "architect":
      return " Desde arquitectura: ordenar el journey; primero paraguas, luego secuencia de etapas.";
    case "empathic":
      return " Desde audiencia: barrera y motivación humana como base del paraguas — no canales ni piezas.";
    case "symbolic":
      return " Desde territorio narrativo/metáfora: universo verbal que sostenga la campaña — no ejecutables.";
    default:
      return " Una sola idea rectora con postura antes de tácticas.";
  }
}

export function buildConceptNeededObligation(args: {
  userMessage: string;
  thinkingKey: ThinkingModelKey | null | undefined;
}): string {
  const contextNote = isChallengeContextPhrase(args.userMessage)
    ? " El mensaje del usuario es contexto de reto (lanzamiento/marca nueva), NO es paraguas conceptual."
    : "";
  return (
    "Antes de piezas, eventos, influencers, calendario, pauta, landing, UGC, hashtags o tácticas: cerrar el paraguas conceptual. " +
    "Proponer UNA idea rectora con postura y por qué funciona; no menú de opciones ni lista de acciones." +
    contextNote +
    buildThinkingModelConceptJourneyHint(args.thinkingKey)
  );
}

export function buildConceptualLevelCorrectionObligation(args: {
  userMessage: string;
  thinkingKey: ThinkingModelKey | null | undefined;
}): string {
  return (
    "Reconocer que se bajó demasiado rápido a tácticas; no defender la respuesta anterior; " +
    "no tratar mensajes operativos del hilo como paraguas confirmado. " +
    "Volver al nivel conceptual: admitir la corrección y proponer o conducir a UNA idea rectora con postura." +
    buildThinkingModelConceptJourneyHint(args.thinkingKey) +
    (isChallengeContextPhrase(args.userMessage)
      ? ""
      : " Si citan contexto previo («lanzar porque es nueva»), dejar claro que es contexto, no concepto.")
  );
}
