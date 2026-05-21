/**
 * Brainstormer Conversation Contract — disciplina transversal para todos los modelos de pensamiento.
 * Acumula brief vivo, restricciones y obligación de respuesta por turno.
 */

import { z } from "zod";
import type { ThinkingModelKey } from "@/lib/ai/thinking-models";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";
import {
  NATURAL_PROSE_TONE_HINT,
  userSeeksFeedbackOnProposedConcept,
} from "@/lib/brainstormer/brainstormer-natural-voice";
import { applyTurnInterpretationToWorkingBrief } from "@/lib/brainstormer/apply-turn-interpretation";
import {
  isExternalResearchRequest,
  isProjectHandoffRequest,
} from "@/lib/brainstormer/special-turn-detectors";
import { buildContractPayloadFromInterpretation } from "@/lib/brainstormer/build-contract-from-interpretation";
import type { BrainstormerTurnInterpretation } from "@/lib/brainstormer/turn-interpreter";
import { interpretBrainstormerTurnDeterministic } from "@/lib/brainstormer/turn-interpreter";
import {
  CONVERSION_BRIDGE_TEMPLATE_ES,
  inferCampaignStageFromContext,
  isAudienceStrategyRequest,
  isConceptRejectionOrAlternativeRequest,
  isConversionBridgeRequest,
  isSketchOrFakeProductContext,
  isUserConfusionPhrase,
  userExplicitlyRequestsNewOptions,
  type BrainstormerCampaignStage,
} from "@/lib/brainstormer/working-brief-memory";
import {
  brainstormerStrategyStageSchema,
  isConceptualLevelCorrection,
  type BrainstormerStrategyStage,
} from "@/lib/brainstormer/strategy-journey";

export const BRAINSTORMER_CONVERSATION_CONTRACT_VERSION = "v3" as const;

export const brainstormerCampaignStageSchema = z.enum([
  "unknown",
  "expectativa",
  "prelanzamiento",
  "lanzamiento",
  "conversion",
  "sostenimiento",
]);

export type { BrainstormerCampaignStage };
export type { BrainstormerStrategyStage };

export const brainstormerTurnIntentSchema = z.enum([
  "explore_idea",
  /** @deprecated Preferir conceptual_strategy_request; se mantiene en datos históricos. */
  "strategic_concept",
  "conceptual_strategy_request",
  "conceptual_level_correction",
  "user_confusion",
  "launch_strategy",
  "campaign_expectation",
  "next_step",
  "critique",
  "options",
  "deliverable_piece",
  "adjust_proposal",
  "reject_route",
  "tactical_grounding",
  "delegate_to_limbi",
  "campaign_stage_inquiry",
  "conversion_bridge",
  "audience_strategy_request",
  "concept_rejection_or_alternative_request",
  "external_research_request",
  "project_handoff_request",
  "general",
]);

export type BrainstormerTurnIntent = z.infer<typeof brainstormerTurnIntentSchema>;

export const brainstormerStrategicMomentSchema = z.enum([
  "unknown",
  "launch",
  "relaunch",
  "repositioning",
  "positioning_reinforcement",
  "conversion",
  "maintenance",
  "activation",
  "recall",
]);

export type BrainstormerStrategicMoment = z.infer<typeof brainstormerStrategicMomentSchema>;

export const brainstormerWorkingBriefSchema = z.object({
  contract_version: z.literal(BRAINSTORMER_CONVERSATION_CONTRACT_VERSION).default("v3"),
  strategic_moment: brainstormerStrategicMomentSchema.default("unknown"),
  current_request_type: brainstormerTurnIntentSchema.default("general"),
  active_constraints: z.array(z.string().max(400)).max(32).default([]),
  user_corrections: z.array(z.string().max(600)).max(24).default([]),
  rejected_paths: z.array(z.string().max(600)).max(20).default([]),
  approved_signals: z.array(z.string().max(600)).max(20).default([]),
  open_decisions: z.array(z.string().max(600)).max(16).default([]),
  next_best_step: z.string().max(1200).default(""),
  confirmed_decisions: z.array(z.string().max(400)).max(16).default([]),
  confirmed_conceptual_umbrella: z.string().max(600).default(""),
  campaign_stage: brainstormerCampaignStageSchema.default("unknown"),
  conversion_bridge: z.string().max(800).default(""),
  strategy_stage: brainstormerStrategyStageSchema.default("challenge_open"),
});

export type BrainstormerWorkingBrief = z.infer<typeof brainstormerWorkingBriefSchema>;

export type BrainstormerConversationContractTurn = {
  turn_intent: BrainstormerTurnIntent;
  brief: BrainstormerWorkingBrief;
  response_obligation: string;
  /** Hint corto para DELIVER en prompt creativo cuando el turno viene del intérprete. */
  prompt_deliver_hint?: string;
  forbidden_response_patterns: string[];
  /** Pregunta de cierre solo cuando ayuda a decidir entre opciones ya nombradas. */
  effective_closing_question: string | null;
  include_closing_question: boolean;
  user_delegated_decision: boolean;
};

