import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import {
  GUIDED_QUESTION_EVIDENCE,
  questionForMiniStep,
} from "@/lib/intake/guided-interview-flow";
import type {
  AudienceRecommendationPendingV1,
  LimbicInterviewTraceV1,
} from "@/lib/intake/orchestrator";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { EVIDENCE_CLARIFICATION_SUGGESTED_CHIPS } from "@/lib/intake/guided-intake-clarification";
import {
  applyStrategicInterviewExtraction,
  GUIDED_INTAKE_AUDIENCE_PENDING_LIM,
} from "@/lib/intake/strategic-interview-apply";
import { deepMergeResponses } from "@/lib/utils/deep-merge";
import {
  buildAudienceRecommendationConfirmation,
  resolveAudienceMultiActorStrategicTurn,
} from "@/lib/intake/guided-intake-multi-actor-audience";

const STRATEGIC_VALIDATION_RES = [
  /\best(ás|as) de acuerdo\b/i,
  /\bcrees que\b/i,
  /\bte parece( que)?\b/i,
  /\bqué opinas\b/i,
  /\bque opinas\b/i,
  /\bestoy pensando bien\b/i,
  /\b¿?tiene sentido\b/i,
  /\btiene sentido (enfoc|prioriz|plantear)/i,
  /\bpropuesta de valor\b.*\bsentido/i,
  /\bcoincides\b/i,
  /\bvalidar(ía|íamos)?\b/i,
  /\b(visto bueno|bien encaminad)\b/i,
  /\b(me gustaría )?(preguntarte|preguntar si)\b/i,
  /\b(tu opinión|tu lectura|tu visión)\b.*\b(es|está|sería|correcto)\b/i,
];

/** Short asks for Limbi’s strategic recommendation (not a definition of the prompt). */
const RECOMMENDATION_REQUEST_RES = [
  /\bme recomendarías\b/i,
  /\bme recomiendas\b/i,
  /\bcuál me recomiendas\b/i,
  /\bcual me recomiendas\b/i,
  /\bcuál debería priorizar\b/i,
  /\bcual debería priorizar\b/i,
  /\ba quién debería convencer primero\b/i,
  /\ba quien debería convencer primero\b/i,
  /\bqué público ves más importante\b/i,
  /\bque publico ves mas importante\b/i,
  /\bqué me sugieres\b/i,
  /\bque me sugieres\b/i,
  /\bcuál crees que es mejor\b/i,
  /\bcual crees que es mejor\b/i,
  /\btú qué harías\b/i,
  /\btu que harías\b/i,
  /\bqué harías tú\b/i,
  /\bque harías tu\b/i,
  /\ba quién priorizar\b/i,
  /\ba quien priorizar\b/i,
  /\bquién me recomiendas\b/i,
  /\bquien me recomiendas\b/i,
];

function isStrategicRecommendationAsk(t: string): boolean {
  return RECOMMENDATION_REQUEST_RES.some((re) => re.test(t));
}

const RETURN_TO_AUDIENCE_TOPIC_RES = [
  /\bvolvamos a la audiencia\b/i,
  /\bvolvamos al p[uú]blico\b/i,
  /\bvolver a la audiencia\b/i,
  /\bme gustar[ií]a definir qui[eé]n es la audiencia\b/i,
  /\bdefinir qui[eé]n es la audiencia\b/i,
  /\bdefinir la audiencia\b/i,
  /\bquiero ajustar el p[uú]blico\b/i,
  /\bprefiero revisar\b.*\b(audiencia|p[uú]blico|publico|prioridad)\b/i,
  /\bno tengo claro a qui[eé]n hablarle\b/i,
  /\bno tengo claro a qui[eé]n\b/i,
  /\bqui[eé]n deber[ií]a ser la audiencia\b/i,
  /\bqui[eé]n es la audiencia\b/i,
  /\ba qui[eé]n crees\b/i,
  /\ba quien crees\b/i,
  /\bqu[eé] me recomiendas sobre la audiencia\b/i,
];

