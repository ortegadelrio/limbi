/** Etiquetas en español para `section_key` del cuestionario de marca. */
const LABELS: Record<string, string> = {
  identity: "Identidad",
  description: "Qué hacen",
  purpose: "Propósito",
  value_proposition: "Oferta de valor",
  audiences: "Audiencias",
  differentiators: "Diferenciación",
  differentiation: "Diferenciación",
  positioning: "Posicionamiento",
  voice_tone: "Voz y tono",
  voice_tone_messages: "Voz, tono y mensajes",
  offer: "Oferta",
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
  material_context: "Material de contexto y fuentes de marca",
};

export function brandQuestionnaireSectionLabelEs(sectionKey: string): string {
  const k = sectionKey?.trim() ?? "";
  if (!k) return "";
  if (LABELS[k]) return LABELS[k]!;
  return k
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