const GENERIC_CLOSING_PATTERNS: RegExp[] = [
  /\bqu[eé]\s+opinas\b/i,
  /\bqu[eé]\s+te\s+parece\b/i,
  /\bqu[eé]\s+otros?\s+elementos?\b/i,
  /\bte\s+gusta\s+esta\s+idea\b/i,
  /\bqu[eé]\s+considerar[ií]as\b/i,
  /\bqu[eé]\s+m[aá]s\s+agregar[ií]as\b/i,
  /\bte\s+resulta\s+[uú]til\b/i,
];

const TACTIC_LEAK_PATTERNS: RegExp[] = [
  /\bhashtag(s)?\b/i,
  /\bcalendario\s+editorial\b/i,
  /\bplan\s+de\s+contenidos?\b/i,
  /\bguion(es)?\b/i,
  /\bstoryboard\b/i,
  /\bpauta\s+digital\b/i,
];

/** Tácticas genéricas prohibidas como respuesta principal sin paraguas previo. */
export const GENERIC_TACTIC_PATTERNS: RegExp[] = [
  /\bteasers?\s+visuales?\b/i,
  /\binfluencers?\b/i,
  /\bcontenidos?\s+interactivos?\b/i,
  /\bcalendario\s+de\s+publicaciones?\b/i,
  /\bpublicaciones?\s+en\s+redes\b/i,
];

const MATERIAL_REQUEST_CLOSING_PATTERNS: RegExp[] = [
  /\bsub(e|ir)\b/i,
  /\badjunt/i,
  /\bpega(r)?\s+aqui\b/i,
  /\barchivo\b/i,
  /\bbrief\b/i,
  /\bword\b/i,
  /\bpdf\b/i,
  /\bcontenido\s+base\b/i,
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  const n = normalize(text);
  return patterns.some((p) => p.test(n));
}

export function emptyBrainstormerWorkingBrief(): BrainstormerWorkingBrief {
  return brainstormerWorkingBriefSchema.parse({});
}

export function coerceBrainstormerWorkingBrief(raw: unknown): BrainstormerWorkingBrief {
  const parsed = brainstormerWorkingBriefSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const legacy = raw as Record<string, unknown>;
    if (legacy.contract_version === "v1" || legacy.contract_version === "v2") {
      const migrated = brainstormerWorkingBriefSchema.safeParse({
        ...legacy,
        contract_version: "v3",
        confirmed_decisions: legacy.confirmed_decisions ?? [],
        confirmed_conceptual_umbrella: legacy.confirmed_conceptual_umbrella ?? "",
        campaign_stage: legacy.campaign_stage ?? "unknown",
        conversion_bridge: legacy.conversion_bridge ?? "",
        strategy_stage: legacy.strategy_stage ?? "challenge_open",
      });
      if (migrated.success) return migrated.data;
    }
  }
  return emptyBrainstormerWorkingBrief();
}

export function extractWorkingBriefFromProgress(progress: {
  working_brief?: unknown;
}): BrainstormerWorkingBrief {
  return coerceBrainstormerWorkingBrief(progress.working_brief);
}

/** Patrones de pedido de idea rectora / paraguas / mensaje conector (sin depender de una sola frase). */
const CONCEPTUAL_STRATEGY_REQUEST_PATTERNS: RegExp[] = [
  /\bconcepto(s)?\s+(rector|estrat[eé]gic|creativ)/,
  /\bparaguas(\s+conceptual)?\b/,
  /\bidea\s+madre\b/,
  /\bgran\s+idea\b/,
  /\bclaim\s+rector\b/,
  /\bl[ií]nea\s+conceptual\b/,
  /\bconcepto\s+creativo\b/,
  /\bterritorio(s)?\s+creativ/,
  /\beje\s+de\s+campa[nñ]a\b/,
  /\bidea\s+fuerza\b/,
  /\bterritorio(s)?\s+narrativ/,
  /\beje\s+narrativo\b/,
  /\buniverso\s+verbal\b/,
  /\bmensaje\s+(general|central|conector|rector|madre)\b/,
  /\bmensaje\s+que\s+(conect|amarre|ordene)/,
  /\bdefinir\s+un\s+mensaje\b/,
  /\bdefinir\s+(el\s+)?mensaje\b/,
  /\bfrase\s+que\s+ordena\b/,
  /\bfrase\s+potente\b/,
  /\bidea\s+que\s+conect/,
  /\bconcepto\s+que\s+amarre/,
  /\bconect(a|ar|e|en)\s+todo\b/,
  /\bconector\s+de\s+(toda\s+)?la\s+campa/,
  /\bcamino\s+creativo\b/,
  /\barticulamos\s+la\s+campa/,
  /\bcomo\s+articulamos\b/,
  /\bbajo\s+qu[eé]\s+idea\b/,
  /\bqu[eé]\s+concepto\s+usamos\b/,
  /\bprimero\s+definamos\s+(la\s+)?(idea|mensaje|concepto)\b/,
  /\bantes\s+de\s+bajar\s+a\s+t[aá]ctic/,
  /\bno\s+bajar\s+a\s+t[aá]ctic/,
  /\bnivel\s+conceptual\b/,
  /\bqu[eé]\s+frase\s+ordena\b/,
  /\bcual\s+es\s+el\s+mensaje\s+que\b/,
];

