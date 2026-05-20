/**
 * @deprecated v3: la jerarquía vive en BRAINSTORMER CORE BEHAVIOR + bloques compactos.
 */
export const BRAINSTORMER_PROMPT_HIERARCHY_RULE_EN =
  "THIS TURN = what; THINKING MODEL delta = how; canon and brand = boundaries only.";

/** @deprecated Usar buildBrainstormerCorePromptLayers sin bloque de jerarquía separado. */
export function buildBrainstormerPromptHierarchyBlock(): string {
  return BRAINSTORMER_PROMPT_HIERARCHY_RULE_EN;
}