/**
 * User wants to focus on audience priority / Limbi’s read, including “return to audience”
 * from another step (handled in the API for evidence). Pattern-based, not step-specific.
 */
export function detectReturnToAudienceTopicIntent(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 6) return false;

  if (isStrategicRecommendationAsk(t)) {
    if (
      /a qué te refieres|a que te refieres|qué significa|que significa|no entiendo la pregunta/i.test(
        t,
      ) &&
      !/\b(recomendarías|recomiendas|priorizar|opinas|crees|parece|sugieres|audiencia|p[uú]blico|publico)\b/i.test(
        t,
      )
    ) {
      return false;
    }
    return true;
  }

  if (RETURN_TO_AUDIENCE_TOPIC_RES.some((re) => re.test(t))) {
    return true;
  }

  if (
    /\bno estoy seguro\b/i.test(t) &&
    /\b(a qui[eé]n|quien|cree[sn]?|recomiendas|audiencia|p[uú]blico|convencer)\b/i.test(
      t,
    )
  ) {
    return true;
  }

  return false;
}

export type StrategicValidationTurnContent = {
  interviewer_message: string;
  /** Null when the only question is already in `interviewer_message`. */
  next_question: string | null;
  suggested_chips: string[];
  audience_recommendation_pending?: AudienceRecommendationPendingV1 | null;
};

function readSb(r: Record<string, unknown>): Record<string, unknown> {
  const sb = r.strategic_base;
  if (sb && typeof sb === "object" && !Array.isArray(sb)) {
    return { ...(sb as Record<string, unknown>) };
  }
  return {};
}

function blobFromContext(
  userText: string,
  strategicBase: Record<string, unknown>,
): string {
  const prob =
    typeof strategicBase.problem_description_optional === "string"
      ? strategicBase.problem_description_optional
      : "";
  const desc =
    typeof strategicBase.simple_description === "string"
      ? strategicBase.simple_description
      : "";
  return `${userText}\n${prob}\n${desc}`.toLowerCase();
}

function genericProvisionalPreamble(miniStep: GuidedMiniStepId): string {
  const stepHint: Record<GuidedMiniStepId, string> = {
    challenge_type: "el tipo de reto",
    tailored_what: "qué ofreces y el problema que atiendes",
    problem: "la tensión o situación central",
    transformation: "el beneficio o cambio que buscas comunicar",
    audience: "quién debe convencerse primero",
    evidence: "las pruebas o límites con los que Limbi puede sostener claims",
    complete: "este cierre",
  };
  const label = stepHint[miniStep] ?? "esta pregunta";
  return `Con la información que tenemos hasta ahora, mi lectura provisional es que tu planteamiento puede ser defendible, pero todavía falta validarlo con lo que pedimos sobre ${label}. Cuando completemos el Sistema Límbico podré darte un diagnóstico más completo, con prioridades y riesgos mejor fundados. No genero todavía piezas finales de comunicación en esta etapa.`;
}

/** When the user asks for a read on audience priority: marketing-style provisional framing (not generic “defendible” hedging). */
function audienceRecommendationAdvisorPreamble(): string {
  return "Con lo que ya compartiste, te doy una lectura provisional de marketing sobre prioridades de audiencia y tensiones entre quien vive la experiencia y quien autoriza o paga. No es pieza publicitaria final; es criterio para decidir foco y mensaje.";
}

/**
 * User asks for agreement / judgment, or a short recommendation request.
 * Checked before clarification detection in the API.
 */