const CONCEPTUAL_STRATEGY_CORRECTION_PATTERNS: RegExp[] = [
  /\beso(s)?\s+son\s+t[aá]ctic/,
  /\bson\s+s[oó]lo\s+t[aá]ctic/,
  /\beso\s+es\s+t[aá]ctic/,
  /\bnecesito\s+el\s+(concepto|paraguas|mensaje|idea)\b/,
  /\bcu[aá]l\s+es\s+el\s+concepto\b/,
  /\bprimero\s+definamos\s+(el\s+)?(mensaje|concepto|idea)\b/,
  /\best[aá]\s+muy\s+gen[eé]ric/,
  /\bmuy\s+gen[eé]ric/,
  /\bno\s+me\s+est[aá]s?\s+dando\s+la\s+idea\b/,
  /\bidea\s+central\b/,
  /\bfalta\s+el\s+(concepto|paraguas|mensaje|eje)\b/,
  /\bbajaste\s+a\s+t[aá]ctic/,
  /\bsubir\s+al\s+(concepto|paraguas|nivel\s+conceptual)\b/,
  /\bno\s+es\s+el\s+concepto\b/,
  /\beso\s+no\s+es\s+el\s+paraguas\b/,
];

function isConceptualStrategyRequest(
  userMessage: string,
  conversationExcerpt = "",
): boolean {
  const t = normalize(userMessage);
  const excerpt = normalize(conversationExcerpt);

  if (
    hasAny(t, [/\bguion\b/, /\bcalendario\s+editorial\b/, /\bhashtag(s)?\b/, /\bcopy\b/, /\bstoryboard\b/])
  ) {
    return false;
  }

  if (hasAny(t, CONCEPTUAL_STRATEGY_REQUEST_PATTERNS)) return true;
  if (hasAny(t, CONCEPTUAL_STRATEGY_CORRECTION_PATTERNS)) return true;
  if (userSeeksFeedbackOnProposedConcept(userMessage)) return true;

  if (
    hasAny(t, [
      /no sab[ií]as/,
      /cu[aá]l ser[ií]a el paraguas/,
      /estaba pensando/,
    ])
  ) {
    return true;
  }

  if (
    hasAny(excerpt, CONCEPTUAL_STRATEGY_CORRECTION_PATTERNS) &&
    hasAny(t, [/concepto|paraguas|mensaje|idea|gen[eé]ric|t[aá]ctic/])
  ) {
    return true;
  }

  return false;
}

