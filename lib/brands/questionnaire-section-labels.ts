/** Etiquetas en español para `section_key` del cuestionario de marca. */
const LABELS: Record<string, string> = {
  identity: "Identidad",
  description: "Qué hacen",
  purpose: "Propósito",
  value_proposition: "Propuesta de valor",
  audiences: "Audiencias",
  differentiators: "Diferenciación",
  positioning: "Posicionamiento",
  voice_tone: "Voz y tono",
  approved_messages: "Mensajes aprobados",
  restrictions: "Restricciones",
  proof: "Pruebas y credibilidad",
  evidence: "Evidencia",
  brand_limbic_base: "Base límbica de marca",
  product: "Producto",
  service: "Servicio",
  product_service: "Producto y servicio",
  experience_event: "Experiencia o evento",
  digital_platform: "Plataforma o SaaS",
  organization: "Organización o causa",
  personal_brand: "Marca personal",
  material_context: "Material de contexto",
};

export function brandQuestionnaireSectionLabelEs(sectionKey: string): string {
  return LABELS[sectionKey] ?? sectionKey;
}