export function detectDeterministicStrategicValidationIntent(
  userText: string,
  ctx?: { miniStep?: GuidedMiniStepId },
): boolean {
  const t = userText.trim();
  if (t.length < 6) return false;

  if (detectReturnToAudienceTopicIntent(userText)) {
    if (ctx?.miniStep === "evidence") return false;
    if (ctx?.miniStep && ctx.miniStep !== "audience") return false;
    return true;
  }

  const recommendation = isStrategicRecommendationAsk(t);
  if (recommendation) {
    if (
      /a qué te refieres|a que te refieres|qué significa|que significa|no entiendo la pregunta/i.test(
        t,
      ) &&
      !/\b(recomendarías|recomiendas|priorizar|opinas|crees|parece|sugieres)\b/i.test(t)
    ) {
      return false;
    }
    return true;
  }

  if (t.length < 10) return false;
  if (!STRATEGIC_VALIDATION_RES.some((re) => re.test(t))) return false;
  if (
    /a qué te refieres|a que te refieres|qué significa|que significa|no entiendo la pregunta|me das ejemplos de qué contestar/i.test(
      t,
    ) &&
    !/\b(de acuerdo|crees que|opinas|te parece|tiene sentido)\b/i.test(t)
  ) {
    return false;
  }
  void ctx;
  return true;
}

function labelTokensMentioned(textLower: string, label: string): boolean {
  const norm = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const tl = textLower
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const tokens = norm
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9áéíóúñ-]/gi, ""))
    .filter((w) => w.length >= 4);
  if (tokens.length === 0) return tl.includes(norm.trim());
  return tokens.some((w) => tl.includes(w));
}

function normalizedFold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function actorLabelReferencedInText(textFolded: string, label: string): boolean {
  if (labelTokensMentioned(textFolded, label)) return true;
  const lab = normalizedFold(label).replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  if (lab.length < 5) return textFolded.includes(lab);
  return textFolded.includes(lab);
}

/** User cannot name the audience yet — mark pending, never infer wizard audience_type from defaults. */
export function detectAudienceExplicitUnclear(text: string): boolean {
  if (detectReturnToAudienceTopicIntent(text)) return false;
  const f = normalizedFold(text);
  return (
    /\bno lo tengo claro\b/.test(f) ||
    /\bno estoy seguro\b/.test(f) ||
    /\bno s[eé]\b/.test(f) ||
    /\bno se\b/.test(f) ||
    /\bno tengo claro a qui[eé]n\b/.test(f) ||
    /\bno puedo definirlo todav[ií]a\b/.test(f) ||
    /\bno puedo definirlo\b/.test(f) ||
    /\bno tengo la informaci[oó]n\b/.test(f)
  );
}

function orderAgreementPhraseMatched(t: string): boolean {
  return /\b(ese orden est[aá] bien|ese orden va bien|ese orden me parece bien|ese p[uú]blico est[aá] bien|prioricemos|dejemos|mantengamos ese orden)\b/u.test(
    t,
  );
}

export function stripInvertQuestionActive(
  pending: AudienceRecommendationPendingV1,
): AudienceRecommendationPendingV1 {
  const { invert_question_active: _i, ...rest } = pending;
  void _i;
  return rest;
}

export function swapPendingPrimarySecondary(
  pending: AudienceRecommendationPendingV1,
): AudienceRecommendationPendingV1 {
  const base = stripInvertQuestionActive(pending);
  return {
    ...base,
    primary_label: base.secondary_label,
    secondary_label: base.primary_label,
    audience_description_draft: `Prioridad principal: ${base.secondary_label}. Audiencia complementaria: ${base.primary_label}.`,
  };
}

export type PendingAudienceUserReply =
  | { kind: "restart_strategic_audience" }
  | { kind: "explicit_unclear" }
  | { kind: "confirm"; swapPrimarySecondary: boolean }
  | { kind: "secondary_emphasis_invert_prompt" }
  | { kind: "decline_invert_reprompt" }
  | { kind: "reject_priority" }
  | { kind: "reprompt_confirmation" };

/**
 * When `audience_recommendation_pending` is set, interpret the user reply before any normal audience flow.
 * Pattern-based: labels always come from pending / prior trace (no hardcoded actors).
 */