/** Clasifica la intención dominante del último mensaje (usa excerpt para correcciones de nivel). */
export function classifyBrainstormerTurnIntent(
  userMessage: string,
  conversationExcerpt = "",
): BrainstormerTurnIntent {
  const t = normalize(userMessage);

  if (isProjectHandoffRequest(userMessage)) {
    return "project_handoff_request";
  }

  if (isExternalResearchRequest(userMessage)) {
    return "external_research_request";
  }

  if (isUserConfusionPhrase(userMessage)) {
    return "user_confusion";
  }

  if (isConceptRejectionOrAlternativeRequest(userMessage)) {
    return "concept_rejection_or_alternative_request";
  }

  if (
    hasAny(t, [
      /\bdime tu\b/,
      /\bdecide tu\b/,
      /\bdecidelo tu\b/,
      /\bque recomiendas\b/,
      /\bcomo lo llevarias tu\b/,
      /\belige tu\b/,
      /\bpropon tu\b/,
    ])
  ) {
    return "delegate_to_limbi";
  }

  if (
    hasAny(t, [
      /\brechaz/,
      /\bno me convence\b/,
      /\bno por ahi\b/,
      /\bdescartemos\b/,
      /\bme parece aburrid/,
      /\bmuy aburrid/,
      /\bno funcion/,
      /\bno me gusta\b/,
      /\beso no\b/,
    ])
  ) {
    return "reject_route";
  }

  if (
    hasAny(t, [
      /\bcampana de expectativa\b/,
      /\bexpectativa antes\b/,
      /\bantes del lanzamiento\b/,
      /\bprelanzamiento\b/,
      /\bfase de expectativa\b/,
      /\bdeberiamos hacer una campana de expectativa\b/,
    ])
  ) {
    return "campaign_expectation";
  }

  if (isConceptualLevelCorrection(userMessage, conversationExcerpt)) {
    return "conceptual_level_correction";
  }

  if (isAudienceStrategyRequest(userMessage)) {
    return "audience_strategy_request";
  }

  if (isConceptualStrategyRequest(userMessage, conversationExcerpt)) {
    return "conceptual_strategy_request";
  }

  if (
    hasAny(t, [
      /\blanzar la marca\b/,
      /\blanzar marca\b/,
      /\blanzamiento de marca\b/,
      /\bquiero lanzar\b/,
      /\bmarca\s+nueva\b/,
      /\bporque\s+es\s+nueva\b/,
    ])
  ) {
    return "launch_strategy";
  }

  if (
    hasAny(t, [
      /\bque\s+etapa\b/,
      /\bcual\s+etapa\b/,
      /\bcu[aá]l\s+etapa\b/,
      /\betapa\s+de\s+campana\b/,
      /\ben\s+que\s+fase\b/,
      /\besto\s+que\s+etapa\b/,
    ])
  ) {
    return "campaign_stage_inquiry";
  }

  if (isConversionBridgeRequest(userMessage)) {
    return "conversion_bridge";
  }

  if (
    hasAny(t, [
      /\bsiguiente paso\b/,
      /\bque sigue\b/,
      /\bpor donde seguimos\b/,
      /\bproximo paso\b/,
      /\bque hacemos ahora\b/,
      /\bcual\s+es\s+la\s+ruta\b/,
      /\bruta\s+a\s+seguir\b/,
    ])
  ) {
    return "next_step";
  }

  if (hasAny(t, [/\bopciones\b/, /\balternativas\b/, /\brutas posibles\b/, /\bcomparar\b/])) {
    return "options";
  }

  if (
    hasAny(t, [
      /\bcritica\b/,
      /\bque te parece\b/,
      /\brevisa\b/,
      /\bfeedback\b/,
      /\bevalua\b/,
      /\bque opinas\b/,
    ])
  ) {
    return "critique";
  }

  if (
    hasAny(t, [
      /\bguion\b/,
      /\bcopy\b/,
      /\bcalendario\b/,
      /\bhashtag\b/,
      /\blanding\b/,
      /\bpauta\b/,
      /\bpieza\b/,
      /\bpost\b/,
      /\bcaption\b/,
      /\bscript\b/,
    ])
  ) {
    return "deliverable_piece";
  }

  if (
    hasAny(t, [
      /\btactica(s)?\b/,
      /\bcanal(es)?\b/,
      /\bmedios\b/,
      /\bformato(s)?\b/,
      /\bejecucion\b/,
      /\bimplementacion\b/,
    ])
  ) {
    return "tactical_grounding";
  }

  if (
    hasAny(t, [
      /\bdeben ser\b/,
      /\bdebe ser\b/,
      /\btienen que\b/,
      /\bteneis que\b/,
      /\bcon mas\b/,
      /\bcon menos\b/,
      /\bsin caer\b/,
      /\bno tan\b/,
      /\bmas conceptual\b/,
      /\bmenos tecnico\b/,
      /\bajust/,
      /\bcorrig/,
      /\brefin/,
      /\bposiblemente reales\b/,
      /\bcon picard/i,
    ])
  ) {
    return "adjust_proposal";
  }

  if (hasAny(t, [/\bexplor/, /\bideas?\b/, /\bbrainstorm/, /\bque podriamos\b/])) {
    return "explore_idea";
  }

  return "general";
}

function detectStrategicMoment(text: string): BrainstormerStrategicMoment {
  const t = normalize(text);
  if (
    hasAny(t, [
      /\blanzamiento\b/,
      /\blanzar\b/,
      /\bprelanzamiento\b/,
      /\blanzar la marca\b/,
      /\blanzar marca\b/,
      /\bquiero lanzar\b/,
    ])
  ) {
    return "launch";
  }
  if (hasAny(t, [/\bre lanzamiento\b/, /\brelaunch\b/])) return "relaunch";
  if (hasAny(t, [/\breposicion/])) return "repositioning";
  if (hasAny(t, [/\breforzar posicion/])) return "positioning_reinforcement";
  if (hasAny(t, [/\bconversion\b/, /\bconvertir\b/, /\bvender mas\b/])) return "conversion";
  if (hasAny(t, [/\bmantenimiento\b/, /\bsostener\b/])) return "maintenance";
  if (hasAny(t, [/\bactivacion\b/])) return "activation";
  if (hasAny(t, [/\brecordacion\b/, /\brecall\b/, /\btop of mind\b/])) return "recall";
  return "unknown";
}

