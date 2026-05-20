/**
 * Control editorial post-generación — transversal a todos los modelos de pensamiento.
 */

import type { ThinkingModelKey } from "@/lib/ai/thinking-models";
import type {
  BrainstormerTurnIntent,
  BrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { GENERIC_TACTIC_PATTERNS } from "@/lib/brainstormer/conversation-contract";
import {
  brandDnaLacksCredibilityFromBlock,
  buildBrainstormerOutputFallback,
} from "@/lib/brainstormer/build-brainstormer-output-fallback";
import {
  assistantMessageHasVisibleLeaks,
  findVisibleLeakIssues,
} from "@/lib/brainstormer/sanitize-visible-assistant-message";
import { normalizeStoredConceptualUmbrella } from "@/lib/brainstormer/working-brief-memory";

function resolvedUmbrellaForValidation(
  brief: BrainstormerWorkingBrief,
  lastUserMessage?: string,
): string {
  const raw = brief.confirmed_conceptual_umbrella.trim();
  return normalizeStoredConceptualUmbrella(raw, lastUserMessage) || raw;
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

function validateUniversal(
  message: string,
  args: ValidateBrainstormerOutputQualityArgs,
  effectiveKey: ThinkingModelKey,
): string[] {
  const issues: string[] = [];
  const t = normalize(message);

  if (message.trim().length < 40) {
    issues.push("Respuesta demasiado corta o sin avance útil.");
  }

  issues.push(...findVisibleLeakIssues(message));

  if (containsAny(message, GENERIC_CONCEPT_CLICHE_PATTERNS)) {
    issues.push("Usa frase o concepto genérico de categoría (descubrimiento/inesperado vacío).");
  }

  if (args.last_user_message?.trim()) {
    const userNorm = normalize(args.last_user_message);
    const asksConversion = /\bcompra|venta|carrito|convertir|pagina\b/i.test(userNorm);
    const answersConversion = /\bcompra|producto real|landing|carrito|cta\b/i.test(t);
    const asksConcept = /\bconcepto|paraguas|mensaje conector|idea madre\b/i.test(userNorm);
    const answersConcept = CONCEPTUAL_POSTURE_MARKERS.some((p) => p.test(message));
    if (asksConversion && !answersConversion && args.turn_intent === "conversion_bridge") {
      issues.push("No responde al pedido de conversión/compra del usuario.");
    }
    if (asksConcept && !answersConcept && args.turn_intent === "conceptual_strategy_request") {
      issues.push("No responde al pedido conceptual del usuario.");
    }
  }

  const umbrella = args.working_brief.confirmed_conceptual_umbrella.trim();
  if (umbrella && !normalize(message).includes(normalize(umbrella).slice(0, 12))) {
    const umbrellaTokens = normalize(umbrella).split(/\s+/).filter((w) => w.length > 4);
    const hasToken = umbrellaTokens.some((tok) => t.includes(tok));
    if (!hasToken && countMatches(message, GENERIC_TERRITORY_MARKERS) >= 2) {
      issues.push(`No ancla al paraguas confirmado («${umbrella.slice(0, 80)}»).`);
    }
  }

  for (const rejected of args.working_brief.rejected_paths.slice(-3)) {
    const fragment = normalize(rejected).slice(0, 40);
    if (fragment.length > 12 && t.includes(fragment)) {
      issues.push("Retoma una ruta rechazada en sesión.");
      break;
    }
  }

  if (
    args.turn_intent !== "conversion_bridge" &&
    countMatches(message, GENERIC_TERRITORY_MARKERS) >= 2
  ) {
    issues.push("Lenguaje de territorio genérico (descubrimiento/curiosidad/joyas ocultas).");
  }

  if (
    (args.turn_intent === "conceptual_strategy_request" || args.turn_intent === "strategic_concept") &&
    countMatches(message, GENERIC_TACTIC_PATTERNS) >= 2 &&
    countMatches(message, CONCEPTUAL_POSTURE_MARKERS) === 0
  ) {
    issues.push("Baja a tácticas sin resolver el concepto pedido.");
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
  effectiveKey: ThinkingModelKey,
): string | undefined {
  if (issues.length === 0) return undefined;

  const umbrella = args.working_brief.confirmed_conceptual_umbrella.trim();
  const umbrellaNote = umbrella ? ` Paraguas confirmado: «${umbrella}».` : "";

  if (args.turn_intent === "conversion_bridge" && effectiveKey === "explorer") {
    return (
      `${REPAIR_REPLACE_PREFIX} Desde Disruptor: escribe UN mecanismo creativo de conversión. ` +
      "OBLIGATORIO incluir en el texto (puedes parafrasear, pero debe quedar claro): " +
      "(a) la frase «El producto falso abre la conversación; el producto real captura la compra» o equivalente; " +
      "(b) el puente «esto no existe, pero esto sí» o formulación equivalente muy explícita; " +
      "(c) producto falso o gancho de expectativa; (d) producto real o categoría real conectada; (e) acción hacia página/compra y deseo inesperado. " +
      "PROHIBIDO como eje: producto inusual, curiosidad, sorpresa, descubrimiento, landing genérica, CTA genérico, testimonios, teasers." +
      umbrellaNote
    );
  }

  if (args.turn_intent === "conversion_bridge" && effectiveKey === "commercial") {
    const proofNote = brandDnaLacksCredibilityEvidence(args.brand_dna)
      ? " OBLIGATORIO: producto real; landing o página; CTA; carrito o compra; objeción/fricción; prueba futura con «cuando existan reseñas verificadas» o «reacciones reales de usuarios» — NO testimonios ni reseñas como hechos. NO descuento/cupón como solución central."
      : " OBLIGATORIO: producto real; landing o página; CTA; carrito o compra; objeción/fricción; prueba (real o futura).";
    return (
      `${REPAIR_REPLACE_PREFIX} Desde Comercial: conecta concepto → deseo → producto real → landing/página → CTA → carrito → compra.` +
      proofNote +
      umbrellaNote
    );
  }

  if (args.turn_intent === "conceptual_strategy_request" || args.turn_intent === "strategic_concept") {
    const validateUserPhrase =
      umbrella && args.last_user_message && /no sab[ií]as|paraguas|concepto|mensaje conector/i.test(args.last_user_message)
        ? ` Si el usuario trae «${umbrella}» o una frase similar, DEBES decir explícitamente: «Ese es el paraguas. No lo cambiaría.» y explicar por qué funciona.`
        : "";
    return (
      `${REPAIR_REPLACE_PREFIX} Toma postura con UNA idea rectora (no «Descubre lo inesperado», «Lo inesperado en lo cotidiano», curiosidad creativa ni territorios genéricos). ` +
      "Explica por qué funciona y cómo ordena la campaña. Sin tácticas ni teasers." +
      validateUserPhrase +
      umbrellaNote
    );
  }

  if (args.turn_intent === "campaign_expectation" || args.turn_intent === "campaign_stage_inquiry") {
    return (
      `${REPAIR_REPLACE_PREFIX} Explica el mecanismo de expectativa con estas piezas en prosa: ` +
      "qué se oculta; qué se revela; qué tensión se instala; por qué la audiencia querría seguir; cómo conecta con el paraguas confirmado. " +
      "NO teasers visuales, curiosidad ni expectativa genérica como respuesta principal." +
      umbrellaNote
    );
  }

  return (
    `${REPAIR_REPLACE_PREFIX} Corrige: ${issues.slice(0, 3).join(" ")}.${umbrellaNote} Prosa conversacional, una recomendación con postura.`
  );
}

export function validateBrainstormerOutputQuality(
  args: ValidateBrainstormerOutputQualityArgs,
): BrainstormerOutputQualityResult {
  const message = args.assistant_message.trim();
  const effectiveKey = resolveValidationThinkingKey({
    thinking_model_key: args.thinking_model_key,
    resolved_primary_model_key: args.resolved_primary_model_key,
  });

  const issues: string[] = [
    ...validateUniversal(message, args, effectiveKey),
    ...validateByModel(message, effectiveKey, args.turn_intent),
  ];

  if (args.turn_intent === "conceptual_strategy_request" || args.turn_intent === "strategic_concept") {
    issues.push(...validateConceptualStrategy(message));
  }
  if (args.turn_intent === "conversion_bridge") {
    if (effectiveKey === "explorer") {
      issues.push(...validateConversionBridgeDisruptor(message));
    } else if (effectiveKey === "commercial") {
      issues.push(...validateConversionBridgeCommercial(message, args.brand_dna));
    }
  }
  if (args.turn_intent === "campaign_expectation" || args.turn_intent === "campaign_stage_inquiry") {
    issues.push(...validateCampaignExpectation(message, args.working_brief));
  }

  const uniqueIssues = [...new Set(issues)];
  const ok = uniqueIssues.length === 0;
  return {
    ok,
    issues: uniqueIssues,
    repair_instruction: ok ? undefined : buildRepairInstruction(uniqueIssues, args, effectiveKey),
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
    },
    {
      brand_dna_lacks_evidence: brandDnaLacksCredibilityFromBlock(args.brand_dna),
      brand_dna: args.brand_dna,
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
  });
}

function applyControlledFallback(
  args: Parameters<typeof applyBrainstormerOutputQualityGate>[0],
  preRepairIssues: string[],
  repairFlags: { attempted: boolean; used: boolean; stillFailed: boolean },
): BrainstormerOutputQualityGateResult {
  const fallbackMessage = buildFallbackMessage(args);
  const fallbackQuality = validateForGate(fallbackMessage, args);

  if (!fallbackQuality.ok) {
    // eslint-disable-next-line no-console
    console.warn("[brainstormer] fallback validation failed", {
      issues: fallbackQuality.issues,
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
  const trimmed = message.trim();
  if (!assistantMessageHasVisibleLeaks(trimmed)) {
    const quality = validateForGate(trimmed, args);
    return {
      assistant_message: trimmed,
      quality,
      repair_attempted: repairFlags.attempted,
      repair_used: repairFlags.used,
      repair_still_failed: repairFlags.stillFailed && !repairFlags.fallbackUsed,
      fallback_used: repairFlags.fallbackUsed,
      pre_repair_issues: preRepairIssues,
    };
  }
  return applyControlledFallback(args, preRepairIssues, {
    attempted: repairFlags.attempted,
    used: repairFlags.used,
    stillFailed: true,
  });
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
