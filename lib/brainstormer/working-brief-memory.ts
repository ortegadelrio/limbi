/**
 * Extracción compacta de memoria de sesión (working brief v3).
 */

import type { ThinkingModelKey } from "@/lib/ai/thinking-models";
import type { BrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";
import { WEAK_CREATIVE_TERRITORY_FAMILIES_FORBIDDEN } from "@/lib/brainstormer/brainstormer-natural-voice";

export type BrainstormerCampaignStage =
  | "unknown"
  | "expectativa"
  | "prelanzamiento"
  | "lanzamiento"
  | "conversion"
  | "sostenimiento";

const CAMPAIGN_STAGE_FRAMEWORK_ES =
  "expectativa/prelanzamiento → lanzamiento/revelación → conversión/tráfico tienda → sostenimiento/retargeting";

export const CONVERSION_BRIDGE_TEMPLATE_ES =
  "concepto → sketch/anzuelo (expectativa) → producto real/categoría → landing/página → CTA → retargeting/sostenimiento";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(normalize(text)));
}

const USER_CONFUSION_PATTERNS: RegExp[] = [
  /\bno\s+entiendo\s+nada\s+de\s+lo\s+que\s+me\s+dices\b/,
  /\bno\s+entiendo\s+nada\b/,
  /\bno\s+entiendo\s+lo\s+que\s+me\s+dices\b/,
  /\bno\s+entiendo\s+la\s+respuesta\b/,
  /\bsigo\s+sin\s+entender\b/,
  /\btodav[ií]a\s+no\s+entiendo\b/,
  /\bno\s+lo\s+entiendo\s+todav[ií]a\b/,
  /\bsigo\s+perdido\b/,
  /\bme\s+sigo\s+perdiendo\b/,
  /\bno\s+entiendo\b/,
  /\bno\s+entendi\b/,
  /\bme\s+perdi\b/,
  /\bme\s+perd[ií]\b/,
  /\bno\s+me\s+est[aá]s?\s+explicando\s+bien\b/,
  /\bexplicame\s+mejor\b/,
  /\bexplic[aá]me\s+mejor\b/,
  /\bexplic[aá]melo\s+m[aá]s\s+f[aá]cil\b/,
  /\bno\s+me\s+queda\s+claro\s+todav[ií]a\b/,
  /\bno\s+me\s+queda\s+claro\b/,
  /\bd[ií]melo\s+en\s+palabras\s+simples\b/,
  /\bhablame\s+como\s+si\s+no\s+supiera\s+nada\b/,
  /\bhablame\s+mas\s+claro\b/,
  /\bh[aá]blame\s+m[aá]s\s+claro\b/,
  /\bbajalo\s+a\s+tierra\b/,
  /\bb[aá]jalo\s+a\s+tierra\b/,
  /\baterr[ií]zalo\s+m[aá]s\b/,
  /\baterriza(lo|me)?\s+m[aá]s\b/,
  /\bno\s+me\s+aterrizaste\b/,
  /\beso\s+sigue\s+raro\b/,
  /\beso\s+suena\s+raro\b/,
  /\bno\s+me\s+est[aá]s?\s+ayudando\b/,
  /\bque\s+quieres\s+decir\b/,
  /\bqu[eé]\s+quieres\s+decir\b/,
];

/** Frases de confusión del usuario — nunca son paraguas ni concepto. */
export function isUserConfusionPhrase(phrase: string): boolean {
  return hasAny(phrase, USER_CONFUSION_PATTERNS);
}

const AUDIENCE_STRATEGY_REQUEST_PATTERNS: RegExp[] = [
  /\ba\s+qui[eé]n\b.*\benfocad/,
  /\ba\s+qui[eé]n\s+le\s+hablamos\b/,
  /\bcu[aá]l\s+ser[ií]a\s+la\s+audiencia\b/,
  /\bpara\s+qu[eé]\s+p[uú]blico\b/,
  /\bqui[eé]n\s+deber[ií]a\s+comprar\b/,
  /\bqui[eé]n\s+es\s+el\s+target\b/,
  /\ba\s+qui[eé]n\s+va\s+dirigida\s+la\s+campa[nñ]a\b/,
  /\bqui[eé]n\s+es\s+la\s+audiencia\b/,
  /\bdefinir\s+(la\s+)?audiencia\b/,
  /\bsegmento\s+objetivo\b/,
  /\bp[uú]blico\s+objetivo\b/,
  /\btarget\s+audiencia\b/,
];