function uniquePush(list: string[], item: string, max: number): string[] {
  const trimmed = item.trim();
  if (!trimmed) return list;
  const norm = trimmed.toLowerCase();
  if (list.some((x) => x.toLowerCase() === norm || x.toLowerCase().includes(norm))) return list;
  return [...list, trimmed].slice(-max);
}

function extractConstraintsFromMessage(userMessage: string): string[] {
  const found: string[] = [];
  const raw = userMessage.trim();
  if (!raw) return found;

  const patterns: { re: RegExp; label?: string }[] = [
    { re: /\bposiblemente reales?\b/gi },
    { re: /\bcon picard[ií]a\b/gi },
    { re: /\bno tan aburrid[oa]s?\b/gi },
    { re: /\bmenos t[eé]cnic[oa]s?\b/gi },
    { re: /\bm[aá]s conceptual(es)?\b/gi },
    { re: /\bsin caer en estereotipos\b/gi },
    { re: /\bsin estereotipos\b/gi },
    { re: /\bdeben ser ([^.!?\n]{4,80})/gi },
    { re: /\btienen que ([^.!?\n]{4,80})/gi },
    { re: /\bdebe(n)? tener ([^.!?\n]{4,80})/gi },
    { re: /\bcon m[aá]s ([^.!?\n]{3,60})/gi },
    { re: /\bcon menos ([^.!?\n]{3,60})/gi },
    { re: /\bsin ([^.!?\n]{4,60})/gi },
  ];

  for (const { re } of patterns) {
    const matches = raw.matchAll(re);
    for (const m of matches) {
      const phrase = (m[0] ?? "").trim();
      if (phrase.length >= 4) found.push(phrase);
    }
  }

  return found;
}

function extractApprovedSignal(userMessage: string): string | null {
  const t = normalize(userMessage);
  if (
    hasAny(t, [
      /\bme gusta\b/,
      /\bme convence\b/,
      /\bpor ahi si\b/,
      /\beso si\b/,
      /\baprob/,
      /\bquedemonos con\b/,
      /\bese eje\b/,
    ])
  ) {
    const trimmed = userMessage.trim();
    return trimmed.length > 400 ? `${trimmed.slice(0, 397)}…` : trimmed;
  }
  return null;
}

/** Tipos de pedido en fase de ideación estratégica (no pedir archivo como cierre). */
export function isIdeationRequestType(intent: BrainstormerTurnIntent): boolean {
  return (
    intent === "explore_idea" ||
    intent === "strategic_concept" ||
    intent === "conceptual_strategy_request" ||
    intent === "conceptual_level_correction" ||
    intent === "audience_strategy_request" ||
    intent === "concept_rejection_or_alternative_request" ||
    intent === "launch_strategy" ||
    intent === "campaign_expectation" ||
    intent === "options" ||
    intent === "next_step" ||
    intent === "delegate_to_limbi" ||
    intent === "reject_route" ||
    intent === "adjust_proposal"
  );
}

export function isMaterialRequestClosingQuestion(question: string): boolean {
  const q = question.trim();
  if (q.length < 8) return false;
  return MATERIAL_REQUEST_CLOSING_PATTERNS.some((p) => p.test(q));
}

function intentLabel(intent: BrainstormerTurnIntent): string {
  const map: Record<BrainstormerTurnIntent, string> = {
    explore_idea: "explorar idea",
    strategic_concept: "pedir concepto estratégico / paraguas conceptual",
    conceptual_strategy_request: "pedir idea rectora / paraguas / mensaje conector de campaña",
    conceptual_level_correction: "corregir nivel: volver a concepto antes de tácticas",
    user_confusion: "usuario no entiende — aclarar en lenguaje simple",
    launch_strategy: "estrategia de lanzamiento de marca",
    campaign_expectation: "campaña de expectativa / prelanzamiento",
    next_step: "pedir siguiente paso",
    critique: "pedir crítica",
    options: "pedir opciones",
    deliverable_piece: "pedir pieza / guion / copy",
    adjust_proposal: "ajustar propuesta anterior",
    reject_route: "rechazar ruta",
    tactical_grounding: "pedir aterrizaje táctico",
    delegate_to_limbi: "delegar decisión a Limbi",
    campaign_stage_inquiry: "ubicar etapa de campaña (expectativa/lanzamiento/conversión/sostenimiento)",
    conversion_bridge: "puente concepto → compra en página/tienda",
    audience_strategy_request:
      "pedir audiencia/segmento estratégico (motivación, tensión, barrera — sin tácticas)",
    concept_rejection_or_alternative_request:
      "rechazar propuesta o pedir alternativas de concepto/paraguas",
    external_research_request: "investigar referentes externos",
    project_handoff_request: "preparar paso a Proyecto",
    general: "continuar conversación estratégica",
  };
  return map[intent];
}