export function classifyPendingAudienceUserReply(
  text: string,
  pending: AudienceRecommendationPendingV1,
): PendingAudienceUserReply {
  const tRaw = text.trim();
  const t = tRaw.toLowerCase();
  const tFold = normalizedFold(tRaw);

  if (detectReturnToAudienceTopicIntent(tRaw)) {
    return { kind: "restart_strategic_audience" };
  }

  if (detectAudienceExplicitUnclear(tRaw)) {
    return { kind: "explicit_unclear" };
  }

  if (pending.invert_question_active) {
    const mp = actorLabelReferencedInText(tFold, pending.primary_label);
    const ms = actorLabelReferencedInText(tFold, pending.secondary_label);
    if (
      /^(sí|si|ok|vale|exacto|confirmo|perfecto|claro|listo)(?=[\s,.;:!?]|$)/u.test(
        t,
      ) ||
      (/\b(sí|si|ok|vale)\b/u.test(t) &&
        (/\binvierte\b/u.test(t) || /\binvertir\b/u.test(t)))
    ) {
      return { kind: "confirm", swapPrimarySecondary: true };
    }
    if (/^(no|nop|mejor no)\b/u.test(t) || /\bmant(en|én)\b/u.test(t)) {
      return { kind: "decline_invert_reprompt" };
    }
    if (ms && !mp) {
      return { kind: "confirm", swapPrimarySecondary: true };
    }
    if (mp && !ms) {
      return { kind: "decline_invert_reprompt" };
    }
  }

  if (
    /\b(prefiero otro orden|otro orden|invertir el orden|cambiar el orden|no ese orden)\b/u.test(
      t,
    ) ||
    /^no\s*,\s*prefiero\b/u.test(t)
  ) {
    return { kind: "reject_priority" };
  }

  const mp = actorLabelReferencedInText(tFold, pending.primary_label);
  const ms = actorLabelReferencedInText(tFold, pending.secondary_label);
  const mt = pending.tertiary_label
    ? actorLabelReferencedInText(tFold, pending.tertiary_label)
    : false;

  if (ms && !mp && !mt) {
    return { kind: "secondary_emphasis_invert_prompt" };
  }

  if (detectAudienceRecommendationConfirm(text, pending)) {
    return { kind: "confirm", swapPrimarySecondary: false };
  }

  if (orderAgreementPhraseMatched(t)) {
    if (ms && !mp) return { kind: "secondary_emphasis_invert_prompt" };
    return { kind: "confirm", swapPrimarySecondary: false };
  }

  if (mp && !ms && !mt) {
    return { kind: "confirm", swapPrimarySecondary: false };
  }

  if (/^(no|nop|nah)\b/u.test(t)) {
    return { kind: "reject_priority" };
  }
  if (
    /\bprefiero no\b|\ba[uú]n no\b|\baun no\b|\btodav[ií]a no\b|\btodavia no\b/.test(
      t,
    )
  ) {
    return { kind: "reject_priority" };
  }

  return { kind: "reprompt_confirmation" };
}

function wizardAudienceSlugFromPending(
  pending: AudienceRecommendationPendingV1,
): "b2b" | "end_consumers" | "professional_audience" {
  const h = pending.audience_type_hint;
  if (h === "b2c") return "end_consumers";
  if (h === "mixed") return "professional_audience";
  return "b2b";
}

/**
 * Confirms a provisional audience recommendation. When `pending` is set, also matches
 * short replies that name the proposed actors (labels come only from prior user/trace text).
 */