/** Pide audiencia/segmento estratégico — no es táctica prematura. */
export function isAudienceStrategyRequest(userMessage: string): boolean {
  return hasAny(userMessage, AUDIENCE_STRATEGY_REQUEST_PATTERNS);
}

/** Estado de proyecto o brief de lanzamiento — no es paraguas conceptual. */
export function isProjectStatusOrLaunchBriefMessage(msg: string): boolean {
  const t = normalize(msg);
  if (hasAny(t, [/\bme\s+falta\s+la\s+campa[nñ]a\b/, /\bfalta\s+la\s+campa[nñ]a\b/])) return true;
  if (hasAny(t, [/\bsitio\b/, /\bweb\b/, /\bpagina\b/, /\bp[aá]gina\b/])) {
    if (
      hasAny(t, [
        /\blisto\b/,
        /\bdesarrollad/,
        /\bterminad/,
        /\bsalir\s+al\s+aire\b/,
        /\blanzar\b/,
        /\bcampa[nñ]a\b/,
      ])
    ) {
      return true;
    }
  }
  if (hasAny(t, [/\bya\s+tengo\s+listo\b/, /\best[aá]\s+listo\s+para\s+salir\b/])) return true;
  return false;
}

function cleanPhrase(raw: string): string {
  return raw
    .replace(/^[\s"'«»""''\u201C\u201D\u2018\u2019]+|[\s"'«»""''.\u201C\u201D\u2018\u2019]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

function collectQuotedSegments(msg: string): string[] {
  const candidates: string[] = [];
  const patterns = [
    /"([^"]{3,200})"/g,
    /\u201C([^\u201D]{3,200})\u201D/g,
    /«([^»]{3,200})»/g,
    /'([^']{3,200})'/g,
    /\u2018([^\u2019]{3,200})\u2019/g,
  ];
  for (const p of patterns) {
    let m: RegExpExecArray | null;
    while ((m = p.exec(msg)) !== null) {
      if (m[1]?.trim()) candidates.push(m[1].trim());
    }
  }
  return candidates;
}

/** Extrae frase conceptual entre comillas (latinas, curvas o rectas). */
export function extractQuotedConceptCandidate(userMessage: string): string | null {
  const candidates: string[] = collectQuotedSegments(userMessage.trim());
  const msg = userMessage.trim();

  const thinkingMatch = msg.match(
    /(?:estaba\s+)?pensando\s+en\s+["\u201C«']?([^"»''.\u201D?]{3,200})["\u201D»']?/i,
  );
  if (thinkingMatch?.[1]) {
    candidates.push(thinkingMatch[1].trim());
  }

  for (const raw of candidates) {
    const cleaned = cleanPhrase(raw.replace(/\?\s*$/, ""));
    if (isValidConceptualUmbrellaCandidate(cleaned)) {
      return cleaned;
    }
  }
  return null;
}

/** Limpia paraguas ya guardado si quedó contaminado con pregunta o contexto del usuario. */
export function normalizeStoredConceptualUmbrella(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || isUserConfusionPhrase(trimmed)) return "";

  const fromQuotes = extractQuotedConceptCandidate(trimmed);
  if (fromQuotes && !isUserConfusionPhrase(fromQuotes)) return fromQuotes;

  if (isValidConceptualUmbrellaCandidate(trimmed)) {
    return cleanPhrase(trimmed);
  }

  const thinkingInner = trimmed.match(
    /(?:estaba\s+)?pensando\s+en\s+(.+?)(?:\s*\.\s*|\s*\?\s*|$)/i,
  );
  if (thinkingInner?.[1]) {
    const inner = extractQuotedConceptCandidate(thinkingInner[1]) ?? cleanPhrase(thinkingInner[1]);
    if (isValidConceptualUmbrellaCandidate(inner) && !isUserConfusionPhrase(inner)) return inner;
  }

  return "";
}

