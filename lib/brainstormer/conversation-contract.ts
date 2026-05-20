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
  VISIBLE_FRAMEWORK_HEADERS_FORBIDDEN,
  WEAK_CREATIVE_TERRITORY_FAMILIES_FORBIDDEN,
} from "@/lib/brainstormer/brainstormer-natural-voice";
import {
  buildCampaignStageInquiryObligation,
  buildConfirmedUmbrellaAnchor,
  buildConversionBridgeObligation,
  CONVERSION_BRIDGE_TEMPLATE_ES,
  extractConfirmedConceptualUmbrella,
  extractConfirmedDecisions,
  inferCampaignStageFromContext,
  isConversionBridgeRequest,
  isValidConceptualUmbrellaCandidate,
  normalizeStoredConceptualUmbrella,
  shouldPersistConceptualUmbrellaUpdate,
  isSketchOrFakeProductContext,
  userExplicitlyRequestsNewOptions,
  type BrainstormerCampaignStage,
} from "@/lib/brainstormer/working-brief-memory";

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

export const brainstormerTurnIntentSchema = z.enum([
  "explore_idea",
  /** @deprecated Preferir conceptual_strategy_request; se mantiene en datos históricos. */
  "strategic_concept",
  "conceptual_strategy_request",
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
});

export type BrainstormerWorkingBrief = z.infer<typeof brainstormerWorkingBriefSchema>;

