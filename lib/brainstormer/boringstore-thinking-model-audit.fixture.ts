/**
 * Fixture de auditoría — hilo Boringstore (lanzamiento digital + mensaje conector).
 * No es payload de producción; modela un caso típico con posible contaminación genérica en la base.
 */

export const BORINGSTORE_THREAD_MESSAGES = [
  "Quiero organizar el lanzamiento de la marca Boringstore",
  "Lo quiero digital",
  "Necesito definir un mensaje que sirva como conector de toda la campaña",
] as const;

export const BORINGSTORE_LAST_USER_MESSAGE = BORINGSTORE_THREAD_MESSAGES[2]!;

export function buildBoringstoreThreadExcerpt(): string {
  return BORINGSTORE_THREAD_MESSAGES.map((m) => `user: ${m}`).join("\n\n");
}

/** Base consolidada realista con mezcla de verdad de marca + clichés de categoría. */
export const BORINGSTORE_KNOWLEDGE_FIXTURE: Record<string, unknown> = {
  executive_reading:
    "Boringstore vende productos mundanos con humor e ironía: convierte lo aburrido en deseo inesperado, no en aventura aspiracional.",
  curator_reading: "Tienda digital del cotidiano brillante.",
  section_interpretations: [
    {
      section_key: "identity",
      headline: "Ironía del aburrimiento",
      interpretation:
        "Marca que juega con lo ordinario; tono irreverente, nunca épico ni de descubrimiento vacío.",
    },
    {
      section_key: "value_proposition",
      headline: "No sabías que lo querías",
      interpretation:
        "Efecto deseado: querer algo mundano sin haberlo buscado; evitar 'descubre lo curioso' como claim principal.",
    },
    {
      section_key: "audiences",
      headline: "Compradores digitales",
      interpretation: "Adultos urbanos que compran por impulso irónico en e-commerce.",
    },
    {
      section_key: "differentiators",
      headline: "Producto falso + producto real",
      interpretation: "Expectativa con sketch absurdo; conversión con producto real en landing.",
    },
    {
      section_key: "voice_tone",
      headline: "Tono",
      interpretation: "Directo, cómico seco, sin adjetivos de aventura o magia.",
    },
    {
      section_key: "restrictions",
      headline: "Evitar",
      interpretation:
        "Territorios débiles: descubrimiento genérico, extraordinario, experiencia única, aventura, sorpresa vacía.",
    },
  ],
  offer_architecture: {
    offer_summary: "E-commerce D2C con lanzamientos digitales y producto sorpresa.",
    service_catalog: [{ name: "Producto sorpresa" }, { name: "Caja mundana premium" }],
  },
  credibility_architecture: {
    reputation_proof_points: ["Comunidad digital activa", "Lanzamientos virales previos"],
  },
  restrictions_and_alerts:
    "No usar 'Descubre lo inesperado' ni 'extraordinariamente curioso' como línea madre; son territorios saturados.",
  final_highlights: {
    key_strengths: ["Ironía de marca", "Puente producto falso → compra real"],
    strategic_tensions: ["Humor vs claridad de CTA"],
  },
};

export const BORINGSTORE_LIMBIC_FIXTURE: Record<string, unknown> = {
  symbolic_reading: "Contraste seco: estante blanco, chispa absurda; deseo inesperado, no atmósfera de aventura.",
  atmosphere_and_metaphor: "Caja ordinaria que de pronto brilla — sin épica de viaje.",
};
