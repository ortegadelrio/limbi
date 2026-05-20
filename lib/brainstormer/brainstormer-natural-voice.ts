/**
 * Reglas de voz visible Brainstormer (sin capas extra de prompt).
 */

/** Encabezados / etiquetas de framework que no deben aparecer en assistant_message salvo pedido formal. */
export const VISIBLE_FRAMEWORK_HEADERS_FORBIDDEN: readonly string[] = [
  "Lectura del reto",
  "Criterio",
  "Ruta a seguir",
  "Ruta:",
  "Propuesta concreta",
  "Grieta creativa",
  "Paraguas conceptual 1",
  "Paraguas conceptual 2",
  "DISRUPTOR",
];

/** Familias débiles a evitar en copy (sin citar clichés literales — evita priming). */
export const WEAK_CREATIVE_TERRITORY_FAMILIES_FORBIDDEN: readonly string[] = [
  "familia genérica de descubrimiento",
  "aventura aspiracional vacía",
  "curiosidad decorativa",
  "experiencia vacía sin idea",
  "sorpresa sin mecanismo",
];

/** @deprecated Usar WEAK_CREATIVE_TERRITORY_FAMILIES_FORBIDDEN. */
export const GENERIC_CREATIVE_CLICHES_FORBIDDEN: readonly string[] =
  WEAK_CREATIVE_TERRITORY_FAMILIES_FORBIDDEN;

export const NATURAL_PROSE_TONE_HINT =
  "TONO: prosa conversacional (creativo estratégico senior); sin encabezados de framework ni etiquetas del modelo; máximo una lista corta si ayuda; no markdown pesado.";

export function userSeeksFeedbackOnProposedConcept(userMessage: string): boolean {
  const t = userMessage
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const hasFeedbackAsk = /\b(que piensas|que te parece|como lo ves|que opinas de)\b/.test(t);
  const hasConceptAnchor = /\b(estaba pensando|no sab[ií]as|paraguas|idea fuerza|concepto|frase|eje)\b/.test(
    t,
  );
  return hasFeedbackAsk && hasConceptAnchor;
}
