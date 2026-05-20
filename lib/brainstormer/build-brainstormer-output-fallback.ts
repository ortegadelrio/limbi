/**
 * Respuestas mínimas controladas cuando la reparación IA sigue fallando validación.
 */

import type { ThinkingModelKey } from "@/lib/ai/thinking-models";
import type {
  BrainstormerTurnIntent,
  BrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { buildConceptualStrategyFallback } from "@/lib/brainstormer/build-conceptual-output-fallback";
import { normalizeStoredConceptualUmbrella } from "@/lib/brainstormer/working-brief-memory";
import { resolveValidationThinkingKey } from "@/lib/brainstormer/validate-brainstormer-output-quality";

export type BuildBrainstormerOutputFallbackArgs = {
  turn_intent: BrainstormerTurnIntent;
  thinking_model_key: ThinkingModelKey;
  resolved_primary_model_key?: ThinkingModelKey | null;
  working_brief: BrainstormerWorkingBrief;
  last_user_message?: string;
};

/** Paraguas limpio para copy visible (corrige valores guardados contaminados). */
export function resolveDisplayUmbrella(
  brief: BrainstormerWorkingBrief,
  lastUserMessage?: string,
): string {
  const raw = brief.confirmed_conceptual_umbrella.trim();
  const normalized = normalizeStoredConceptualUmbrella(raw, lastUserMessage);
  return normalized || raw;
}

function umbrellaPhrase(brief: BrainstormerWorkingBrief, lastUserMessage?: string): string {
  const u = resolveDisplayUmbrella(brief, lastUserMessage);
  return u ? `«${u}»` : "";
}

function buildDisruptorConversionFallback(
  brief: BrainstormerWorkingBrief,
  lastUserMessage?: string,
): string {
  const paraguas = umbrellaPhrase(brief, lastUserMessage);
  const anchor = paraguas ? ` bajo ${paraguas}` : "";
  return (
    `Yo no lo llevaría a una landing de productos curiosos. Lo convertiría en un puente${anchor}: ` +
    `esto no existe, pero esto sí. El producto falso abre la conversación; el producto real captura la compra. ` +
    `El sketch muestra el gancho de expectativa con un producto falso absurdo; la página recibe al usuario con ` +
    `productos reales conectados a esa misma tensión y deseo inesperado. Así la campaña no se queda en entretenimiento: ` +
    `convierte la risa en deseo y el deseo en compra en la página.`
  );
}

function buildCommercialConversionFallback(
  brief: BrainstormerWorkingBrief,
  brandDnaLacksEvidence: boolean,
  lastUserMessage?: string,
): string {
  const paraguas = umbrellaPhrase(brief, lastUserMessage);
  const anchor = paraguas ? `${paraguas} ` : "";
  const proof = brandDnaLacksEvidence
    ? " Cuando existan reseñas verificadas, las activamos; hoy, reacciones reales de usuarios en la pieza de expectativa."
    : " Si hay prueba en la base, la mostramos en la landing; si no, reacciones reales tempranas.";
  return (
    `Conecto ${anchor}a venta en página: producto real en una landing específica, CTA claro y carrito simple. ` +
    `La objeción («¿es broma o es real?») se responde mostrando el producto tangible y el beneficio concreto.` +
    proof
  );
}

function buildConceptualFallback(
  args: BuildBrainstormerOutputFallbackArgs,
  brandDna?: string | null,
): string {
  return buildConceptualStrategyFallback({
    working_brief: args.working_brief,
    last_user_message: args.last_user_message,
    brand_dna: brandDna,
  });
}

function buildCampaignExpectationFallback(
  brief: BrainstormerWorkingBrief,
  lastUserMessage?: string,
): string {
  const paraguas = umbrellaPhrase(brief, lastUserMessage);
  const anchor = paraguas ? ` ${paraguas}` : " el concepto confirmado";
  return (
    `En expectativa ocultamos el producto real detrás de un sketch con producto falso bajo${anchor}: ` +
    `instalamos tensión con lo que la marca insinúa sin mostrar todo. Revelamos el producto real en lanzamiento ` +
    `y damos un gancho para que la audiencia quiera seguir. No es un calendario de teasers: es un mecanismo ` +
    `de tensión que conecta con el paraguas y prepara la conversión después.`
  );
}

/** Fallback interno mínimo por intent + modelo (diseñado para pasar validación). */
export function buildBrainstormerOutputFallback(
  args: BuildBrainstormerOutputFallbackArgs,
  options?: { brand_dna_lacks_evidence?: boolean; brand_dna?: string | null },
): string {
  const effectiveKey = resolveValidationThinkingKey({
    thinking_model_key: args.thinking_model_key,
    resolved_primary_model_key: args.resolved_primary_model_key,
  });

  const last = args.last_user_message;

  if (args.turn_intent === "conversion_bridge" && effectiveKey === "explorer") {
    return buildDisruptorConversionFallback(args.working_brief, last);
  }
  if (args.turn_intent === "conversion_bridge" && effectiveKey === "commercial") {
    return buildCommercialConversionFallback(
      args.working_brief,
      options?.brand_dna_lacks_evidence ?? true,
      last,
    );
  }
  if (args.turn_intent === "conceptual_strategy_request" || args.turn_intent === "strategic_concept") {
    return buildConceptualFallback(args, options?.brand_dna);
  }
  if (args.turn_intent === "campaign_expectation" || args.turn_intent === "campaign_stage_inquiry") {
    return buildCampaignExpectationFallback(args.working_brief, last);
  }

  const paraguas = resolveDisplayUmbrella(args.working_brief, last);
  if (paraguas) {
    return (
      `Mi recomendación sigue anclada en «${paraguas}»: una dirección clara, sin territorios genéricos ` +
      `ni menú de opciones. El siguiente paso sería bajar esa idea a la pieza concreta que pidieron.`
    );
  }
  return (
    "Mi recomendación es una dirección clara en prosa, alineada al pedido del usuario " +
    "y sin clichés de descubrimiento o curiosidad vacía."
  );
}

export function brandDnaLacksCredibilityFromBlock(brand_dna: string | null | undefined): boolean {
  if (!brand_dna?.trim()) return true;
  return /solo pruebas|no inventar casos|no inventar pruebas/i.test(brand_dna);
}
