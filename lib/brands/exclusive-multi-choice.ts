import type { QuestionOption } from "@/types/database";

/**
 * Reglas `exclusive` (Ticket C): una opción exclusive no combina con otras;
 * al elegir normal se quita cualquier exclusive previa.
 */
export function applyExclusiveMultiChoiceRules(
  options: QuestionOption[],
  currentValues: string[],
  toggledValue: string,
): string[] {
  const optMap = new Map(options.map((o) => [o.value, o] as const));
  const toggled = optMap.get(toggledValue);
  const wasSelected = currentValues.includes(toggledValue);

  if (wasSelected) {
    return currentValues.filter((v) => v !== toggledValue);
  }

  if (toggled?.exclusive) {
    return [toggledValue];
  }

  const exclusiveValues = new Set(
    options.filter((o) => o.exclusive).map((o) => o.value),
  );

  const next = currentValues.filter((v) => !exclusiveValues.has(v));
  if (!next.includes(toggledValue)) next.push(toggledValue);
  return next;
}
