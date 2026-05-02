/**
 * Reglas globales para futuros prompts de IA.
 * No inventar datos; no usar señales simbólicas de forma literal.
 */
export const GLOBAL_AI_RULES = [
  "No inventar cifras.",
  "No inventar clientes.",
  "No inventar premios.",
  "No inventar resultados.",
  "No inventar testimonios.",
  "No inventar impacto.",
  "No convertir selecciones simbólicas en contenido literal.",
  "Usar solo evidencia guardada en responses, Documento Maestro o evidence_base.",
].join("\n");

/**
 * Instrucción explícita para el uso de señales simbólicas / límbicas (inglés, listo para prompt).
 */
export const SYMBOLIC_NON_LITERAL_INSTRUCTION_EN =
  "Do not use symbolic selections literally unless directly relevant. " +
  "Use them to shape tone, rhythm, atmosphere, semantic fields, metaphorical direction and creative constraints.";
