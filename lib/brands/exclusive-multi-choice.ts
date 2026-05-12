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

/**
 * Valida que no queden combinaciones imposibles (p. ej. “todas las edades” + un rango).
 * El cliente aplica reglas `exclusive`; el servidor refuerza consistencia.
 */
export function validateExclusiveMultiChoiceAnswer(
  options: QuestionOption[],
  values: string[],
): { ok: true } | { ok: false; message: string } {
  if (values.length === 0) return { ok: true };

  const exclusiveSelected = values.filter((v) =>
    options.some((o) => o.value === v && o.exclusive),
  );

  if (exclusiveSelected.length > 1) {
    return {
      ok: false,
      message: "No pueden combinarse varias opciones exclusivas.",
    };
  }

  if (exclusiveSelected.length === 1 && values.length > 1) {
    return {
      ok: false,
      message: "Esta opción no puede combinarse con otras seleccionadas.",
    };
  }

  return { ok: true };
}