/** Cierre con pregunta solo cuando ayuda a decidir entre rutas ya propuestas. */
export function shouldIncludeClosingQuestion(
  intent: BrainstormerTurnIntent,
  userMessage: string,
  brief?: BrainstormerWorkingBrief,
): boolean {
  const t = normalize(userMessage);
  const hasConfirmedUmbrella = Boolean(brief?.confirmed_conceptual_umbrella.trim());
  const allowAlternatives = userExplicitlyRequestsNewOptions(userMessage);

  if (hasConfirmedUmbrella && !allowAlternatives) {
    if (
      intent === "strategic_concept" ||
      intent === "conceptual_strategy_request" ||
      intent === "options" ||
      intent === "general" ||
      intent === "explore_idea"
    ) {
      return false;
    }
  }
  if (
    (intent === "strategic_concept" ||
      intent === "conceptual_strategy_request" ||
      intent === "conceptual_level_correction") &&
    hasAny(t, [
      /paraguas/,
      /cu[aá]l ser[ií]a el paraguas/,
      /no sab[ií]as/,
      /mensaje conector/,
      /concepto rector/,
      /idea fuerza/,
    ])
  ) {
    return false;
  }
  if (
    intent === "reject_route" ||
    intent === "deliverable_piece" ||
    intent === "next_step" ||
    intent === "campaign_stage_inquiry" ||
    intent === "conversion_bridge"
  ) {
    return false;
  }
  if (intent === "options" || intent === "delegate_to_limbi" || intent === "adjust_proposal") {
    return true;
  }
  if (intent === "launch_strategy" || intent === "campaign_expectation") {
    return hasAny(t, [
      /deber[ií]amos/,
      /convendr[ií]a/,
      /prefieres/,
      /validar/,
      /cu[aá]l de/,
      /elige/,
      /algo diferente/,
    ]);
  }
  return false;
}

function buildDecisionClosingQuestion(
  intent: BrainstormerTurnIntent,
  brief: BrainstormerWorkingBrief,
  thinkingPrimaryKey: ThinkingModelKey | null,
): string {
  switch (intent) {
    case "campaign_expectation":
      return thinkingPrimaryKey === "explorer"
        ? "¿Quieres que la expectativa sea más misteriosa, más humorística o más provocadora?"
        : "¿Arrancamos expectativa con este paraguas o prefieres validar primero el concepto de lanzamiento?";
    case "launch_strategy":
      return "¿Quieres que bajemos el concepto ganador a etapas de expectativa, lanzamiento y sostenimiento, o prefieres elegir primero el paraguas?";
    case "strategic_concept":
    case "conceptual_strategy_request":
    case "conceptual_level_correction":
    case "user_confusion":
      return "";
    case "next_step":
      return "¿Ejecutamos ese paso ahora en detalle o prefieres validar antes el paraguas conceptual que lo sostiene?";
    case "options":
      return "¿Con cuál de estas rutas te quedas para el siguiente desarrollo?";
    case "delegate_to_limbi":
      return "¿Llevamos la ruta que recomiendo como principal o quieres que explore una variante más arriesgada?";
    case "deliverable_piece":
      return "¿Afinamos tono y extensión de esta pieza o pasamos a la siguiente sección del entregable?";
    case "tactical_grounding":
      return "¿Priorizamos canales de mayor impacto inmediato o una secuencia por etapas del momento del reto?";
    case "reject_route":
      return "¿Te sirve más una variante con más picardía, más realismo cotidiano o más elegancia de marca?";
    case "adjust_proposal":
      return brief.open_decisions[0] ?? "¿Esta versión cumple la corrección o ajustamos el tono un punto más?";
    default:
      return brief.open_decisions[0] ?? "¿Prefieres profundizar el concepto ganador, comparar una variante alternativa o pasar al siguiente paso operativo?";
  }
}

function isGenericClosingQuestion(question: string): boolean {
  const q = question.trim();
  if (q.length < 8) return true;
  return GENERIC_CLOSING_PATTERNS.some((p) => p.test(q));
}

