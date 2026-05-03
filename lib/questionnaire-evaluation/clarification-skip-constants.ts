/** Opciones universales de aclaración (ids estables cliente/servidor). */
export const CLARIFICATION_SKIP_NOT_AVAILABLE_ID = "limbi_not_available_yet";
export const CLARIFICATION_SKIP_CONTINUE_BASE_ID = "limbi_continue_with_base";
export const CLARIFICATION_SKIP_IMPROVE_LATER_ID = "limbi_improve_later";

export const CLARIFICATION_UNIVERSAL_SKIP_OPTIONS = [
  {
    id: CLARIFICATION_SKIP_NOT_AVAILABLE_ID,
    label: "No tengo esta información todavía",
  },
  {
    id: CLARIFICATION_SKIP_CONTINUE_BASE_ID,
    label: "Continuar con esta base",
  },
  {
    id: CLARIFICATION_SKIP_IMPROVE_LATER_ID,
    label: "Lo puedo mejorar después",
  },
] as const;

export function isUniversalClarificationSkipOptionId(id: string): boolean {
  return (
    id === CLARIFICATION_SKIP_NOT_AVAILABLE_ID ||
    id === CLARIFICATION_SKIP_CONTINUE_BASE_ID ||
    id === CLARIFICATION_SKIP_IMPROVE_LATER_ID
  );
}
