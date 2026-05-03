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
  "Riesgos, amenazas, objeciones, tensiones negativas, debilidades y percepciones problemáticas del contexto son insumo interno de análisis estratégico: sirven para entender qué evitar, anticipar objeciones, guardrails, foco y mensajes positivos o neutralizantes; no deben aparecer literalmente en textos creativos públicos (títulos, pitches, captions, ideas, frases gráficas, hooks) salvo que el usuario pida explícitamente crisis, reputación o contraargumentación defensiva.",
  "Criterio editorial (no bloqueo técnico): preferir redacción concreta y con oficio; desalentar fórmulas muy usadas («no es solo… es…», «más que… es…», «se trata de…», «conectando el futuro…», «futuro del sector», «colaboración auténtica», «oportunidades de crecimiento real», etc.) cuando suenen genéricas o decorativas; una comparación puede quedarse solo si es precisa, original y necesaria.",
].join("\n");

/**
 * Instrucción explícita para el uso de señales simbólicas / límbicas (inglés, listo para prompt).
 */
export const SYMBOLIC_NON_LITERAL_INSTRUCTION_EN =
  "Do not use symbolic selections literally unless directly relevant. " +
  "Use them to shape tone, rhythm, atmosphere, semantic fields, metaphorical direction and creative constraints.";
