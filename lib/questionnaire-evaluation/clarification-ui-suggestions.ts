import {
  injectUniversalClarificationSkips,
  sanitizeClarificationQuestionChips,
} from "@/lib/questionnaire-evaluation/clarification-chip-sanitize";
import type { ClarificationQuestion } from "@/lib/questionnaire-evaluation/schema";

/**
 * Sanitiza chips del modelo + bancos contextuales y añade opciones universales de omisión.
 * Llamar siempre con `responses` del proyecto cuando estén disponibles.
 */
export function mergeClarificationSuggestionChips(
  q: ClarificationQuestion,
  responses: Record<string, unknown> = {},
): ClarificationQuestion {
  const sanitized = sanitizeClarificationQuestionChips(q, responses);
  return injectUniversalClarificationSkips(sanitized);
}
