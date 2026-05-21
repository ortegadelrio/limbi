/**
 * Control editorial post-generación — transversal a todos los modelos de pensamiento.
 */

import type { ThinkingModelKey } from "@/lib/ai/thinking-models";
import type {
  BrainstormerTurnIntent,
  BrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import type { BrainstormerTurnInterpretation } from "@/lib/brainstormer/turn-interpreter";
import { priorHasConfirmedConcept } from "@/lib/brainstormer/turn-interpreter";
import { GENERIC_TACTIC_PATTERNS } from "@/lib/brainstormer/conversation-contract";
import {
  brandDnaLacksCredibilityFromBlock,
  buildBrainstormerOutputFallback,
} from "@/lib/brainstormer/build-brainstormer-output-fallback";
import {
  assistantMessageHasVisibleLeaks,
  ensureUserFacingAssistantMessage,
  findVisibleLeakIssues,
} from "@/lib/brainstormer/sanitize-visible-assistant-message";
import { findInventedBrandNamingIssues } from "@/lib/brainstormer/brand-naming-guard";
import {
  isUserConfusionPhrase,
  isValidConceptualUmbrellaCandidate,
  resolveDisplayUmbrella,
  storedUmbrellaMatchesUserMessage,
} from "@/lib/brainstormer/working-brief-memory";

function resolvedUmbrellaForValidation(
  brief: BrainstormerWorkingBrief,
  lastUserMessage?: string,
  interpretation?: BrainstormerTurnInterpretation,
): string {
  if (interpretation) {
    return brief.confirmed_conceptual_umbrella.trim();
  }
  return resolveDisplayUmbrella(brief, lastUserMessage);
}

export type ValidateBrainstormerOutputQualityArgs = {
  assistant_message: string;
  turn_intent: BrainstormerTurnIntent;
  thinking_model_key: ThinkingModelKey;
  /** Cuando la sesión usa Limbi, lente primario resuelto. */
  resolved_primary_model_key?: ThinkingModelKey | null;
  working_brief: BrainstormerWorkingBrief;
  brand_dna?: string | null;
  last_user_message?: string;
  brand_name?: string;
  /** Autoridad del turno — valida sin re-interpretar el mensaje del usuario. */
  turn_interpretation?: BrainstormerTurnInterpretation;
};

export type BrainstormerOutputQualityResult = {
  ok: boolean;
  issues: string[];
  repair_instruction?: string;
};

/** Frases de concepto genérico que deben fallar siempre. */
export const GENERIC_CONCEPT_CLICHE_PATTERNS: readonly RegExp[] = [
  /descubre lo inesperado/i,
  /lo inesperado en lo cotidiano/i,
  /curiosidad creativa/i,
  /redescubre lo cotidiano/i,
  /explora lo extraordinario/i,
  /descubre lo curioso/i,
  /viaje de descubrimiento/i,
];

/** Puente Disruptor obligatorio en conversion_bridge. */
export const DISRUPTOR_BRIDGE_PHRASE_PATTERNS: readonly RegExp[] = [
  /esto no existe/i,
  /no existe,?\s+pero/i,
  /no existe pero/i,
  /esto si\b/i,
  /esto sí\b/i,
  /pero esto si/i,
  /pero esto sí/i,
];

const REPAIR_REPLACE_PREFIX =
  "REEMPLAZA por completo la respuesta anterior. No la edites ni la «mejores»: escribe una respuesta nueva que sustituya el texto deficiente.";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function countMatches(text: string, patterns: readonly RegExp[]): number {
  const t = normalize(text);
  return patterns.filter((p) => p.test(t)).length;
}

function containsAny(text: string, patterns: readonly RegExp[]): boolean {
  return countMatches(text, patterns) > 0;
}

export function brandDnaLacksCredibilityEvidence(brand_dna: string | null | undefined): boolean {
  if (!brand_dna?.trim()) return true;
  return /solo pruebas|no inventar casos|no inventar pruebas/i.test(brand_dna);
}

const GENERIC_TERRITORY_MARKERS: readonly RegExp[] = [
  /\bdescubrimiento\b/i,
  /\bdescubre\b/i,
  /\bcuriosidad\b/i,
  /\bcurioso\b/i,
  /\bjoyas ocultas\b/i,
  /\bdescubrimientos recomendados\b/i,
  /\bproductos unicos\b/i,
  /\bproductos únicos\b/i,
  /\bexperiencia unica\b/i,
  /\bexperiencia única\b/i,
  /\baventura\b/i,
  /\bextraordinari[oa]\b/i,
];

const DISRUPTOR_CONVERSION_AXIS_BAD: readonly RegExp[] = [
  /\blo inesperado\b/i,
  /\bseccion\b.*\binesperad/i,
  /\bproducto misterioso\b/i,
  /\bproducto del misterio\b/i,
  /\blanding generica\b/i,
  /\blanding genérica\b/i,
  /\bcta generico\b/i,
  /\bcta genérico\b/i,
  ...GENERIC_TERRITORY_MARKERS,
];

const DISRUPTOR_CONVERSION_REQUIRED: readonly RegExp[] = [
  /\b(producto falso|gancho creativo|gancho de expectativa)\b/i,
  /\bdeseo inesperado\b/i,
  /\bproducto real\b/i,
  /\bcompra\b/i,
];

const DISRUPTOR_CONVERSION_DOMINANCE_BAD: readonly RegExp[] = [
  /\btestimonios\b/i,
  /\bproducto del dia\b/i,
  /\bproducto del día\b/i,
  /\bdescubrimientos recomendados\b/i,
  /\bjoyas ocultas\b/i,
  /\bgamificacion\b/i,
  /\bgamificación\b/i,
  /\bteasers?\s+visuales?\b/i,
];

const COMMERCIAL_CONVERSION_SIGNALS: readonly RegExp[] = [
  /\bproducto real\b/i,
  /\blanding\b/i,
  /\b(pagina|página)\b/i,
  /\bcta\b/i,
  /\bcarrito\b/i,
  /\bcompra\b/i,
  /\bobjecion\b/i,
  /\bobjeción\b/i,
  /\bfriccion\b/i,
  /\bfricción\b/i,
];

const COMMERCIAL_FABRICATED_PROOF: readonly RegExp[] = [
  /\btestimonios\b/i,
  /\btestimonio\b/i,
  /\bresenas verificadas\b/i,
  /\breseñas verificadas\b/i,
  /\bresenas de clientes\b/i,
  /\breseñas de clientes\b/i,
  /\bclientes satisfechos\b/i,
  /\b5 estrellas\b/i,
  /\bcientos de resenas\b/i,
  /\bcientos de reseñas\b/i,
];

const COMMERCIAL_FUTURE_PROOF_OK: readonly RegExp[] = [
  /\bcuando existan\b/i,
  /\bcuando haya\b/i,
  /\breacciones reales\b/i,
  /\bhipotesis\b/i,
  /\bhipótesis\b/i,
  /\bfutur[oa]\b/i,
  /\bsimulad[oa]\b/i,
  /\bprueba futura\b/i,
];

const COMMERCIAL_DISCOUNT_CENTER: readonly RegExp[] = [
  /\bdescuento como\b/i,
  /\bcon un descuento\b/i,
  /\bofrecemos descuento\b/i,
  /\bcupon del\b/i,
  /\bcupón del\b/i,
  /\bfree shipping\b/i,
  /\benvio gratis\b/i,
  /\benvío gratis\b/i,
];

const CONCEPTUAL_POSTURE_MARKERS: readonly RegExp[] = [
  /\bparaguas\b/i,
  /\bconcepto\b/i,
  /\bidea (madre|rectora|fuerza)\b/i,
  /\bmensaje (conector|central|rector)\b/i,
  /\bpor que funciona\b/i,
  /\bpor qué funciona\b/i,
  /\bese es el paraguas\b/i,
  /\bno lo cambiaria\b/i,
  /\bno lo cambiaría\b/i,
  /\btom(ar|o)\s+postura\b/i,
  /\bvalido\b/i,
  /\bvalidó\b/i,
];

const EXPECTATION_MECHANISM_MARKERS: readonly RegExp[] = [
  /\bque ocultamos\b/i,
  /\bque revelamos\b/i,
  /\bque escondemos\b/i,
  /\btension\b/i,
  /\btensión\b/i,
  /\bquier[ea] seguir\b/i,
  /\bgancho de expectativa\b/i,
  /\bproducto falso\b/i,
  /\bsketch\b/i,
  /\banzuelo\b/i,
  /\binstalamos\b/i,
];

const EXPECTATION_TEASER_ONLY_BAD: readonly RegExp[] = [
  /\bteasers?\s+visuales?\b/i,
  /\bteasers?\s+como\b/i,
  /\bsolo teasers\b/i,
  /\bcuriosidad\b/i,
  /\bdescubrimiento\b/i,
];

export function resolveValidationThinkingKey(args: {
  thinking_model_key: ThinkingModelKey;
  resolved_primary_model_key?: ThinkingModelKey | null;
}): ThinkingModelKey {
  if (args.thinking_model_key === "limbi") {
    return args.resolved_primary_model_key ?? "limbi";
  }
  return args.thinking_model_key;
}

export function hasDisruptorBridgePhrase(message: string): boolean {
  return containsAny(message, DISRUPTOR_BRIDGE_PHRASE_PATTERNS);
}

function validateRawUserMessageAsConceptAnchor(
  message: string,
  args: ValidateBrainstormerOutputQualityArgs,
): string[] {
  const issues: string[] = [];
  const last = args.last_user_message?.trim() ?? "";
  if (!last || last.length < 8) return issues;

  const nLast = normalize(last);
  const nMsg = normalize(message);

  if (
    /\byo\s+trabajar[ií]a\s+«/.test(nMsg) ||
    /\bseguir[ií]a\s+con\s+«/.test(nMsg) ||
    /\bcomo\s+eje\s+de\s+la\s+campa[nñ]a\b/.test(nMsg)
  ) {
    if (nMsg.includes(nLast.slice(0, Math.min(32, nLast.length)))) {
      issues.push("Usa el mensaje del usuario como eje o paraguas de campaña.");
    }
  }

  const briefUmbrella = args.working_brief.confirmed_conceptual_umbrella.trim();
  const authorizedUmbrella = Boolean(
    args.turn_interpretation?.memory_update.update_umbrella &&
      args.turn_interpretation.memory_update.umbrella_candidate?.trim(),
  );

  if (!authorizedUmbrella) {
    const quotedUser =
      nMsg.includes(`«${nLast}»`) ||
      nMsg.includes(`"${last}"`) ||
      nMsg.includes(`'${last}'`);
    if (quotedUser && !isValidConceptualUmbrellaCandidate(last)) {
      issues.push("Cita el mensaje completo del usuario como paraguas o concepto.");
    }
  }

  if (
    (args.turn_interpretation?.response_mode === "explain_simple" ||
      args.turn_interpretation?.conversation_act === "user_confusion") &&
    (/\bmi\s+paraguas\s+ser[ií]a\b/.test(nMsg) || /\bpropondr[ií]a\s+«/.test(nMsg))
  ) {
    issues.push("En confusión no debe proponer un eje creativo nuevo.");
  }

  if (briefUmbrella && storedUmbrellaMatchesUserMessage(briefUmbrella, last)) {
    issues.push("Paraguas confirmado coincide con el mensaje del usuario (no autorizado).");
  }

  return issues;
}

function validateAgainstInterpretation(
  message: string,
  args: ValidateBrainstormerOutputQualityArgs,
): string[] {
  const interp = args.turn_interpretation;
  if (!interp) return [];

  const issues: string[] = [];
  if (
    (interp.conversation_act === "rejecting_concept" ||
      interp.conversation_act === "asking_alternatives" ||
      interp.response_mode === "propose_alternatives") &&
    /\bese\s+es\s+el\s+paraguas\b/i.test(message) &&
    /\bno\s+lo\s+cambiar[ií]a\b/i.test(message)
  ) {
    issues.push("Defiende paraguas cuando el usuario pidió rechazo o alternativas.");
  }

  if (interp.response_mode === "explain_simple" && isUserConfusionPhrase(args.last_user_message ?? "")) {
    const confusion = args.last_user_message?.trim() ?? "";
    if (confusion.length >= 8 && normalize(message).includes(normalize(confusion).slice(0, 20))) {
      issues.push("Usa la frase de confusión del usuario como eje.");
    }
  }

  return issues;
}

function validateUniversal(
  message: string,
  args: ValidateBrainstormerOutputQualityArgs,
): string[] {
  const issues: string[] = [];

  issues.push(...findVisibleLeakIssues(message));
  issues.push(
    ...findInventedBrandNamingIssues(message, args.brand_name, args.last_user_message),
  );
  issues.push(...validateRawUserMessageAsConceptAnchor(message, args));
  issues.push(...validateAgainstInterpretation(message, args));

  const umbrella = resolvedUmbrellaForValidation(
    args.working_brief,
    args.last_user_message,
    args.turn_interpretation,
  );
  if (
    umbrella &&
    isValidConceptualUmbrellaCandidate(umbrella) &&
    priorHasConfirmedConcept(args.working_brief) &&
    /\byo\s+trabajar[ií]a\s+«[^»]{3,120}»\s+como\s+eje/i.test(message) &&
    !normalize(message).includes(normalize(umbrella).slice(0, 12))
  ) {
    const wrongQuote = message.match(/yo\s+trabajar[ií]a\s+«([^»]+)»/i)?.[1]?.trim();
    if (wrongQuote && storedUmbrellaMatchesUserMessage(wrongQuote, args.last_user_message ?? "")) {
      issues.push("Contradice el paraguas confirmado usando el mensaje del usuario como eje.");
    }
  }

  return issues;
}

function validateConversionBridgeDisruptor(message: string): string[] {
  const issues: string[] = [];
  const requiredHits = countMatches(message, DISRUPTOR_CONVERSION_REQUIRED);
  const axisBad = countMatches(message, DISRUPTOR_CONVERSION_AXIS_BAD);
  const dominanceBad = countMatches(message, DISRUPTOR_CONVERSION_DOMINANCE_BAD);

  if (!hasDisruptorBridgePhrase(message)) {
    issues.push('Falta puente explícito tipo «esto no existe, pero esto sí» (o equivalente claro).');
  }
  if (requiredHits < 3) {
    issues.push(
      "Falta mecanismo creativo completo: producto falso/gancho + deseo inesperado + producto real + compra como consecuencia.",
    );
  }
  if (axisBad >= 1 && requiredHits < 3) {
    issues.push(
      "Eje genérico (lo inesperado, curiosidad, descubrimiento, landing/CTA genérico) en lugar del mecanismo creativo.",
    );
  }
  if (dominanceBad >= 2 && requiredHits < 3) {
    issues.push("Dominada por fórmulas e-commerce/teasers en lugar del mecanismo creativo.");
  }
  if (/\b(producto falso|gancho)\b/i.test(message) === false) {
    issues.push("Falta producto falso o gancho creativo de expectativa.");
  }
  if (!/\bdeseo inesperado\b/i.test(message)) {
    issues.push("Falta deseo inesperado como motor de la conversión.");
  }
  return issues;
}

function validateConversionBridgeCommercial(
  message: string,
  brand_dna: string | null | undefined,
): string[] {
  const issues: string[] = [];
  const signalCount = countMatches(message, COMMERCIAL_CONVERSION_SIGNALS);

  if (signalCount < 4) {
    issues.push(
      "Falta arquitectura de venta (producto real, landing/página, CTA, carrito/compra, fricción u objeción).",
    );
  }
  if (!/\bproducto real\b/i.test(message)) {
    issues.push("Falta producto real en el puente comercial.");
  }
  if (!/\b(landing|pagina|página)\b/i.test(message) || !/\b(cta|carrito|compra)\b/i.test(message)) {
    issues.push("Falta landing/página y CTA o carrito/compra.");
  }
  if (!/\b(objecion|objeción|friccion|fricción)\b/i.test(message)) {
    issues.push("Falta fricción u objeción explícita.");
  }

  const noEvidence = brandDnaLacksCredibilityEvidence(brand_dna);
  const claimsProof = containsAny(message, COMMERCIAL_FABRICATED_PROOF);
  const framesFuture = containsAny(message, COMMERCIAL_FUTURE_PROOF_OK);

  if (noEvidence && claimsProof && !framesFuture) {
    issues.push(
      "Afirma testimonios/reseñas como hechos sin evidencia en Base de Marca; usar «cuando existan reseñas» o reacciones reales futuras.",
    );
  }

  if (containsAny(message, COMMERCIAL_DISCOUNT_CENTER) && !/\b(opcion|opción|si aplica|podria|podría)\b/i.test(message)) {
    issues.push("Usa descuento/cupón como fórmula central sin justificarlo como opción secundaria.");
  }

  if (!/\bconcepto|paraguas|deseo\b/i.test(message) && !/\bproducto real\b/i.test(message)) {
    issues.push("No conecta concepto → deseo → producto real → acción.");
  }
  return issues;
}

function validateConceptualStrategy(message: string): string[] {
  const issues: string[] = [];
  if (containsAny(message, GENERIC_CONCEPT_CLICHE_PATTERNS)) {
    issues.push("Propone concepto genérico de categoría; buscar idea más propia o validar la del usuario.");
  }
  if (countMatches(message, CONCEPTUAL_POSTURE_MARKERS) < 2) {
    issues.push("No toma postura sobre idea rectora ni explica por qué funciona.");
  }
  if (countMatches(message, GENERIC_TACTIC_PATTERNS) >= 2) {
    issues.push("Baja a tácticas (calendario, teasers, influencers) sin concepto resuelto.");
  }
  if (countMatches(message, EXPECTATION_TEASER_ONLY_BAD) >= 2 && countMatches(message, CONCEPTUAL_POSTURE_MARKERS) < 2) {
    issues.push("Responde con teasers/curiosidad en lugar de idea rectora.");
  }
  return issues;
}

function validateCampaignExpectation(message: string, brief: BrainstormerWorkingBrief): string[] {
  const issues: string[] = [];
  const mechanismCount = countMatches(message, EXPECTATION_MECHANISM_MARKERS);
  const teaserOnly =
    countMatches(message, EXPECTATION_TEASER_ONLY_BAD) >= 2 && mechanismCount < 2;

  if (teaserOnly) {
    issues.push("Expectativa reducida a teasers/curiosidad; falta mecanismo de tensión.");
  }
  if (mechanismCount < 2) {
    issues.push(
      "Falta mecanismo de expectativa: qué ocultamos/revelamos, tensión instalada y por qué la gente quiere seguir.",
    );
  }
  const umbrella = resolvedUmbrellaForValidation(brief);
  if (umbrella) {
    const t = normalize(message);
    const tok = normalize(umbrella).split(/\s+/).find((w) => w.length > 4);
    if (tok && !t.includes(tok)) {
      issues.push("No conecta la expectativa con el paraguas confirmado.");
    }
  }
  return issues;
}

function validateByModel(
  message: string,
  effectiveKey: ThinkingModelKey,
  turn_intent: BrainstormerTurnIntent,
): string[] {
  const issues: string[] = [];

  switch (effectiveKey) {
    case "explorer":
      if (
        turn_intent !== "conversion_bridge" &&
        !/\b(ruptura|iron[ií]a|deseo inesperado|contraste|conversable)\b/i.test(message)
      ) {
        if (countMatches(message, GENERIC_TERRITORY_MARKERS) >= 1) {
          issues.push("Disruptor: falta filo (ruptura, ironía, deseo inesperado o idea conversable).");
        }
      }
      break;
    case "architect":
      if (
        !/\b(secuencia|fases?|etapas?|jerarquia|jerarquía|arquitectura|orden)\b/i.test(message) &&
        ["next_step", "conversion_bridge", "launch_strategy"].includes(turn_intent)
      ) {
        issues.push("Planner: falta arquitectura, secuencia o jerarquía de mensajes.");
      }
      break;
    case "empathic":
      if (
        !/\b(audiencia|barrera|motivacion|motivación|confianza|persona|emocion|emoción)\b/i.test(message) &&
        ["conversion_bridge", "conceptual_strategy_request"].includes(turn_intent)
      ) {
        issues.push("Empático: falta audiencia, barrera o motivación humana.");
      }
      break;
    case "symbolic":
      if (
        !/\b(metáfora|metafora|simbolo|símbolo|narrativa|territorio|universo)\b/i.test(message) &&
        ["conceptual_strategy_request", "strategic_concept"].includes(turn_intent)
      ) {
        issues.push("Conceptual: falta territorio narrativo, metáfora o símbolo.");
      }
      break;
    default:
      break;
  }

  return issues;
}

function buildRepairInstruction(
  issues: string[],
  args: ValidateBrainstormerOutputQualityArgs,
): string | undefined {
  if (issues.length === 0) return undefined;

  if (issues.some((i) => /Inventa nombre|Propone marca/i.test(i)) && args.brand_name?.trim()) {
    return (
      `${REPAIR_REPLACE_PREFIX} No inventes un nombre de marca distinto. La marca de la sesión es «${args.brand_name.trim()}». ` +
      "Responde sobre esa marca real."
    );
  }

  if (issues.some((i) => /mensaje del usuario como eje|como paraguas|confusión del usuario/i.test(i))) {
    return (
      `${REPAIR_REPLACE_PREFIX} No uses el mensaje del usuario como paraguas ni eje de campaña. ` +
      "Responde en prosa directa a su pregunta; si no entiende, explica más simple sin proponer un concepto nuevo."
    );
  }

  return (
    `${REPAIR_REPLACE_PREFIX} Corrige: ${issues.slice(0, 2).join(" ")}. ` +
    "Responde como consultor: claro, directo, sin citar el mensaje del usuario como concepto."
  );
}

export function validateBrainstormerOutputQuality(
  args: ValidateBrainstormerOutputQualityArgs,
): BrainstormerOutputQualityResult {
  const message = args.assistant_message.trim();

  const issues: string[] = [...validateUniversal(message, args)];

  const uniqueIssues = [...new Set(issues)];
  const ok = uniqueIssues.length === 0;
  return {
    ok,
    issues: uniqueIssues,
    repair_instruction: ok ? undefined : buildRepairInstruction(uniqueIssues, args),
  };
}

export type BrainstormerOutputQualityGateResult = {
  assistant_message: string;
  quality: BrainstormerOutputQualityResult;
  repair_attempted: boolean;
  repair_used: boolean;
  /** true si se reparó pero la validación sigue fallando (antes del fallback) */
  repair_still_failed: boolean;
  /** true si se aplicó respuesta mínima interna tras fallo de reparación */
  fallback_used: boolean;
  /** issues detectados antes de reparar (si hubo intento) */
  pre_repair_issues: string[];
};

export type BrainstormerOutputRepairInput = {
  original_assistant_message: string;
  repair_instruction: string;
  last_user_message: string;
  working_brief_block: string;
  thinking_model_block: string;
};

function buildFallbackMessage(args: Parameters<typeof applyBrainstormerOutputQualityGate>[0]): string {
  return buildBrainstormerOutputFallback(
    {
      turn_intent: args.turn_intent,
      thinking_model_key: args.thinking_model_key,
      resolved_primary_model_key: args.resolved_primary_model_key,
      working_brief: args.working_brief,
      last_user_message: args.last_user_message,
      interpretation: args.turn_interpretation,
    },
    {
      brand_dna_lacks_evidence: brandDnaLacksCredibilityFromBlock(args.brand_dna),
      brand_dna: args.brand_dna,
      brand_name: args.brand_name,
    },
  );
}

function validateForGate(
  message: string,
  args: Parameters<typeof applyBrainstormerOutputQualityGate>[0],
): BrainstormerOutputQualityResult {
  return validateBrainstormerOutputQuality({
    assistant_message: message,
    turn_intent: args.turn_intent,
    thinking_model_key: args.thinking_model_key,
    resolved_primary_model_key: args.resolved_primary_model_key,
    working_brief: args.working_brief,
    brand_dna: args.brand_dna,
    last_user_message: args.last_user_message,
    brand_name: args.brand_name,
    turn_interpretation: args.turn_interpretation,
  });
}

function applyControlledFallback(
  args: Parameters<typeof applyBrainstormerOutputQualityGate>[0],
  preRepairIssues: string[],
  repairFlags: { attempted: boolean; used: boolean; stillFailed: boolean },
): BrainstormerOutputQualityGateResult {
  const ensured = ensureUserFacingAssistantMessage({
    message: buildFallbackMessage(args),
    buildSafeFallback: () => buildFallbackMessage(args),
  });
  const fallbackMessage = ensured.message;
  const fallbackQuality = validateForGate(fallbackMessage, args);

  if (!fallbackQuality.ok || ensured.replaced) {
    // eslint-disable-next-line no-console
    console.warn("[brainstormer] fallback validation failed", {
      issues: fallbackQuality.issues,
      visible_sanitize: ensured.replaced,
      used_absolute_safe: ensured.usedAbsoluteSafe,
    });
  }

  return {
    assistant_message: fallbackMessage,
    quality: fallbackQuality,
    repair_attempted: repairFlags.attempted,
    repair_used: repairFlags.used,
    repair_still_failed: repairFlags.stillFailed,
    fallback_used: true,
    pre_repair_issues: preRepairIssues,
  };
}

function finalizeVisibleMessage(
  message: string,
  args: Parameters<typeof applyBrainstormerOutputQualityGate>[0],
  preRepairIssues: string[],
  repairFlags: {
    attempted: boolean;
    used: boolean;
    stillFailed: boolean;
    fallbackUsed: boolean;
  },
): BrainstormerOutputQualityGateResult {
  const ensured = ensureUserFacingAssistantMessage({
    message,
    buildSafeFallback: () => buildFallbackMessage(args),
  });
  if (ensured.replaced) {
    return applyControlledFallback(args, preRepairIssues, {
      attempted: repairFlags.attempted,
      used: repairFlags.used,
      stillFailed: true,
    });
  }
  const quality = validateForGate(ensured.message, args);
  return {
    assistant_message: ensured.message,
    quality,
    repair_attempted: repairFlags.attempted,
    repair_used: repairFlags.used,
    repair_still_failed: repairFlags.stillFailed && !repairFlags.fallbackUsed,
    fallback_used: repairFlags.fallbackUsed,
    pre_repair_issues: preRepairIssues,
  };
}

/**
 * Valida la salida; si falla, repara una vez; si la reparación sigue fallando, aplica fallback interno.
 */
export async function applyBrainstormerOutputQualityGate(args: {
  assistant_message: string;
  turn_intent: BrainstormerTurnIntent;
  thinking_model_key: ThinkingModelKey;
  resolved_primary_model_key?: ThinkingModelKey | null;
  working_brief: BrainstormerWorkingBrief;
  last_user_message: string;
  working_brief_block: string;
  thinking_model_block: string;
  brand_dna?: string | null;
  brand_name?: string;
  turn_interpretation?: BrainstormerTurnInterpretation;
  generateRepair?: (input: BrainstormerOutputRepairInput) => Promise<string>;
}): Promise<BrainstormerOutputQualityGateResult> {
  const quality = validateBrainstormerOutputQuality({
    assistant_message: args.assistant_message,
    turn_intent: args.turn_intent,
    thinking_model_key: args.thinking_model_key,
    resolved_primary_model_key: args.resolved_primary_model_key,
    working_brief: args.working_brief,
    brand_dna: args.brand_dna,
    last_user_message: args.last_user_message,
    brand_name: args.brand_name,
    turn_interpretation: args.turn_interpretation,
  });

  if (quality.ok && !assistantMessageHasVisibleLeaks(args.assistant_message)) {
    return finalizeVisibleMessage(args.assistant_message, args, [], {
      attempted: false,
      used: false,
      stillFailed: false,
      fallbackUsed: false,
    });
  }

  const preRepairIssues = quality.issues;

  if (!quality.repair_instruction || !args.generateRepair) {
    return applyControlledFallback(args, preRepairIssues, {
      attempted: false,
      used: false,
      stillFailed: true,
    });
  }

  try {
    const repairedMessage = (
      await args.generateRepair({
        original_assistant_message: args.assistant_message,
        repair_instruction: quality.repair_instruction,
        last_user_message: args.last_user_message,
        working_brief_block: args.working_brief_block,
        thinking_model_block: args.thinking_model_block,
      })
    ).trim();

    if (repairedMessage.length < 20) {
      return applyControlledFallback(args, preRepairIssues, {
        attempted: true,
        used: false,
        stillFailed: true,
      });
    }

    const repairQuality = validateBrainstormerOutputQuality({
      assistant_message: repairedMessage,
      turn_intent: args.turn_intent,
      thinking_model_key: args.thinking_model_key,
      resolved_primary_model_key: args.resolved_primary_model_key,
      working_brief: args.working_brief,
      brand_dna: args.brand_dna,
      last_user_message: args.last_user_message,
      brand_name: args.brand_name,
      turn_interpretation: args.turn_interpretation,
    });

    if (repairQuality.ok && !assistantMessageHasVisibleLeaks(repairedMessage)) {
      return finalizeVisibleMessage(repairedMessage, args, preRepairIssues, {
        attempted: true,
        used: true,
        stillFailed: false,
        fallbackUsed: false,
      });
    }

    return applyControlledFallback(args, preRepairIssues, {
      attempted: true,
      used: true,
      stillFailed: true,
    });
  } catch {
    return applyControlledFallback(args, preRepairIssues, {
      attempted: true,
      used: false,
      stillFailed: true,
    });
  }
}