export function detectAudienceRecommendationConfirm(
  text: string,
  pending?: AudienceRecommendationPendingV1 | null,
): boolean {
  const t = text.trim().toLowerCase();
  const tFold = normalizedFold(text);
  /** Avoid `\b` after `sí`: JS word boundaries treat `í` as non-`\w`, so `sí,` fails `\b`. */
  if (
    /^(sí|si|ok|vale|exacto|confirmo|perfecto|claro|listo)(?=[\s,.;:!?]|$)/u.test(
      t,
    )
  ) {
    return true;
  }
  if (/así lo dejamos|asi lo dejamos|dejémoslo así|dejemoslo asi/.test(t)) {
    return true;
  }
  if (pending?.primary_label && pending.secondary_label) {
    const mp = actorLabelReferencedInText(tFold, pending.primary_label);
    const ms = actorLabelReferencedInText(tFold, pending.secondary_label);
    const mt = pending.tertiary_label
      ? actorLabelReferencedInText(tFold, pending.tertiary_label)
      : false;
    if (
      /(?:^|[\s,;])(sí|si)\s*,?\s+/u.test(t) &&
      (mp || ms || mt)
    ) {
      return true;
    }
    if (
      (mp || ms || mt) &&
      /\b(sí|si|ok|vale|confirmo|de acuerdo|correcto|así|asi)\b/u.test(t)
    ) {
      return true;
    }
    if (orderAgreementPhraseMatched(t)) {
      if (ms && !mp) return false;
      return true;
    }
    if (mp && !ms && !mt) {
      return true;
    }
  }
  return false;
}

/** Plain rejection of a recommendation (not “I don’t know yet” — use `detectAudienceExplicitUnclear`). */
export function detectAudienceRecommendationReject(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/^(no|nop|nah)\b/u.test(t)) return true;
  if (
    /\bprefiero no\b|\baún no\b|\baun no\b|\btodavía no\b|\btodavia no\b/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

export function buildAudiencePendingAmbiguousTurnContent(params: {
  pending: AudienceRecommendationPendingV1;
  challengeType: string | null;
  otherChallenge: boolean;
}): StrategicValidationTurnContent {
  void params.challengeType;
  void params.otherChallenge;
  const confirmQ = buildAudienceRecommendationConfirmation(params.pending);
  return {
    interviewer_message:
      `No me quedó clara una confirmación ni un cambio de orden frente a la prioridad que te propuse.\n\n${confirmQ}`.trim(),
    next_question: null,
    suggested_chips: [],
    audience_recommendation_pending: params.pending,
  };
}

export function buildAudienceSecondaryInvertOfferTurnContent(
  pending: AudienceRecommendationPendingV1,
): StrategicValidationTurnContent {
  const p = stripInvertQuestionActive(pending);
  return {
    interviewer_message:
      `Entendí que enfatizas a “${p.secondary_label}”. ¿Quieres dejarlo como prioridad principal frente a “${p.primary_label}” (invirtiendo el orden que te sugerí)? Responde en una frase corta (“sí, invierte” o “no, mantén tu sugerencia”).`.trim(),
    next_question: null,
    suggested_chips: [],
    audience_recommendation_pending: { ...p, invert_question_active: true },
  };
}

export function buildAudienceDeclineInvertRepromptTurnContent(
  pending: AudienceRecommendationPendingV1,
): StrategicValidationTurnContent {
  const p = stripInvertQuestionActive(pending);
  const confirmQ = buildAudienceRecommendationConfirmation(p);
  return {
    interviewer_message:
      `Sin problema: mantengo la sugerencia original de orden.\n\n${confirmQ}`.trim(),
    next_question: null,
    suggested_chips: [],
    audience_recommendation_pending: p,
  };
}

export function buildAudienceRejectPriorityTurnContent(
  pending: AudienceRecommendationPendingV1,
): StrategicValidationTurnContent {
  const { primary_label: a, secondary_label: b } = pending;
  return {
    interviewer_message:
      `Entendido. Entonces definamos el orden: entre “${a}” y “${b}”, ¿cuál debe ser la prioridad principal para la comunicación hoy?`.trim(),
    next_question: null,
    suggested_chips: [],
    audience_recommendation_pending: null,
  };
}

export function buildAudienceExplicitUnclearWhilePendingExtraction(params: {
  strategicBase: Record<string, unknown>;
}): IntakeExtractionOutput {
  const sb = { ...params.strategicBase };
  const lim = Array.isArray(sb.guided_intake_limitations_optional)
    ? (sb.guided_intake_limitations_optional as unknown[]).filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      )
    : [];
  const nextLim = lim.some(
    (s) =>
      s.includes(GUIDED_INTAKE_AUDIENCE_PENDING_LIM) ||
      /guided_intake:audience_pending/i.test(s),
  )
    ? lim
    : [...lim, GUIDED_INTAKE_AUDIENCE_PENDING_LIM];
  return {
    extracted_response_updates: {
      strategic_base: {
        ...sb,
        guided_intake_limitations_optional: nextLim,
      },
    },
    confidence_by_field: {},
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [],
    answer_status: "missing_choice",
    target_response_paths: [],
    internal_notes: "audience_explicit_unclear_pending",
    interviewer_message:
      "Entendido. Dejé la audiencia principal como pendiente: no asumo categorías genéricas ni un orden hasta que lo tengas más claro. Cuando quieras, retomamos quién debe convencerse primero y quiénes son decisores o vetos clave.",
    public_copy_allowed: false,
    user_intent: "answer",
  };
}