/** Actualiza el brief vivo. Paraguas y strategy_stage solo vía interpretación del turno. */
export function updateBrainstormerWorkingBrief(args: {
  prior: BrainstormerWorkingBrief;
  userMessage: string;
  conversationExcerpt?: string;
  turnIntent?: BrainstormerTurnIntent;
  interpretation?: BrainstormerTurnInterpretation;
}): BrainstormerWorkingBrief {
  const interpretation =
    args.interpretation ??
    interpretBrainstormerTurnDeterministic({
      last_user_message: args.userMessage,
      conversation_excerpt: args.conversationExcerpt,
      working_brief: args.prior,
    });

  const brief = applyTurnInterpretationToWorkingBrief({
    prior: args.prior,
    interpretation,
    userMessage: args.userMessage,
  });

  const corpus = `${args.conversationExcerpt ?? ""}\n${args.userMessage}`;

  const moment = detectStrategicMoment(corpus);
  if (moment !== "unknown" || brief.strategic_moment === "unknown") {
    brief.strategic_moment = moment !== "unknown" ? moment : brief.strategic_moment;
  }

  for (const c of extractConstraintsFromMessage(args.userMessage)) {
    brief.active_constraints = uniquePush(brief.active_constraints, c, 32);
    brief.user_corrections = uniquePush(brief.user_corrections, c, 24);
  }

  const approved = extractApprovedSignal(args.userMessage);
  if (approved) {
    brief.approved_signals = uniquePush(brief.approved_signals, approved, 20);
  }

  const stageCorpus = `${args.conversationExcerpt ?? ""}\n${args.userMessage}`;
  const inferredStage = inferCampaignStageFromContext(stageCorpus);
  if (inferredStage !== "unknown") {
    brief.campaign_stage = inferredStage;
  }
  if (
    isSketchOrFakeProductContext(stageCorpus) &&
    hasAny(normalize(args.userMessage), [/expectativa/, /sketch/, /producto falso/])
  ) {
    brief.campaign_stage = "expectativa";
  }

  if (!brief.conversion_bridge.trim()) {
    brief.conversion_bridge = CONVERSION_BRIDGE_TEMPLATE_ES;
  }

  return brainstormerWorkingBriefSchema.parse(brief);
}

export function buildConversationContractForTurn(args: {
  brief: BrainstormerWorkingBrief;
  userMessage: string;
  conversationExcerpt?: string;
  director?: ConversationDirectorDecision;
  thinkingPrimaryKey?: ThinkingModelKey | null;
  brandCredibilityAssets?: readonly string[];
  interpretation?: BrainstormerTurnInterpretation;
}): BrainstormerConversationContractTurn {
  const interpretation =
    args.interpretation ??
    interpretBrainstormerTurnDeterministic({
      last_user_message: args.userMessage,
      conversation_excerpt: args.conversationExcerpt,
      working_brief: args.brief,
    });

  const payload = buildContractPayloadFromInterpretation({
    brief: args.brief,
    interpretation,
    thinkingPrimaryKey: args.thinkingPrimaryKey,
    userMessage: args.userMessage,
  });
  const turn_intent = payload.turn_intent;
  const brief = payload.brief;
  const obligation = payload.response_obligation;
  const forbidden = payload.forbidden_response_patterns;
  const user_delegated_decision = turn_intent === "delegate_to_limbi";

  const include_closing_question = shouldIncludeClosingQuestion(
    turn_intent,
    args.userMessage,
    brief,
  );

  let effective_closing_question: string | null = null;
  if (include_closing_question) {
    effective_closing_question = buildDecisionClosingQuestion(
      turn_intent,
      brief,
      args.thinkingPrimaryKey ?? null,
    );
    const directorQ = args.director?.next_best_question?.trim() ?? "";
    const canUseDirectorQuestion =
      directorQ &&
      !isGenericClosingQuestion(directorQ) &&
      !isMaterialRequestClosingQuestion(directorQ);

    if (canUseDirectorQuestion) {
      effective_closing_question = directorQ;
    }
  }

  return {
    turn_intent,
    brief,
    response_obligation: obligation,
    prompt_deliver_hint: payload.prompt_deliver_hint,
    forbidden_response_patterns: forbidden,
    effective_closing_question,
    include_closing_question,
    user_delegated_decision,
  };
}

export function buildWorkingBriefPromptBlock(brief: BrainstormerWorkingBrief): string {
  const parts: string[] = [
    `WORKING BRIEF (memory) moment=${brief.strategic_moment} request=${brief.current_request_type} strategy_stage=${brief.strategy_stage} stage=${brief.campaign_stage}`,
  ];
  if (brief.confirmed_conceptual_umbrella.trim()) {
    parts.push(`confirmed_umbrella: ${brief.confirmed_conceptual_umbrella}`);
    parts.push(`(interno: no reemplazar paraguas salvo que pidan alternativas)`);
  }
  if (brief.confirmed_decisions.length) {
    parts.push(`confirmed: ${brief.confirmed_decisions.slice(-4).join(" | ")}`);
  }
  if (brief.active_constraints.length) {
    parts.push(`constraints: ${brief.active_constraints.slice(-6).join(" | ")}`);
  }
  if (brief.rejected_paths.length) {
    parts.push(`rejected: ${brief.rejected_paths.slice(-3).join(" | ")}`);
  }
  if (brief.conversion_bridge.trim()) {
    parts.push(`conversion_bridge: ${brief.conversion_bridge.slice(0, 200)}`);
  }
  if (brief.next_best_step) {
    parts.push(`next_step_hint: ${brief.next_best_step.slice(0, 200)}`);
  }
  return parts.join("\n");
}