export type BrainstormerConversationContractTurn = {
  turn_intent: BrainstormerTurnIntent;
  brief: BrainstormerWorkingBrief;
  response_obligation: string;
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

const UNSUPPORTED_PROOF_PATTERNS: RegExp[] = [
  /\btestimonios?\s+de\s+clientes?\s+satisfechos?\b/i,
  /\bclientes?\s+satisfechos?\b/i,
  /\bpremios?\s+ganados?\b/i,
  /\bresultados?\s+comprobados?\b/i,
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

  if (
    hasAny(t, [
      /\blanzar la marca\b/,
      /\blanzar marca\b/,
      /\blanzamiento de marca\b/,
      /\bquiero lanzar\b/,
      /\blanzar la marca\b/,
    ])
  ) {
    return "launch_strategy";
  }

  if (isConceptualStrategyRequest(userMessage, conversationExcerpt)) {
    return "conceptual_strategy_request";
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

function extractRejectedPath(userMessage: string, intent: BrainstormerTurnIntent): string | null {
  if (intent !== "reject_route") return null;
  const trimmed = userMessage.trim();
  if (trimmed.length < 8) return "Ruta rechazada por el usuario (sin detalle)";
  return trimmed.length > 400 ? `${trimmed.slice(0, 397)}…` : trimmed;
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
    general: "continuar conversación estratégica",
  };
  return map[intent];
}

function buildThinkingModelConceptualSuffix(
  thinkingPrimaryKey: ThinkingModelKey | null,
): string {
  switch (thinkingPrimaryKey) {
    case "explorer":
      return " Enfoque (interno): ruptura, ironía, deseo inesperado, contraste, humor con criterio, idea conversable.";
    case "commercial":
      return " Enfoque (interno): concepto → deseo → producto real → landing → CTA → compra; fricción, objeción y prueba.";
    case "architect":
      return " Enfoque (interno): eje estratégico, jerarquía de mensajes y secuencia de campaña.";
    case "empathic":
      return " Enfoque (interno): audiencia, barrera, motivación y puente humano.";
    case "symbolic":
      return " Enfoque (interno): territorio narrativo, metáfora o idea madre expresiva.";
    default:
      return "";
  }
}

function buildDisruptorObligationSuffix(brief: BrainstormerWorkingBrief): string {
  if (brief.confirmed_conceptual_umbrella.trim()) {
    return " Razonar con filo (interno); profundizar el paraguas confirmado en prosa, sin alternativas.";
  }
  return " Razonar con filo (interno); una sola dirección con postura, sin menú de paraguas ni etiquetas visibles.";
}

function baseVisibleForbidden(): string[] {
  return [
    `territorios débiles: ${WEAK_CREATIVE_TERRITORY_FAMILIES_FORBIDDEN.join(", ")}`,
    ...VISIBLE_FRAMEWORK_HEADERS_FORBIDDEN,
    "Paraguas conceptual 1",
    "Paraguas conceptual 2",
    "Paraguas conceptual 3",
    "menú de 3 opciones sin que lo pidan",
  ];
}

function buildResponseObligation(
  intent: BrainstormerTurnIntent,
  brief: BrainstormerWorkingBrief,
  ctx: {
    thinkingPrimaryKey: ThinkingModelKey | null;
    brandCredibilityAssets: readonly string[];
    userMessage: string;
  },
): { obligation: string; forbidden: string[] } {
  const constraints =
    brief.active_constraints.length > 0
      ? ` Respeta SIEMPRE: ${brief.active_constraints.join("; ")}.`
      : "";
  const rejected =
    brief.rejected_paths.length > 0
      ? ` NO retomes ni insistas en: ${brief.rejected_paths.slice(-3).join(" | ")}.`
      : "";

  const launchNoProof =
    (brief.strategic_moment === "launch" || intent === "launch_strategy") &&
    ctx.brandCredibilityAssets.length === 0
      ? " PROHIBIDO afirmar testimonios de clientes satisfechos, premios o resultados sin evidencia en Base de Marca. Alternativas: prueba simulada, demo, experimento social, reacción temprana, UGC futuro — siempre como hipótesis."
      : "";

  const genericTacticForbidden = GENERIC_TACTIC_PATTERNS.map((p) => p.source);
  const allowAlternatives = userExplicitlyRequestsNewOptions(ctx.userMessage);
  const { anchor, extraForbidden: umbrellaForbidden } = buildConfirmedUmbrellaAnchor(
    brief,
    allowAlternatives,
  );
  const disruptorSuffix =
    !allowAlternatives &&
    ctx.thinkingPrimaryKey === "explorer" &&
    (intent === "explore_idea" ||
      intent === "options" ||
      intent === "launch_strategy" ||
      intent === "campaign_expectation" ||
      intent === "strategic_concept" ||
      intent === "conceptual_strategy_request" ||
      /\bdiferente\b/.test(normalize(ctx.userMessage)))
      ? buildDisruptorObligationSuffix(brief)
      : "";

  const conceptualThinkingSuffix =
    intent === "conceptual_strategy_request" || intent === "strategic_concept"
      ? buildThinkingModelConceptualSuffix(ctx.thinkingPrimaryKey)
      : "";

  const base = {
    forbidden: [
      ...TACTIC_LEAK_PATTERNS.map((p) => p.source),
      ...genericTacticForbidden,
      ...baseVisibleForbidden(),
      "Preguntas genéricas de opinión al cierre",
      "Pedir subir archivo o brief como cierre en fase de ideación",
    ],
  };

  if (launchNoProof) {
    base.forbidden.push(...UNSUPPORTED_PROOF_PATTERNS.map((p) => p.source));
  }
  if (umbrellaForbidden.length) {
    base.forbidden.push(...umbrellaForbidden);
  }

  switch (intent) {
    case "campaign_expectation": {
      return {
        obligation:
          `Responder sí/no con criterio en prosa conversacional; por qué conviene o no la expectativa previa. Si falta paraguas, una sola recomendación (no menú). Etapas en lenguaje natural: expectativa → lanzamiento → sostenimiento.${constraints}${rejected}${launchNoProof}${disruptorSuffix}`,
        forbidden: [
          ...base.forbidden,
          "teasers visuales",
          "influencers",
          "contenidos interactivos",
          "como lista inicial sin paraguas",
        ],
      };
    }
    case "launch_strategy": {
      return {
        obligation:
          `Hablar del lanzamiento en prosa: una lectura con postura y cómo se vive en expectativa → lanzamiento → sostenimiento. Si falta paraguas, una recomendación clara (no lista de opciones).${constraints}${rejected}${launchNoProof}${disruptorSuffix}`,
        forbidden: base.forbidden,
      };
    }
    case "strategic_concept":
    case "conceptual_strategy_request": {
      const conceptualBase =
        "Tomar postura: proponer o validar UNA idea rectora (paraguas/mensaje conector) y explicar por qué funciona; mostrar cómo ordena etapas y piezas sin bajar a tácticas antes. Prosa conversacional, sin plantilla de tres bloques ni menú de 3 opciones salvo que pidan alternativas. Si traen frase buena, evaluarla y tomar postura (no reemplazarla automáticamente).";
      if (brief.confirmed_conceptual_umbrella.trim() && !allowAlternatives) {
        return {
          obligation: `${conceptualBase} Anclar al paraguas confirmado; no reabrir alternativas.${anchor}${constraints}${rejected}${launchNoProof}${conceptualThinkingSuffix}${disruptorSuffix}`,
          forbidden: [
            ...base.forbidden,
            "hashtag",
            "calendario editorial",
            "guion sin pedirlo",
            "lista de tácticas sin concepto resuelto",
          ],
        };
      }
      const anchored =
        userSeeksFeedbackOnProposedConcept(ctx.userMessage) ||
        hasAny(normalize(ctx.userMessage), [
          /no sab[ií]as/,
          /paraguas/,
          /cu[aá]l ser[ií]a el paraguas/,
          /mensaje conector/,
          /idea fuerza/,
          /territorio narrativ/,
          /estaba pensando/,
        ]);
      const obligation = anchored
        ? `${conceptualBase} Si la frase encaja: "Ese es el paraguas" (o equivalente), por qué funciona y cómo ordena la campaña — sin alternativas.${constraints}${rejected}${launchNoProof}${conceptualThinkingSuffix}${disruptorSuffix}`
        : `${conceptualBase}${constraints}${rejected}${launchNoProof}${conceptualThinkingSuffix}${disruptorSuffix}`;
      return {
        obligation,
        forbidden: [
          ...base.forbidden,
          "hashtag",
          "calendario editorial",
          "guion sin pedirlo",
          "lista de tácticas sin concepto resuelto",
        ],
      };
    }
    case "next_step": {
      const routeObligation = brief.confirmed_conceptual_umbrella.trim()
        ? `Explicar la ruta en prosa fluida desde el paraguas confirmado (ej. "Yo lo dividiría en cuatro momentos: expectativa, revelación, conversión y sostenimiento") y qué harías primero. Sin lista genérica de tácticas.${anchor}`
        : `Un solo siguiente paso concreto en prosa, no menú de tácticas.`;
      return {
        obligation: `${routeObligation}${constraints}${rejected}`,
        forbidden: [...base.forbidden, "listas de 5+ tácticas sin paso único"],
      };
    }
    case "campaign_stage_inquiry":
      return {
        obligation: buildCampaignStageInquiryObligation(brief, allowAlternatives) + constraints + rejected,
        forbidden: [
          ...base.forbidden,
          "conceptualización",
          "desarrollo de contenido",
          "producción interna",
        ],
      };
    case "conversion_bridge":
      return {
        obligation:
          buildConversionBridgeObligation(brief, allowAlternatives, ctx.thinkingPrimaryKey) +
          constraints +
          rejected,
        forbidden: [
          ...base.forbidden,
          "SEO genérico",
          "email marketing genérico",
          "remarketing genérico sin puente creativo",
          "cupones",
          "free shipping",
          ...(ctx.thinkingPrimaryKey === "explorer"
            ? ["checklist e-commerce genérico como respuesta principal"]
            : []),
        ],
      };
    case "options": {
      if (brief.confirmed_conceptual_umbrella.trim() && !allowAlternatives) {
        return {
          obligation: `El paraguas ya está confirmado: avanzar ejecución o matices dentro de «${brief.confirmed_conceptual_umbrella.trim()}», no nuevas opciones de paraguas.${anchor}${constraints}${rejected}`,
          forbidden: base.forbidden,
        };
      }
      return {
        obligation: `Comparar 2 rutas en prosa con criterio de elección (solo porque pidieron alternativas).${constraints}${rejected}`,
        forbidden: base.forbidden,
      };
    }
    case "delegate_to_limbi": {
      if (brief.confirmed_conceptual_umbrella.trim() && !allowAlternatives) {
        return {
          obligation: `Toma postura sobre el siguiente movimiento con el paraguas confirmado; no reabras elección de concepto.${anchor}${constraints}${rejected}`,
          forbidden: base.forbidden,
        };
      }
      return {
        obligation: `Toma postura: una recomendación clara y por qué. No devuelvas la decisión con preguntas vacías ni menú de opciones.${constraints}${rejected}`,
        forbidden: [...base.forbidden, "¿qué opinas?", "¿qué te parece?"],
      };
    }
    case "reject_route":
      return {
        obligation: `Reconocer el rechazo, registrar qué no funciona y proponer UNA dirección alternativa distinta (no insistir en la ruta rechazada).${constraints}${rejected}`,
        forbidden: [...base.forbidden, "repetir la misma ruta rechazada"],
      };
    case "adjust_proposal":
      return {
        obligation: `Rehacer o ajustar la propuesta anterior incorporando las correcciones del usuario como restricciones activas.${constraints}${rejected}`,
        forbidden: base.forbidden,
      };
    case "deliverable_piece":
      return {
        obligation: `ENTREGAR la pieza pedida (guion, copy, estructura…) con criterio estratégico, sin saltar a otro formato.${constraints}${rejected}`,
        forbidden: ["sustituir pieza por solo concepto abstracto sin pedirlo"],
      };
    case "tactical_grounding": {
      if (brief.confirmed_conceptual_umbrella.trim() && !allowAlternatives) {
        return {
          obligation: `Aterrizar tácticas SOLO como extensión del paraguas confirmado y su etapa (${brief.campaign_stage}).${anchor}${constraints}${rejected}`,
          forbidden: base.forbidden,
        };
      }
      return {
        obligation: `Si hay paraguas conceptual suficiente, aterrizar tácticas/canales/piezas; si no, declarar el paraguas en 1–2 frases y luego tácticas.${constraints}${rejected}`,
        forbidden: base.forbidden,
      };
    }
    case "critique":
      return {
        obligation: `Crítica experta en prosa: qué funciona, qué no y mejora concreta — sin encabezados ni menú de opciones.${constraints}${rejected}`,
        forbidden: base.forbidden,
      };
    case "explore_idea":
      return {
        obligation: `Explorar con una hipótesis y una dirección en prosa; no cerrar solo preguntando ni listar 3 rutas.${constraints}${rejected}${launchNoProof}${disruptorSuffix}`,
        forbidden: base.forbidden,
      };
    default: {
      if (isConceptualStrategyRequest(ctx.userMessage)) {
        const conceptualBase =
          "Tomar postura sobre la idea rectora pedida; no bajar a tácticas ni usar estructura Lectura/Criterio/Ruta.";
        return {
          obligation: `${conceptualBase}${anchor}${constraints}${rejected}${launchNoProof}${conceptualThinkingSuffix}`,
          forbidden: base.forbidden,
        };
      }
      return {
        obligation: `Responder con postura clara y avance útil en prosa; alinear al pedido explícito (sin encabezados Lectura/Criterio/Ruta salvo pedido formal).${anchor}${constraints}${rejected}${launchNoProof}`,
        forbidden: base.forbidden,
      };
    }
  }
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
    (intent === "strategic_concept" || intent === "conceptual_strategy_request") &&
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

/** Actualiza el brief vivo con señales del turno actual. */
export function updateBrainstormerWorkingBrief(args: {
  prior: BrainstormerWorkingBrief;
  userMessage: string;
  conversationExcerpt?: string;
  turnIntent?: BrainstormerTurnIntent;
}): BrainstormerWorkingBrief {
  const intent =
    args.turnIntent ?? classifyBrainstormerTurnIntent(args.userMessage, args.conversationExcerpt ?? "");
  const corpus = `${args.conversationExcerpt ?? ""}\n${args.userMessage}`;

  const brief: BrainstormerWorkingBrief = {
    ...args.prior,
    current_request_type: intent,
  };

  const moment = detectStrategicMoment(corpus);
  if (moment !== "unknown" || brief.strategic_moment === "unknown") {
    brief.strategic_moment = moment !== "unknown" ? moment : brief.strategic_moment;
  }

  for (const c of extractConstraintsFromMessage(args.userMessage)) {
    brief.active_constraints = uniquePush(brief.active_constraints, c, 32);
    brief.user_corrections = uniquePush(brief.user_corrections, c, 24);
  }

  const rejected = extractRejectedPath(args.userMessage, intent);
  if (rejected) {
    brief.rejected_paths = uniquePush(brief.rejected_paths, rejected, 20);
  }

  const approved = extractApprovedSignal(args.userMessage);
  if (approved) {
    brief.approved_signals = uniquePush(brief.approved_signals, approved, 20);
  }

  const priorRaw = brief.confirmed_conceptual_umbrella.trim();
  const priorNormalized = normalizeStoredConceptualUmbrella(priorRaw, args.userMessage);
  if (priorNormalized) {
    brief.confirmed_conceptual_umbrella = priorNormalized;
  } else if (priorRaw && !isValidConceptualUmbrellaCandidate(priorRaw)) {
    brief.confirmed_conceptual_umbrella = "";
  }

  const umbrella = extractConfirmedConceptualUmbrella({
    userMessage: args.userMessage,
    conversationExcerpt: args.conversationExcerpt ?? "",
    priorUmbrella: brief.confirmed_conceptual_umbrella,
  });
  if (
    umbrella &&
    shouldPersistConceptualUmbrellaUpdate({
      priorUmbrella: brief.confirmed_conceptual_umbrella,
      candidate: umbrella,
      userMessage: args.userMessage,
    })
  ) {
    brief.confirmed_conceptual_umbrella = umbrella;
    brief.confirmed_decisions = uniquePush(
      brief.confirmed_decisions,
      `Paraguas: ${umbrella}`,
      16,
    );
    brief.open_decisions = brief.open_decisions.filter(
      (d) => !/elegir paraguas|paraguas conceptual ganador/i.test(d),
    );
  }

  for (const d of extractConfirmedDecisions({ userMessage: args.userMessage, umbrella })) {
    brief.confirmed_decisions = uniquePush(brief.confirmed_decisions, d, 16);
  }

  const stageCorpus = `${args.conversationExcerpt ?? ""}\n${args.userMessage}`;
  const inferredStage = inferCampaignStageFromContext(stageCorpus);
  if (inferredStage !== "unknown") {
    brief.campaign_stage = inferredStage;
  }
  if (
    isSketchOrFakeProductContext(stageCorpus) &&
    (intent === "campaign_stage_inquiry" ||
      hasAny(normalize(args.userMessage), [/expectativa/, /sketch/, /producto falso/]))
  ) {
    brief.campaign_stage = "expectativa";
  }

  if (!brief.conversion_bridge.trim()) {
    brief.conversion_bridge = CONVERSION_BRIDGE_TEMPLATE_ES;
  }

  if (
    !brief.confirmed_conceptual_umbrella.trim() &&
    (intent === "strategic_concept" ||
      intent === "conceptual_strategy_request" ||
      intent === "launch_strategy" ||
      intent === "campaign_expectation")
  ) {
    brief.next_best_step = "Definir paraguas conceptual antes de tácticas o piezas.";
    brief.open_decisions = uniquePush(
      brief.open_decisions,
      "Elegir paraguas conceptual ganador",
      16,
    );
    if (intent === "campaign_expectation" || intent === "launch_strategy") {
      brief.open_decisions = uniquePush(
        brief.open_decisions,
        "Validar expectativa previa vs lanzamiento directo",
        16,
      );
    }
  } else if (intent === "next_step") {
    brief.next_best_step = brief.confirmed_conceptual_umbrella.trim()
      ? "Secuencia expectativa → lanzamiento → conversión → sostenimiento."
      : "Ejecutar un solo siguiente paso concreto.";
  } else if (intent === "campaign_stage_inquiry") {
    brief.next_best_step = "Ubicar pieza en marco de campaña (no producción interna).";
  } else if (intent === "conversion_bridge") {
    brief.next_best_step = "Puente creativo hacia compra en página/tienda.";
  } else if (intent === "delegate_to_limbi") {
    brief.next_best_step = "Limbi propone ruta con criterio; usuario elige entre opciones.";
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
}): BrainstormerConversationContractTurn {
  const turn_intent = classifyBrainstormerTurnIntent(
    args.userMessage,
    args.conversationExcerpt ?? "",
  );
  const brief = { ...args.brief, current_request_type: turn_intent };
  const { obligation, forbidden } = buildResponseObligation(turn_intent, brief, {
    thinkingPrimaryKey: args.thinkingPrimaryKey ?? null,
    brandCredibilityAssets: args.brandCredibilityAssets ?? [],
    userMessage: args.userMessage,
  });
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
    forbidden_response_patterns: forbidden,
    effective_closing_question,
    include_closing_question,
    user_delegated_decision,
  };
}

export function buildWorkingBriefPromptBlock(brief: BrainstormerWorkingBrief): string {
  const parts: string[] = [
    `WORKING BRIEF (memory) moment=${brief.strategic_moment} request=${brief.current_request_type} stage=${brief.campaign_stage}`,
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

  return [
    `THIS TURN — user asked: ${intentLabel(contract.turn_intent)}`,
    NATURAL_PROSE_TONE_HINT,
    umbrellaLock,
    `DELIVER: ${contract.response_obligation}`,
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