export function buildAudienceConfirmMergeAndExtraction(
  baseResponses: Record<string, unknown>,
  pending: AudienceRecommendationPendingV1,
): { mergedResponses: Record<string, unknown>; extraction: IntakeExtractionOutput } {
  const draft =
    typeof pending.audience_description_draft === "string" &&
    pending.audience_description_draft.trim().length > 0
      ? pending.audience_description_draft.trim()
      : null;
  const desc =
    draft ??
    `Prioridad principal: ${pending.primary_label}. Audiencia complementaria: ${pending.secondary_label}.`;
  const audience_type = wizardAudienceSlugFromPending(pending);
  const extraction: IntakeExtractionOutput = {
    extracted_response_updates: {
      audience_base: {
        audience_type,
        audience_description_optional: desc,
      },
    },
    confidence_by_field: {
      "audience_base.audience_type": 0.82,
      "audience_base.audience_description_optional": 0.88,
    },
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [],
    answer_status: "clear",
    target_response_paths: [
      "audience_base.audience_type",
      "audience_base.audience_description_optional",
    ],
    internal_notes: "audience_recommendation_confirmed",
    interviewer_message:
      "Quedó registrada la prioridad provisional que confirmaste entre las audiencias mencionadas. Pasemos al siguiente paso.",
    public_copy_allowed: false,
    user_intent: "answer",
  };
  const { mergedResponses: mergedFirst } = applyStrategicInterviewExtraction(
    baseResponses,
    extraction,
  );
  const sb = readSb(mergedFirst);
  const lim = Array.isArray(sb.guided_intake_limitations_optional)
    ? (sb.guided_intake_limitations_optional as unknown[]).filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      )
    : [];
  const limFiltered = lim.filter(
    (s) =>
      s !== GUIDED_INTAKE_AUDIENCE_PENDING_LIM &&
      !/guided_intake:audience_pending/i.test(s),
  );
  const mergedResponses = deepMergeResponses(mergedFirst, {
    strategic_base: {
      ...sb,
      guided_intake_limitations_optional:
        limFiltered.length > 0 ? limFiltered : undefined,
    },
  });
  return { mergedResponses, extraction };
}

/** Short hold when the user only affirms without tying to a concrete audience choice. */
export function buildBareAudienceAffirmationHoldContent(): StrategicValidationTurnContent {
  return {
    interviewer_message:
      "Con una sola afirmación corta no me queda claro a qué te refieres. Si confirmas lo que ya describiste sobre la audiencia, dime en una frase qué actor priorizas y por qué; si no, afinamos quién decide, quién usa y quién puede vetar.",
    next_question: null,
    suggested_chips: [],
    audience_recommendation_pending: null,
  };
}

