/**
 * Fallback de conceptual_strategy_request — propuesta concreta desde Brand DNA.
 */

import {
  emptyBrainstormerWorkingBrief,
  type BrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import {
  buildThinkingModelConceptJourneyHint,
  isBeforeConceptConfirmed,
  isChallengeContextPhrase,
  isConceptualLevelCorrection,
} from "@/lib/brainstormer/strategy-journey";
import type { ThinkingModelKey } from "@/lib/ai/thinking-models";
import {
  extractQuotedConceptCandidate,
  isProjectStatusOrLaunchBriefMessage,
  isUserConfusionPhrase,
  isValidConceptualUmbrellaCandidate,
  normalizeStoredConceptualUmbrella,
  resolveDisplayUmbrella,
} from "@/lib/brainstormer/working-brief-memory";

/** Conceptos genéricos que el fallback no debe proponer como idea rectora. */
export const CONCEPTUAL_FALLBACK_FORBIDDEN_CONCEPT_LABELS: readonly RegExp[] = [
  /descubrimientos?\s+sorprendentes/i,
  /conexi[oó]n\s+aut[eé]ntica/i,
  /la\s+rutina\s+tambi[eé]n\s+puede\s+ser\s+extraordinaria/i,
];

export type ParsedBrandDnaForConceptualFallback = {
  brand_truth: string;
  desired_effect: string;
  weak_territories_to_avoid: string;
  approved_session_decisions: string;
};

export function parseBrandDnaFieldsForConceptualFallback(
  brand_dna: string | null | undefined,
): ParsedBrandDnaForConceptualFallback {
  const empty = {
    brand_truth: "",
    desired_effect: "",
    weak_territories_to_avoid: "",
    approved_session_decisions: "",
  };
  if (!brand_dna?.trim()) return empty;

  const pick = (key: string): string => {
    const re = new RegExp(`^${key}:\\s*(.+)$`, "im");
    const m = brand_dna.match(re);
    return m?.[1]?.trim() ?? "";
  };

  return {
    brand_truth: pick("brand_truth"),
    desired_effect: pick("desired_effect"),
    weak_territories_to_avoid: pick("weak_territories_to_avoid"),
    approved_session_decisions: pick("approved_session_decisions"),
  };
}

/** Marca con deseo inesperado + ironía/e-commerce y territorios débiles explícitos (ej. Boringstore). */
export function brandDnaSignalsUnexpectedDesireIronyCommerce(
  parsed: ParsedBrandDnaForConceptualFallback,
): boolean {
  const corpus = [parsed.brand_truth, parsed.desired_effect, parsed.weak_territories_to_avoid]
    .join(" ")
    .toLowerCase();
  const hasDesireAxis =
    /deseo\s+inesperado|no\s+sab[ií]as|mundano|cotidian|aburrid/i.test(corpus);
  const hasIronyOrCommerce =
    /iron[ií]a|e-?commerce|compra|digital|impulso|tienda/i.test(corpus);
  const weakTerritoriesNamed =
    /descubrimiento|curiosidad|extraordinari|aventura|sorpresa\s+sin/i.test(
      parsed.weak_territories_to_avoid.toLowerCase() || corpus,
    );
  return hasDesireAxis && (hasIronyOrCommerce || weakTerritoriesNamed);
}

const UNEXPECTED_DESIRE_UMBRELLA_PHRASES = [
  "No lo buscabas. Ahora lo quieres.",
  "Esto no era necesario… hasta que lo viste.",
  "Cosas que no necesitabas, pero ahora quieres.",
] as const;

function stablePick<T>(seed: string, options: readonly T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return options[h % options.length]!;
}

function extractUserProposedConcept(userMessage: string): string | null {
  const trimmed = userMessage.trim();
  if (!trimmed) return null;

  const quoted = extractQuotedConceptCandidate(trimmed);
  if (quoted && isValidConceptualUmbrellaCandidate(quoted)) return quoted;

  if (/no\s+sab[ií]as\s+que\s+lo\s+quer[ií]as/i.test(trimmed)) {
    return "No sabías que lo querías";
  }

  const normalized = normalizeStoredConceptualUmbrella(trimmed);
  if (normalized && isValidConceptualUmbrellaCandidate(normalized)) return normalized;

  return null;
}

function phraseFromDesiredEffect(desired_effect: string): string | null {
  const quoted = desired_effect.match(/«([^»]{8,90})»/)?.[1]?.trim();
  if (quoted) return quoted;
  const headline = desired_effect.match(/no\s+sab[ií]as[^.|]{0,60}/i)?.[0]?.trim();
  if (headline && headline.length >= 8) {
    return headline.charAt(0).toUpperCase() + headline.slice(1);
  }
  return null;
}

/** Una sola frase rectora concreta derivada del DNA (sin menú ni clichés de categoría). */
export function proposeConceptualUmbrellaPhrase(args: {
  brand_dna?: string | null;
  working_brief: BrainstormerWorkingBrief;
}): string {
  const parsed = parseBrandDnaFieldsForConceptualFallback(args.brand_dna);
  const seed = [
    parsed.brand_truth,
    parsed.desired_effect,
    parsed.approved_session_decisions,
    args.working_brief.confirmed_decisions.join(" "),
  ].join("|");

  if (brandDnaSignalsUnexpectedDesireIronyCommerce(parsed)) {
    return stablePick(seed, UNEXPECTED_DESIRE_UMBRELLA_PHRASES);
  }

  const fromEffect = phraseFromDesiredEffect(parsed.desired_effect);
  if (fromEffect) return fromEffect;

  const truthClause = parsed.brand_truth.split(/[.|]/)[0]?.trim();
  if (truthClause && truthClause.length >= 16 && truthClause.length <= 100) {
    return stablePick(truthClause, [
      "Lo cotidiano que de pronto quieres sin haberlo buscado.",
      "El deseo que aparece cuando no lo estabas buscando.",
    ]);
  }

  return "Lo que no buscabas y de pronto quieres — una sola idea rectora anclada en la verdad de marca.";
}

function buildValidateUmbrellaResponse(umbrella: string): string {
  return (
    `Ese es el paraguas. No lo cambiaría. «${umbrella}» funciona porque nombra el deseo inesperado: ` +
    `la persona no llega buscando una necesidad racional, pero al ver el producto siente que lo quiere. ` +
    `Desde ahí la campaña no debe hablar de curiosidades sueltas, sino de ese momento en que algo absurdo o cotidiano se vuelve deseable.`
  );
}

function buildProposeUmbrellaResponse(
  phrase: string,
  parsed: ParsedBrandDnaForConceptualFallback,
): string {
  const anchor = brandDnaSignalsUnexpectedDesireIronyCommerce(parsed)
    ? " Encaja con productos mundanos con ironía y compra digital — no con épica aspiracional."
    : parsed.brand_truth
      ? " Encaja con la verdad de marca en la base activa."
      : "";

  const weakNote = parsed.weak_territories_to_avoid
    ? " Evita territorios saturados de categoría (aspiracional decorativo o sorpresa vacía)."
    : "";

  return (
    `Mi paraguas sería «${phrase}»: una sola idea rectora con postura.${anchor}${weakNote} ` +
    `Funciona porque nombra el salto entre no buscarlo y quererlo en el acto — deseo inesperado sobre lo mundano. ` +
    `Con eso ordenás mensajes y etapas en una sola dirección.`
  );
}

function buildJourneyCorrectionFallback(args: {
  userMessage: string;
  phrase: string;
  parsed: ParsedBrandDnaForConceptualFallback;
  thinkingKey?: ThinkingModelKey | null;
}): string {
  const contextLine = isChallengeContextPhrase(args.userMessage)
    ? ""
    : " «Lanzar la marca porque es nueva» (u otro contexto del hilo) es contexto de reto, no paraguas.";
  return (
    `Tienes razón. Me fui a acciones antes de cerrar el concepto.${contextLine} ` +
    `Yo partiría de una tensión más fuerte: productos que parecen innecesarios hasta que los ves. ` +
    `Mi paraguas sería «${args.phrase}»: una sola idea rectora con postura.` +
    buildThinkingModelConceptJourneyHint(args.thinkingKey) +
    ` Funciona porque nombra el deseo inesperado — no buscabas el producto y de pronto lo quieres.`
  );
}

export function buildConceptualStrategyFallback(args: {
  working_brief: BrainstormerWorkingBrief;
  last_user_message?: string;
  brand_dna?: string | null;
  thinking_model_key?: ThinkingModelKey;
}): string {
  const userMsg = args.last_user_message ?? "";
  const confirmed = resolveDisplayUmbrella(args.working_brief, userMsg);

  if (confirmed) {
    return buildValidateUmbrellaResponse(confirmed);
  }

  const proposed = extractUserProposedConcept(userMsg);
  if (proposed) {
    return buildValidateUmbrellaResponse(proposed);
  }

  const parsed = parseBrandDnaFieldsForConceptualFallback(args.brand_dna);
  const phrase = proposeConceptualUmbrellaPhrase({
    brand_dna: args.brand_dna,
    working_brief: args.working_brief,
  });

  if (
    isConceptualLevelCorrection(userMsg) ||
    args.working_brief.current_request_type === "conceptual_level_correction"
  ) {
    return buildJourneyCorrectionFallback({
      userMessage: userMsg,
      phrase,
      parsed,
      thinkingKey: args.thinking_model_key,
    });
  }

  const needsConceptFirst =
    isBeforeConceptConfirmed(args.working_brief.strategy_stage) ||
    args.working_brief.strategy_stage === "concept_needed";

  if (needsConceptFirst) {
    const opener =
      "Antes de pensar en piezas, cerraría el paraguas conceptual. Lanzar una marca porque es nueva es contexto, no concepto. ";
    return opener + buildProposeUmbrellaResponse(phrase, parsed);
  }

  return buildProposeUmbrellaResponse(phrase, parsed);
}

export function conceptualFallbackUsesForbiddenGenericLabels(message: string): boolean {
  return CONCEPTUAL_FALLBACK_FORBIDDEN_CONCEPT_LABELS.some((p) => p.test(message));
}

/** Fallback cuando el usuario rechaza o pide alternativas de concepto. */
export function buildConceptRejectionAlternativesFallback(args: {
  brand_dna?: string | null;
  brand_name?: string;
}): string {
  const brand = args.brand_name?.trim() || "la marca";
  const p1 = proposeConceptualUmbrellaPhrase({
    brand_dna: args.brand_dna,
    working_brief: emptyBrainstormerWorkingBrief(),
  });
  const p2 = "Esto no era necesario… hasta que lo viste";
  const p3 = "Cosas que no buscabas, pero ahora quieres";
  return (
    "Tienes razón. No debía tomar tu frase como concepto; estabas pidiendo alternativas. " +
    `Vuelvo al nivel correcto: opciones de paraguas. Para ${brand} probaría tres caminos: ` +
    `1. «${p1}» — directo al deseo inesperado. ` +
    `2. «${p2}» — más irónico. ` +
    `3. «${p3}» — más claro para conversión digital.`
  );
}

/** Fallback visible para audience_strategy_request — audiencia sin bloquear por paraguas. */
export function buildAudienceStrategyFallback(args: {
  brand_dna?: string | null;
  brand_name?: string;
}): string {
  const brand = args.brand_name?.trim() || "la marca";
  const parsed = parseBrandDnaFieldsForConceptualFallback(args.brand_dna);
  const audienceBody = brandDnaSignalsUnexpectedDesireIronyCommerce(parsed)
    ? "Yo enfocaría a adultos urbanos que compran por impulso irónico en digital: gente que disfruta lo mundano con humor seco, sin buscar épica ni aventura. La tensión: productos que parecen innecesarios hasta que los ves. La motivación no es necesidad, es deseo inesperado en el momento."
    : `Definiría primero quién tiene el problema o el deseo que ${brand} resuelve, con motivación y barrera concretas — no «todos».`;
  return `${audienceBody} Con esa audiencia clara, ahora sí podemos afinar el paraguas.`;
}

/** Fallback visible para launch_strategy sin paraguas confirmado. */
export function buildLaunchStrategyFallback(args: {
  working_brief: BrainstormerWorkingBrief;
  last_user_message?: string;
  brand_dna?: string | null;
  brand_name?: string;
}): string {
  const brand = args.brand_name?.trim() || "la marca";
  const parsed = parseBrandDnaFieldsForConceptualFallback(args.brand_dna);
  const phrase = proposeConceptualUmbrellaPhrase({
    brand_dna: args.brand_dna,
    working_brief: args.working_brief,
  });
  const ideaTail = brandDnaSignalsUnexpectedDesireIronyCommerce(parsed)
    ? ` Para esta marca, partiría de una tensión simple: productos que parecen innecesarios hasta que los ves. Desde ahí podría salir un paraguas como «${phrase}».`
    : ` Una idea rectora posible: «${phrase}».`;
  const siteReadyOpener = isProjectStatusOrLaunchBriefMessage(args.last_user_message ?? "")
    ? "Perfecto. Entonces ya no estamos en etapa de sitio; estamos en lanzamiento. Antes de pensar en piezas, cerraría el paraguas de campaña. El sitio está listo, pero la campaña debe darle a la gente una razón para entrar. "
    : "Antes de pensar en acciones, cerraría el paraguas conceptual. Que la marca sea nueva es contexto, no concepto. ";
  return (
    siteReadyOpener +
    `El concepto debe explicar por qué alguien debería prestarle atención a ${brand}.` +
    ideaTail
  );
}

/** Fallback visible cuando el usuario no entiende la respuesta anterior. */
export function buildUserConfusionFallback(args: {
  working_brief: BrainstormerWorkingBrief;
  brand_dna?: string | null;
  brand_name?: string;
}): string {
  const brand = args.brand_name?.trim() || "la marca";
  const parsed = parseBrandDnaFieldsForConceptualFallback(args.brand_dna);
  const phrase = proposeConceptualUmbrellaPhrase({
    brand_dna: args.brand_dna,
    working_brief: args.working_brief,
  });
  const route =
    brandDnaSignalsUnexpectedDesireIronyCommerce(parsed)
      ? ` En ${brand}, una ruta clara sería: productos que parecen innecesarios hasta que los ves. De ahí puede salir un paraguas como: «${phrase}».`
      : ` Una dirección posible sería «${phrase}».`;
  return (
    "Tienes razón. Voy más simple. Antes de pensar en campaña, piezas o nombres, " +
    `necesitamos responder una pregunta: ¿por qué alguien debería prestarle atención a ${brand} si acaba de nacer? ` +
    "Decir 'somos nuevos' no alcanza; eso es contexto, no concepto. " +
    "El concepto debe darle una razón para mirar." +
    route
  );
}
