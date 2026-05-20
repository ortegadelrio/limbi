/**
 * Fallback de conceptual_strategy_request — propuesta concreta desde Brand DNA.
 */

import type { BrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";
import {
  extractQuotedConceptCandidate,
  isValidConceptualUmbrellaCandidate,
  normalizeStoredConceptualUmbrella,
} from "@/lib/brainstormer/working-brief-memory";

function resolveDisplayUmbrella(
  brief: BrainstormerWorkingBrief,
  lastUserMessage?: string,
): string {
  const raw = brief.confirmed_conceptual_umbrella.trim();
  return normalizeStoredConceptualUmbrella(raw, lastUserMessage) || raw;
}

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

export function buildConceptualStrategyFallback(args: {
  working_brief: BrainstormerWorkingBrief;
  last_user_message?: string;
  brand_dna?: string | null;
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

  return buildProposeUmbrellaResponse(phrase, parsed);
}

export function conceptualFallbackUsesForbiddenGenericLabels(message: string): boolean {
  return CONCEPTUAL_FALLBACK_FORBIDDEN_CONCEPT_LABELS.some((p) => p.test(message));
}