export function buildStrategicValidationTurnContent(params: {
  miniStep: GuidedMiniStepId;
  userText: string;
  challengeType: string | null;
  otherChallenge: boolean;
  strategicBase: Record<string, unknown>;
  /** Recent user lines from `_limbic_interview_v1` for grounding (no new invented actors). */
  traceUserTurns?: { role: string; summary: string }[];
}): StrategicValidationTurnContent {
  const {
    miniStep,
    userText,
    challengeType,
    otherChallenge,
    strategicBase,
    traceUserTurns = [],
  } = params;
  const bank = questionForMiniStep(miniStep, challengeType, otherChallenge);

  if (miniStep === "audience") {
    const strategicBlobLower = blobFromContext(userText, strategicBase);
    const resolved = resolveAudienceMultiActorStrategicTurn({
      userText,
      traceUserTurns,
      strategicBaseLowerBlob: strategicBlobLower,
      strategicBase,
      bankQuestion: bank,
    });
    if (resolved) {
      return {
        interviewer_message: resolved.interviewer_message,
        next_question: resolved.next_question,
        suggested_chips: resolved.suggested_chips,
        audience_recommendation_pending: resolved.audience_recommendation_pending,
      };
    }
  }

  if (miniStep === "evidence") {
    return {
      interviewer_message: `${genericProvisionalPreamble("evidence")} Lo que buscamos aquí sigue siendo material que respalde lo que dices (cifras, casos, trayectoria, testimonios, etc.), sin inventar pruebas.`,
      next_question: bank
        ? `Sigamos con evidencia: ${bank}`
        : `Sigamos con evidencia: ${GUIDED_QUESTION_EVIDENCE}`,
      suggested_chips: [...EVIDENCE_CLARIFICATION_SUGGESTED_CHIPS],
      audience_recommendation_pending: null,
    };
  }

  if (miniStep === "audience") {
    return {
      interviewer_message: `${audienceRecommendationAdvisorPreamble()} Solo uso actores que ya aparecieron en lo que contaste: no invento audiencias nuevas. Si quieres, dime en una frase a quién priorizarías y por qué, y lo contrastamos con lo que ya dijiste.`,
      next_question: bank
        ? `Volvamos a la pregunta: ${bank}`
        : "Volvamos a la pregunta del paso actual cuando puedas aportar el detalle.",
      suggested_chips: [],
      audience_recommendation_pending: null,
    };
  }

  return {
    interviewer_message: genericProvisionalPreamble(miniStep),
    next_question: bank
      ? `Volvamos a la pregunta: ${bank}`
      : "Volvamos a la pregunta del paso actual cuando puedas aportar el detalle.",
    suggested_chips: [],
    audience_recommendation_pending: null,
  };
}

export function buildStrategicValidationSyntheticExtraction(
  content: StrategicValidationTurnContent,
): IntakeExtractionOutput {
  return {
    extracted_response_updates: {},
    confidence_by_field: {},
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [...content.suggested_chips],
    answer_status: "missing_choice",
    target_response_paths: [],
    internal_notes: "strategic_validation_question",
    interviewer_message: content.interviewer_message,
    public_copy_allowed: false,
    user_intent: "strategic_validation_question",
  };
}

export function stripAudienceRecommendationPending(
  trace: LimbicInterviewTraceV1,
): LimbicInterviewTraceV1 {
  const { audience_recommendation_pending, ...rest } = trace;
  void audience_recommendation_pending;
  return rest as LimbicInterviewTraceV1;
}

export function buildAudienceRecommendationRejectExtraction(): IntakeExtractionOutput {
  return {
    extracted_response_updates: {},
    confidence_by_field: {},
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [],
    answer_status: "missing_choice",
    target_response_paths: [],
    internal_notes: "audience_recommendation_rejected",
    interviewer_message:
      "Entendido: no cerramos esa prioridad todavía. Afinemos entonces con precisión: entre los actores que ya mencionaste, ¿quién debe recibir primero el mensaje (quien abre o habilita) y quién necesita después el argumento de confianza?",
    public_copy_allowed: false,
    user_intent: "strategic_validation_question",
  };
}
