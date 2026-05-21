/**
 * Fallback mínimo consultivo cuando la reparación IA falla.
 * No inventa conceptos ni usa el mensaje crudo del usuario como paraguas/eje.
 */

import type { ThinkingModelKey } from "@/lib/ai/thinking-models";
import type {
  BrainstormerTurnIntent,
  BrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import type { BrainstormerTurnInterpretation, ResponseMode } from "@/lib/brainstormer/turn-interpreter";
import {
  isProjectStatusOrLaunchBriefMessage,
  isValidConceptualUmbrellaCandidate,
  resolveDisplayUmbrella,
} from "@/lib/brainstormer/working-brief-memory";

export { resolveDisplayUmbrella } from "@/lib/brainstormer/working-brief-memory";

export type BuildBrainstormerOutputFallbackArgs = {
  turn_intent: BrainstormerTurnIntent;
  thinking_model_key: ThinkingModelKey;
  resolved_primary_model_key?: ThinkingModelKey | null;
  working_brief: BrainstormerWorkingBrief;
  last_user_message?: string;
  interpretation?: BrainstormerTurnInterpretation;
};

function brandLabel(brandName?: string): string {
  return brandName?.trim() || "la marca";
}

/** Solo paraguas autorizado en brief — nunca desde last_user_message. */
function safeConfirmedUmbrella(brief: BrainstormerWorkingBrief): string {
  return resolveDisplayUmbrella(brief);
}

function buildExplainSimpleFallback(brand: string): string {
  return (
    `Tienes razón. Lo explico más simple: estamos intentando definir primero la idea que hará que la gente quiera conocer ${brand}. ` +
    "Antes de hablar de piezas o redes, necesitamos responder: ¿por qué alguien debería entrar a la tienda?"
  );
}

function buildHowToFallback(brand: string, hasUmbrella: boolean): string {
  if (hasUmbrella) {
    return (
      "Lo haría en este orden: primero afinamos el concepto de campaña, luego la audiencia, " +
      "después el mecanismo de expectativa y finalmente las piezas. " +
      `Para ${brand}, el foco sigue siendo convertir productos aparentemente innecesarios en deseo — no tu pregunta como concepto.`
    );
  }
  return (
    "Lo haría en este orden: primero definimos el concepto de campaña, luego la audiencia, " +
    "después el mecanismo de expectativa y finalmente las piezas. " +
    `Para ${brand}, empezaría por una idea que convierta productos aparentemente innecesarios en deseo.`
  );
}

function buildAcquisitionFallback(brand: string): string {
  return (
    `Perfecto: el producto o sitio ya está listo y ahora falta atraer clientes. ` +
    `Yo empezaría por la campaña de adquisición para ${brand}: por qué alguien debería prestarle atención, ` +
    "no tomando tu mensaje anterior como concepto creativo."
  );
}

function buildRejectionFallback(): string {
  return (
    "Tienes razón; estabas pidiendo otras opciones, no confirmar esa idea. " +
    "Vuelvo al nivel correcto y en la siguiente respuesta te doy caminos distintos con criterio breve."
  );
}

function buildValidatedUmbrellaFallback(umbrella: string): string {
  return (
    `Sobre «${umbrella}»: explicaría por qué puede funcionar y qué comprobaría con audiencia real antes de bajar a piezas.`
  );
}

function buildMinimalFallback(
  mode: ResponseMode | undefined,
  args: BuildBrainstormerOutputFallbackArgs,
  brand: string,
): string {
  const umbrella = safeConfirmedUmbrella(args.working_brief);
  const hasUmbrella = Boolean(umbrella);
  const last = args.last_user_message?.trim() ?? "";

  if (mode === "explain_simple" || args.turn_intent === "user_confusion") {
    return buildExplainSimpleFallback(brand);
  }

  if (
    mode === "advance_next_step" ||
    (last && /\bcomo\s+(hago|lo\s+hago)\b/i.test(last))
  ) {
    return buildHowToFallback(brand, hasUmbrella);
  }

  if (isProjectStatusOrLaunchBriefMessage(last) || mode === "guide_to_concept") {
    if (isProjectStatusOrLaunchBriefMessage(last)) {
      return buildAcquisitionFallback(brand);
    }
    return buildHowToFallback(brand, hasUmbrella);
  }

  if (mode === "propose_alternatives") {
    return buildRejectionFallback();
  }

  if (mode === "answer_audience") {
    return (
      `Definiría primero quién tiene el deseo o la tensión que ${brand} resuelve, con motivación y barrera concretas. ` +
      "Con esa audiencia clara, el paraguas puede afinarse — no hace falta tenerlo cerrado para responder esto."
    );
  }

  if (
    hasUmbrella &&
    (mode === "validate_concept" ||
      mode === "answer_tactic_if_ready" ||
      mode === "answer_conversion" ||
      args.turn_intent === "conversion_bridge")
  ) {
    return buildValidatedUmbrellaFallback(umbrella);
  }

  return (
    `Respondo directo a tu pregunta, sin usar tu frase como concepto de campaña. ` +
    `Para ${brand}, el siguiente paso estratégico va antes de piezas o redes.`
  );
}

/** Fallback interno mínimo — consultor, no generador de conceptos. */
export function buildBrainstormerOutputFallback(
  args: BuildBrainstormerOutputFallbackArgs,
  options?: {
    brand_dna_lacks_evidence?: boolean;
    brand_dna?: string | null;
    brand_name?: string;
  },
): string {
  const brand = brandLabel(options?.brand_name);
  const mode = args.interpretation?.response_mode;

  return buildMinimalFallback(mode, args, brand);
}

export function brandDnaLacksCredibilityFromBlock(brand_dna: string | null | undefined): boolean {
  if (!brand_dna?.trim()) return true;
  return /solo pruebas|no inventar casos|no inventar pruebas/i.test(brand_dna);
}