function normalizeForCompare(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** True si el paraguas guardado es el mensaje crudo del usuario (no una cita válida dentro del turno). */
export function storedUmbrellaMatchesUserMessage(
  storedUmbrella: string,
  userMessage: string,
): boolean {
  const u = normalizeForCompare(storedUmbrella);
  const m = normalizeForCompare(userMessage);
  if (!u || !m) return false;
  if (u === m) return true;

  const quoted = extractQuotedConceptCandidate(userMessage);
  if (quoted && normalizeForCompare(quoted) === u) return false;

  if (m.includes(u) && (isOperationalOrQuestionPhrase(m) || u.length / m.length > 0.72)) {
    return true;
  }

  if (u.includes(m) && m.length / u.length < 0.72) {
    return false;
  }

  return false;
}

/** Paraguas limpio solo desde brief confirmado — nunca desde last_user_message. */
export function resolveDisplayUmbrella(
  brief: BrainstormerWorkingBrief,
  lastUserMessage?: string,
): string {
  const raw = brief.confirmed_conceptual_umbrella.trim();
  if (!raw || isUserConfusionPhrase(raw)) return "";

  const candidate = normalizeStoredConceptualUmbrella(raw) || raw;
  if (!candidate || isUserConfusionPhrase(candidate)) return "";
  if (!isValidConceptualUmbrellaCandidate(candidate)) return "";

  if (lastUserMessage?.trim() && storedUmbrellaMatchesUserMessage(candidate, lastUserMessage)) {
    return "";
  }

  return candidate;
}

const CONCEPT_REJECTION_OR_ALTERNATIVES_PATTERNS: RegExp[] = [
  /\bno\s+me\s+gusta\b/,
  /\bno\s+me\s+convence\b/,
  /\bdame\s+otras?\s+opciones\b/,
  /\bdame\s+m[aá]s\s+opciones\b/,
  /\botra\s+propuesta\b/,
  /\botro\s+camino\b/,
  /\bno\s+esa\b/,
  /\besa\s+no\b/,
  /\bno\s+era\s+eso\b/,
  /\bno\s+me\s+refer[ií]a\b/,
  /\bte\s+estoy\s+pidiendo\s+otras?\s+opciones\b/,
  /\bte\s+estoy\s+pidiendo\s+alternativas\b/,
  /\bno\s+tomes\s+eso\s+como\s+concepto\b/,
  /\bno\s+esa\s+que\s+te\s+puse\b/,
  /\bquiero\s+ver\s+m[aá]s\s+rutas\b/,
  /\bqu[eé]\s+otras?\s+rutas\s+hay\b/,
  /\bprop[oó]n\s+otras?\s+opciones\s+de\s+concepto\b/,
  /\bdame\s+otros?\s+paraguas\b/,
  /\bdame\s+otros?\s+conceptos\b/,
  /\bno\s+esa\s+idea\b/,
  /\bno\s+ese\s+(insight|concepto|paraguas)\b/,
  /\botras?\s+rutas\s+de\s+concepto\b/,
  /\bopciones\s+de\s+concepto\b/,
];

/** Rechazo de propuesta o pedido explícito de alternativas de concepto — nunca es paraguas. */
export function isConceptRejectionOrAlternativeRequest(userMessage: string): boolean {
  const msg = userMessage.trim();
  if (!msg) return false;

  const t = normalize(msg);

  if (/\bme\s+gusta\s+m[aá]s\b/.test(t) && /\bir\s+directo\b/.test(t)) return false;
  if (/\bme\s+gusta\s+m[aá]s\b/.test(t) && /["«'\u2018\u2019]/.test(msg)) return false;
  if (
    /\b(me\s+gusta|confirmamos|quedamos\s+con|ese\s+es\s+el\s+paraguas)\b/.test(t) &&
    !/\bno\s+me\s+gusta\b/.test(t) &&
    !/\bdame\s+otras?\s+opciones\b/.test(t)
  ) {
    return false;
  }

  return hasAny(t, CONCEPT_REJECTION_OR_ALTERNATIVES_PATTERNS);
}

/** Usuario pide explícitamente reabrir opciones / otro paraguas. */
export function userExplicitlyRequestsNewOptions(userMessage: string): boolean {
  return hasAny(userMessage, [
    /\botras?\s+opciones\b/,
    /\balternativas\b/,
    /\botro(s)?\s+paraguas\b/,
    /\bnuevos?\s+conceptos\b/,
    /\bcambiar\s+el\s+concepto\b/,
    /\bexplorar\s+otras?\s+rutas\b/,
    /\bdame\s+mas\s+opciones\b/,
    /\bcomparar\s+otras\b/,
  ]);
}

export function userReferencesParaguasConfirmation(userMessage: string): boolean {
  return hasAny(userMessage, [
    /ese\s+ser[ií]a\s+el\s+paraguas/,
    /ese\s+es\s+el\s+paraguas/,
    /ese\s+concepto/,
  ]);
}

function userExplicitlyNamesNewUmbrella(userMessage: string): boolean {
  return hasAny(userMessage, [
    /(?:el\s+)?paraguas\s+(?:dijimos\s+que\s+)?(?:ser[ií]a|es|queda)\s*[:\-]/i,
    /(?:el\s+)?paraguas\s+(?:ser[ií]a|es)\s+["«]/i,
    /dejemos\s+["«]/i,
    /(?:me\s+gusta|confirmamos|quedamos\s+con)\s+["«]/i,
    /ese\s+es\s+el\s+(?:paraguas|concepto)\s*[:\-]/i,
  ]);
}

/** Preguntas operativas o pedidos que no son una idea/frase conceptual. */
export function isOperationalOrQuestionPhrase(phrase: string): boolean {
  const raw = phrase.trim();
  if (/^¿/.test(raw) || /\?\s*$/.test(raw)) return true;

  const t = normalize(raw);
  if (/^(que|qué|cual|cu[aá]l|como|cómo|donde|dónde|cuando|cu[aá]ndo|por\s+que|por\s+qué)\b/.test(t)) {
    return true;
  }
  if (/\b(y\s+)?como\s+(hago|lo\s+hago|hacemos|se\s+hace)\s+eso\b/.test(t)) {
    return true;
  }
  if (/\bcomo\s+(hago|lo\s+hago)\b/.test(t) && /\b(eso|ahora|siguiente)\b/.test(t)) {
    return true;
  }
  if (isUserConfusionPhrase(raw)) return true;

  if (isProjectStatusOrLaunchBriefMessage(raw)) return true;
  if (isConceptRejectionOrAlternativeRequest(raw)) return true;

  return hasAny(t, [
    /\bpero\s+sin\s+concepto\b/,
    /\bsin\s+concepto\s+creativ/,
    /\bno\s+me\s+diste\s+paraguas\b/,
    /\beso\s+est[aá]\s+muy\s+operativ/,
    /\bmuy\s+operativ/,
    /\bquiero\s+lanzar\b/,
    /\blanzar\s+(la\s+)?marca\b/,
    /\bmarca\s+nueva\b/,
    /\bporque\s+es\s+nueva\b/,
    /\bnecesito\s+definir\b/,
    /\bdefinir\s+un\s+mensaje\b/,
    /\bmensaje\s+conector\b/,
    /\bconector\s+de\s+toda\b/,
    /\bquiero\s+organizar\b/,
    /\bestaba\s+pensando\b/,
    /\bpensaba\s+en\b/,
    /\bque\s+piensas\b/,
    /\bqué\s+piensas\b/,
    /\bque\s+te\s+parece\b/,
    /\bque\s+opinas\b/,
    /\bcomo\s+lo\s+ves\b/,
    /\bque\s+etapa\b/,
    /\besto\s+que\s+etapa\b/,
    /\b(cual|cu[aá]l)\s+(es\s+la\s+)?ruta\b/,
    /\bruta\s+a\s+seguir\b/,
    /\bcomo\s+(lo\s+|ese\s+concepto\s+)?convertimos\b/,
    /\bconvertimos\b/,
    /\bconvertir\b/,
    /\bcompras?\b/,
    /\bventas?\b/,
    /\bcarrito\b/,
    /\blanding\b/,
    /\bcta\b/,
    /\btrafico\b/,
    /\bmonetiz/,
    /\btenemos\s+un\s+sketch\b/,
    /\bsketch\b.*\bexpectativa\b/,
    /\bproducto\s+falso\s+para\s+expectativa\b/,
  ]);
}

/** Solo frases que pueden ser paraguas/idea rectora (no preguntas ni operación). */
export function isValidConceptualUmbrellaCandidate(phrase: string): boolean {
  const cleaned = cleanPhrase(phrase.replace(/\?\s*$/, ""));
  if (cleaned.length < 4 || cleaned.length > 140) return false;
  if (isOperationalOrQuestionPhrase(cleaned)) return false;
  if (userReferencesParaguasConfirmation(cleaned)) return false;
  return true;
}

function findLastValidConceptualPhrase(excerpt: string): string | null {
  const blocks = excerpt.split(/\n\n+/).filter((b) => /^user:\s*/i.test(b.trim()));
  for (let i = blocks.length - 1; i >= 0; i--) {
    const content = blocks[i]!.replace(/^user:\s*/i, "").trim();
    if (isValidConceptualUmbrellaCandidate(content)) {
      return cleanPhrase(content.replace(/\?\s*$/, ""));
    }
  }
  return null;
}

/** Extrae paraguas/concepto confirmado del turno o del hilo reciente. */
export function extractConfirmedConceptualUmbrella(args: {
  userMessage: string;
  conversationExcerpt: string;
  priorUmbrella: string;
}): string | null {
  const msg = args.userMessage.trim();
  const excerpt = args.conversationExcerpt;

  if (hasAny(msg, [/no\s+me\s+gusta\s+el\s+paraguas/i])) return null;
  if (isUserConfusionPhrase(msg)) return null;
  if (isProjectStatusOrLaunchBriefMessage(msg)) return null;
  if (isConceptRejectionOrAlternativeRequest(msg)) return null;

  const quoted = extractQuotedConceptCandidate(msg);
  if (quoted) return quoted;

  const inlinePatterns: RegExp[] = [
    /(?:el\s+)?paraguas\s+(?:dijimos\s+que\s+)?(?:ser[ií]a|es|queda)\s*[:\-]?\s*["«]?(.+?)["»]?\s*$/i,
    /ese\s+es\s+el\s+(?:paraguas|concepto)\s*[:\-]?\s*["«]?(.+?)["»]?\s*$/i,
    /(?:me\s+gusta|confirmamos|quedamos\s+con)\s+["«]?(.+?)["»]?\s*$/i,
    /dejemos\s+["«]?(.+?)["»]?\s*$/i,
  ];

  for (const re of inlinePatterns) {
    const m = msg.match(re);
    if (m?.[1]) {
      const phrase = cleanPhrase(m[1]);
      if (isValidConceptualUmbrellaCandidate(phrase)) return phrase;
    }
  }

  if (userReferencesParaguasConfirmation(msg)) {
    const fromThread = findLastValidConceptualPhrase(excerpt);
    if (fromThread) return fromThread;
    if (args.priorUmbrella.trim() && isValidConceptualUmbrellaCandidate(args.priorUmbrella)) {
      return args.priorUmbrella.trim();
    }
    return null;
  }

  if (userExplicitlyNamesNewUmbrella(msg)) {
    const fromThread = findLastValidConceptualPhrase(excerpt);
    if (fromThread) return fromThread;
  }

  if (isConceptRejectionOrAlternativeRequest(msg)) return null;

  if (
    hasAny(msg, [
      /\bme\s+gusta\b/,
      /\bme\s+gusta\s+m[aá]s\b/,
      /\bconfirmamos\b/,
      /\bquedamos\s+con\b/,
    ])
  ) {
    const cleanedMsg = cleanPhrase(msg);
    if (isValidConceptualUmbrellaCandidate(cleanedMsg)) {
      return cleanedMsg;
    }
  }

  return null;
}

/** Señal compacta para rejected_paths cuando rechazan concepto o piden alternativas. */
export function extractRejectedConceptSignal(
  userMessage: string,
  priorUmbrella: string,
): string {
  const trimmed = userMessage.trim();
  if (!trimmed) return "Concepto o ruta rechazada por el usuario";
  const prior = priorUmbrella.trim();
  if (prior && /\bes[ea]\s+(insight|concepto|paraguas|propuesta|ruta|idea)\b/i.test(trimmed)) {
    return prior.length > 400 ? `${prior.slice(0, 397)}…` : prior;
  }
  return trimmed.length > 400 ? `${trimmed.slice(0, 397)}…` : trimmed;
}

/** Si ya hay paraguas, solo actualizar con concepto nuevo explícito o cita clara. */
export function shouldPersistConceptualUmbrellaUpdate(args: {
  priorUmbrella: string;
  candidate: string;
  userMessage: string;
}): boolean {
  const prior = args.priorUmbrella.trim();
  if (!isValidConceptualUmbrellaCandidate(args.candidate)) return false;
  if (isOperationalOrQuestionPhrase(args.candidate)) return false;
  if (isUserConfusionPhrase(args.candidate) || isUserConfusionPhrase(args.userMessage)) return false;

  if (!prior) return true;

  if (!isValidConceptualUmbrellaCandidate(prior)) return true;

  const priorNorm = normalizeStoredConceptualUmbrella(prior) || prior;
  const candidateNorm = normalize(args.candidate);
  if (candidateNorm && candidateNorm === normalize(priorNorm)) return false;

  if (userExplicitlyRequestsNewOptions(args.userMessage)) return true;
  if (userExplicitlyNamesNewUmbrella(args.userMessage)) return true;
  if (userReferencesParaguasConfirmation(args.userMessage)) return true;
  if (extractQuotedConceptCandidate(args.userMessage)) return true;

  return false;
}

export function extractConfirmedDecisions(args: {
  userMessage: string;
  umbrella: string | null;
}): string[] {
  const found: string[] = [];
  const msg = args.userMessage.trim();
  if (args.umbrella) {
    found.push(`Paraguas confirmado: ${args.umbrella}`);
  }
  if (hasAny(msg, [/ese\s+ser[ií]a\s+el\s+paraguas/, /ese\s+es\s+el\s+concepto/, /dejemos\s+/i, /quedamos\s+con/i])) {
    const trimmed = msg.length > 200 ? `${msg.slice(0, 197)}…` : msg;
    found.push(trimmed);
  }
  return found;
}

/** Intención semántica de conversión a compra (no solo frases exactas). */
export function isConversionBridgeRequest(userMessage: string): boolean {
  const t = normalize(userMessage);
  return hasAny(t, [
    /\bconverti(re|mos|r)\b.*\bcompra/,
    /\bcompras?\b.*\b(pagina|tienda|web|carrito)\b/,
    /\bcompras?\s+(dentro\s+de|en)\s+la\s+(pagina|tienda|web)/,
    /\bcomo\s+(lo\s+|ese\s+concepto\s+)?convertimos\b/,
    /\bcomo\s+lo\s+convertimos\b/,
    /\bcomo\s+llevamos\b.*\b(compra|venta|ventas|carrito|tienda|pagina|producto\s+real)\b/,
    /\bcomo\s+hacemos\s+que\s+(compren|esto\s+venda|esto\s+termine\s+en\s+ventas)\b/,
    /\btermin(e|a)\s+en\s+ventas\b/,
    /\bcomo\s+lo\s+llevamos\s+a\s+(compra|producto\s+real|carrito)\b/,
    /\bcomo\s+lo\s+aterrizamos\b.*\blanding\b/,
    /\bcomo\s+se\s+convierte\b.*\bpagina\b/,
    /\btrafico\s+a\s+tienda\b/,
    /\bvender\s+en\s+la\s+(pagina|tienda)\b/,
    /\bmonetiz/,
    /\bexpectativa\s+a\s+compra\b/,
    /\bcampana\s+a\s+venta\b/,
    /\bproducto\s+real\b.*\b(carrito|compra|pagina)\b/,
    /\blanding\b.*\b(compra|venta|cta|producto|carrito)\b/,
    /\b(compra|venta|cta|carrito)\b.*\blanding\b/,
    /\bcomo\s+lo\s+llevamos\s+a\s+compra\b/,
  ]);
}

export function inferCampaignStageFromContext(corpus: string): BrainstormerCampaignStage {
  const t = normalize(corpus);
  if (
    hasAny(t, [
      /expectativa/,
      /prelanzamiento/,
      /sketch/,
      /producto\s+falso/,
      /mockup/,
      /anzuelo/,
      /teaser/,
    ])
  ) {
    return "expectativa";
  }
  if (hasAny(t, [/sostenimiento/, /retargeting/, /comunidad/, /post\s*lanzamiento/])) {
    return "sostenimiento";
  }
  if (isConversionBridgeRequest(corpus) || hasAny(t, [/converti(re|mos|r).*compra/, /trafico\s+a\s+tienda/])) {
    return "conversion";
  }
  if (hasAny(t, [/lanzamiento/, /revelacion/, /reveal/, /ya\s+disponible/])) {
    return "lanzamiento";
  }
  if (hasAny(t, [/prelanzamiento/, /pre-lanzamiento/])) {
    return "prelanzamiento";
  }
  return "unknown";
}

export function isSketchOrFakeProductContext(corpus: string): boolean {
  return hasAny(corpus, [
    /\bsketch\b/,
    /producto\s+falso/,
    /producto\s+irreal/,
    /mock\s*up/,
    /pieza\s+de\s+expectativa/,
    /anzuelo\s+creativo/,
  ]);
}

export function buildConfirmedUmbrellaAnchor(brief: BrainstormerWorkingBrief, allowAlternatives: boolean): {
  anchor: string;
  extraForbidden: string[];
} {
  const umbrella = brief.confirmed_conceptual_umbrella.trim();
  if (!umbrella || allowAlternatives) {
    return { anchor: "", extraForbidden: [] };
  }
  return {
    anchor: ` (interno: paraguas confirmado «${umbrella}»; no reabrir alternativas en la respuesta)`,
    extraForbidden: [
      "otros paraguas alternativos",
      ...WEAK_CREATIVE_TERRITORY_FAMILIES_FORBIDDEN,
      "conceptualización",
      "desarrollo de contenido",
    ],
  };
}

export function campaignStageFrameworkLabel(): string {
  return CAMPAIGN_STAGE_FRAMEWORK_ES;
}

function buildConversionBridgeThinkingSuffix(
  thinkingPrimaryKey: ThinkingModelKey | null,
): string {
  switch (thinkingPrimaryKey) {
    case "explorer":
      return (
        " Enfoque (interno): mecanismo creativo — producto falso/gancho → deseo inesperado →" +
        " «esto no existe, pero esto sí» → producto real → compra como consecuencia;" +
        " no checklist e-commerce ni landing+CTA+testimonios como respuesta principal."
      );
    case "commercial":
      return (
        " Enfoque (interno): arquitectura de venta — sketch → landing → producto real → CTA → carrito;" +
        " objeción, prueba, oferta; retargeting si aplica."
      );
    case "architect":
      return " Enfoque (interno): flujo — etapas, jerarquía de mensajes, orden de página, secuencia.";
    case "empathic":
      return " Enfoque (interno): barrera/motivación — qué debe sentir o confiar el usuario para comprar.";
    case "symbolic":
      return " Enfoque (interno): recorrido narrativo/visual del paraguas dentro de la página.";
    default:
      return "";
  }
}

export function buildConversionBridgeObligation(
  brief: BrainstormerWorkingBrief,
  allowAlternatives: boolean,
  thinkingPrimaryKey: ThinkingModelKey | null = null,
): string {
  const { anchor } = buildConfirmedUmbrellaAnchor(brief, allowAlternatives);
  const umbrella = brief.confirmed_conceptual_umbrella.trim();
  const umbrellaRef = umbrella ? ` Paraguas «${umbrella}».` : "";
  const how = buildConversionBridgeThinkingSuffix(thinkingPrimaryKey);
  return `Convertir el concepto en acción de compra sin perder el paraguas confirmado.${umbrellaRef}${how}${anchor}`;
}

export function buildCampaignStageInquiryObligation(brief: BrainstormerWorkingBrief, allowAlternatives: boolean): string {
  const { anchor } = buildConfirmedUmbrellaAnchor(brief, allowAlternatives);
  const stage = brief.campaign_stage !== "unknown" ? brief.campaign_stage : "expectativa";
  const stageHint = ` Ubicar la pieza/idea del hilo en: ${stage} (marco: ${CAMPAIGN_STAGE_FRAMEWORK_ES}). Sketch/producto falso → expectativa/prelanzamiento salvo indicación contraria.`;
  return (
    `Responder «qué etapa de campaña es» desde el marco comercial (NO producción interna: nada de conceptualización/desarrollo de contenido).${stageHint}${anchor}`
  );
}