export function buildConversationContractPromptBlock(
  contract: BrainstormerConversationContractTurn,
): string {
  const forbidden = [
    "cierres genéricos vacíos",
    "pedir archivo/brief en ideación",
    ...contract.forbidden_response_patterns.slice(0, 6),
  ];
  const closing = contract.include_closing_question && contract.effective_closing_question
    ? `closing (optional): ${contract.effective_closing_question}`
    : "closing: none — termina con propuesta clara";

  const umbrellaLock = contract.brief.confirmed_conceptual_umbrella.trim()
    ? `(interno: paraguas confirmado «${contract.brief.confirmed_conceptual_umbrella.trim()}» — no reabrir alternativas)`
    : "";

  const deliver =
    contract.turn_intent === "conversion_bridge" ||
    contract.turn_intent === "campaign_stage_inquiry"
      ? contract.response_obligation
      : contract.prompt_deliver_hint?.trim() || contract.response_obligation;

  return [
    `THIS TURN — user asked: ${intentLabel(contract.turn_intent)}`,
    NATURAL_PROSE_TONE_HINT,
    umbrellaLock,
    `DELIVER: ${deliver}`,
    `AVOID: ${forbidden.join("; ")}`,
    closing,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Ajusta la pregunta del director si es genérica o incompatible con el contrato. */
export function applyConversationContractToDirector(
  director: ConversationDirectorDecision,
  contract: BrainstormerConversationContractTurn,
): ConversationDirectorDecision {
  const q = director.next_best_question?.trim() ?? "";
  const ideation = isIdeationRequestType(contract.turn_intent);
  const shouldOverride =
    isGenericClosingQuestion(q) ||
    isMaterialRequestClosingQuestion(q) ||
    contract.user_delegated_decision ||
    ideation ||
    contract.turn_intent === "launch_strategy" ||
    contract.turn_intent === "campaign_expectation" ||
    ((contract.turn_intent === "strategic_concept" ||
      contract.turn_intent === "conceptual_strategy_request") &&
      hasAny(q, [/\bhashtag\b/i, /\bcalendario\b/i, /\bcanal\b/i, /\binfluencer/i]) &&
      !hasAny(q, [/paraguas|concepto|territorio/i]));

  const next = {
    ...director,
    should_request_user_material: ideation ? false : director.should_request_user_material,
    requested_material_reason: ideation ? null : director.requested_material_reason,
  };

  if (!contract.include_closing_question) {
    return {
      ...next,
      next_best_question: "",
      question_asks_for: "decision",
      question_reason: `Contract (${contract.turn_intent}): deliver proposal; closing question not required.`,
    };
  }

  if (!shouldOverride) return next;

  return {
    ...next,
    next_best_question: contract.effective_closing_question ?? "",
    question_asks_for: "decision",
    question_reason: `Conversation contract (${contract.turn_intent}): decision-style closing.`,
  };
}

export type BrainstormerResponseContractValidation = {
  ok: boolean;
  violations: string[];
};

/** Validación heurística post-respuesta (tests / futura reparación). */
export function validateBrainstormerResponseContract(args: {
  assistantMessage: string;
  contract: BrainstormerConversationContractTurn;
}): BrainstormerResponseContractValidation {
  const violations: string[] = [];
  const msg = args.assistantMessage;
  const { contract } = args;

  for (const p of GENERIC_CLOSING_PATTERNS) {
    if (p.test(msg)) violations.push(`generic_closing: ${p.source}`);
  }

  if (
    contract.turn_intent === "strategic_concept" ||
    contract.turn_intent === "conceptual_strategy_request"
  ) {
    const tacticHits = TACTIC_LEAK_PATTERNS.filter((p) => p.test(msg));
    if (tacticHits.length >= 2) {
      violations.push("conceptual_strategy_leaked_tactics");
    }
  }

  if (contract.turn_intent === "next_step") {
    const bulletCount = (msg.match(/^\s*[-•*]\s+/gm) ?? []).length;
    if (bulletCount >= 5) violations.push("next_step_too_many_bullets");
  }

  if (contract.user_delegated_decision && /\b(qu[eé] prefieres|t[uú] decides|qu[eé] te parece)\b/i.test(msg)) {
    violations.push("delegated_but_bounced_to_user");
  }

  return { ok: violations.length === 0, violations };
}

export function mergeWorkingBriefIntoProgress(
  progress: { working_brief?: unknown },
  brief: BrainstormerWorkingBrief,
): { working_brief: BrainstormerWorkingBrief } {
  return { ...progress, working_brief: brief };
}
