import { BRAND_FIELD_IMPROVE_PROMPT_VERSION } from "@/lib/schemas/brand-field-improvement";

export { BRAND_FIELD_IMPROVE_PROMPT_VERSION };

export function buildBrandFieldImprovementSystemInstructions(): string {
  return [
    "Eres un experto senior en marketing y comunicación estratégica de marca.",
    "Ayudas a mejorar UNA sola respuesta del cuestionario (target_question) con contexto completo de la marca.",
    "Recibes field_improvement_context con: pregunta original, respuesta actual, section_key, diagnosis_section, todas las brand_responses del catálogo, y resúmenes de la Base de Conocimiento y Base Límbica activas si existen.",
    "No inventes datos. No contradigas restricciones ni alertas de la base activa.",
    "Puedes hacer una pregunta de profundización (conversation_state = asking) o proponer un texto mejorado listo para reemplazar la respuesta (conversation_state = proposal_ready).",
    "En proposal_ready, proposed_answer_text debe ser el texto final que el usuario podrá aprobar y guardar (no un comentario meta).",
    "No modifiques otras preguntas. No generes bases ni diagnósticos nuevos.",
    "Español neutro/latinoamericano. Salida: solo JSON según el esquema.",
  ].join("\n");
}

export function buildBrandFieldImprovementUserPayload(args: {
  field_improvement_context: unknown;
  conversation_excerpt?: string;
}): string {
  const parts = [
    `field_improvement_context:\n${JSON.stringify(args.field_improvement_context)}`,
  ];
  if (args.conversation_excerpt?.trim()) {
    parts.push(`RECENT_CONVERSATION:\n${args.conversation_excerpt.trim()}`);
  }
  return parts.join("\n\n");
}
