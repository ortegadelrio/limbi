import {
  isClarificationHelpSeekingUserMessage,
  isMixedClarificationDraft,
  sanitizeClarificationSubmitFreeText,
} from "@/lib/questionnaire-evaluation/clarification-help-intent";

/** When user clicks “Guardar respuesta y seguir”, route to coach instead of persisting. */
export function shouldInvokeCoachOnGuardar(params: {
  rawTrimmed: string;
  universalSkipSelected: boolean;
}): boolean {
  if (params.universalSkipSelected) return false;
  const t = params.rawTrimmed.trim();
  if (!t) return false;
  if (isMixedClarificationDraft(t)) return true;
  if (isClarificationHelpSeekingUserMessage(t)) return true;
  return false;
}

/** Free-text answer is concrete enough to save (post-coach / no meta-only). */
export function isSubstantiveClarificationFreeText(rawTrimmed: string): boolean {
  const t = rawTrimmed.trim();
  if (!t) return false;
  if (isMixedClarificationDraft(t)) return false;
  if (isClarificationHelpSeekingUserMessage(t)) return false;
  return sanitizeClarificationSubmitFreeText(t).length >= 12;
}
