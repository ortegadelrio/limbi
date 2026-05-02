/** Orden de pasos guardados en `completed_steps` */
export const WIZARD_STEP_ORDER = [
  "project_identity",
  "challenge_type",
  "main_challenge",
  "strategic_what",
  "strategic_problem",
  "strategic_transformation",
  "audience_type",
  "current_emotion",
  "desired_emotion",
  "desired_action",
  "why_now",
  "central_tension",
  "evidence_available",
  "restricted_claims",
  "limbic_intro",
  "visual_atmosphere",
  "emotional_color",
  "sensory_symbolism",
  "emotional_intensity",
  "desired_voice",
  "avoided_voice",
  "voice_comparison",
  "review_before_generation",
] as const;

export type WizardStepId = (typeof WIZARD_STEP_ORDER)[number];

export const WIZARD_STEP_COUNT = WIZARD_STEP_ORDER.length;

/** Títulos por paso (misma longitud que WIZARD_STEP_ORDER). */
export const WIZARD_STEP_TITLES: { [K in WizardStepId]: string } = {
  project_identity: "Nombre del proyecto",
  challenge_type: "Tipo de reto",
  main_challenge: "Reto principal",
  strategic_what: "Qué es",
  strategic_problem: "Problema o necesidad",
  strategic_transformation: "Transformación prometida",
  audience_type: "Audiencia principal",
  current_emotion: "Emoción actual",
  desired_emotion: "Emoción deseada",
  desired_action: "Acción esperada",
  why_now: "Por qué importa ahora",
  central_tension: "Tensión principal",
  evidence_available: "Evidencia disponible",
  restricted_claims: "Restricciones y promesas prohibidas",
  limbic_intro: "Ahora vamos a sentir el reto",
  visual_atmosphere: "Atmósfera visual",
  emotional_color: "Color emocional",
  sensory_symbolism: "Sensorialidad simbólica",
  emotional_intensity: "Intensidad emocional",
  desired_voice: "Personalidad de comunicación",
  avoided_voice: "Tono a evitar",
  voice_comparison: "Frase comparativa",
  review_before_generation: "Revisión antes de generar",
};

/** Opción límbica con pistas semánticas (solo en código; en DB solo el slug o número). */
export type LimbicSemanticOption<V extends string | number = string> = {
  value: V;
  label: string;
  semanticHints: readonly string[];
};

export const NAME_STATUS_OPTIONS = [
  { value: "definitive" as const, label: "Definitivo" },
  { value: "provisional" as const, label: "Provisional" },
  { value: "unnamed" as const, label: "Aún no tengo nombre" },
];

export const CHALLENGE_TYPE_OPTIONS = [
  { value: "brand" as const, label: "Marca" },
  { value: "product" as const, label: "Producto" },
  { value: "service" as const, label: "Servicio" },
  { value: "event" as const, label: "Evento" },
  { value: "personal_brand" as const, label: "Marca personal" },
  { value: "project_venture" as const, label: "Proyecto / emprendimiento" },
  {
    value: "corporate_communication" as const,
    label: "Comunicación corporativa",
  },
];

export const MAIN_CHALLENGE_OPTIONS = [
  { value: "explain_better" as const, label: "Explicar mejor lo que hago" },
  { value: "differentiate" as const, label: "Diferenciarme" },
  { value: "sell_convert" as const, label: "Vender o convertir" },
  {
    value: "attract_audience" as const,
    label: "Convocar o atraer audiencia",
  },
  {
    value: "change_perception" as const,
    label: "Cambiar una percepción",
  },
  {
    value: "coherent_content" as const,
    label: "Crear contenido con coherencia",
  },
];

export const OFFERING_TYPE_OPTIONS = [
  { value: "product" as const, label: "Producto" },
  { value: "service" as const, label: "Servicio" },
  { value: "experience" as const, label: "Experiencia" },
  { value: "knowledge" as const, label: "Conocimiento" },
  { value: "community" as const, label: "Comunidad" },
  { value: "solution" as const, label: "Solución" },
];

export const PROBLEM_CATEGORY_OPTIONS = [
  { value: "lack_clarity" as const, label: "Falta de claridad" },
  { value: "lack_trust" as const, label: "Falta de confianza" },
  { value: "lack_time" as const, label: "Falta de tiempo" },
  { value: "lack_connection" as const, label: "Falta de conexión" },
  {
    value: "lack_differentiation" as const,
    label: "Falta de diferenciación",
  },
  { value: "need_growth" as const, label: "Necesidad de crecimiento" },
  {
    value: "need_belonging" as const,
    label: "Necesidad de pertenencia",
  },
];

/** Paso 6 — transformación prometida */
export const TRANSFORMATION_TYPE_OPTIONS = [
  { value: "understand_better" as const, label: "Entender mejor" },
  { value: "decide_confidently" as const, label: "Decidir con confianza" },
  { value: "feel_part_of" as const, label: "Sentirse parte de algo" },
  { value: "solve_concrete" as const, label: "Resolver algo concreto" },
  { value: "grow_advance" as const, label: "Crecer o avanzar" },
  {
    value: "memorable_experience" as const,
    label: "Vivir una experiencia memorable",
  },
  {
    value: "see_brand_differently" as const,
    label: "Ver la marca de otra manera",
  },
];

/** Paso 7 — audiencia */
export const AUDIENCE_TYPE_OPTIONS = [
  { value: "end_consumers" as const, label: "Consumidores finales" },
  { value: "b2b" as const, label: "Empresas / clientes B2B" },
  { value: "entrepreneurs" as const, label: "Emprendedores" },
  { value: "community_citizens" as const, label: "Comunidad / ciudadanos" },
  { value: "internal_teams" as const, label: "Equipos internos" },
  { value: "event_attendees" as const, label: "Asistentes a un evento" },
  {
    value: "professional_audience" as const,
    label: "Audiencia profesional",
  },
];

/** Paso 8 — emoción actual */
export const CURRENT_EMOTION_OPTIONS = [
  { value: "confused" as const, label: "Confundida" },
  { value: "distrustful" as const, label: "Desconfiada" },
  { value: "curious" as const, label: "Curiosa" },
  { value: "tired" as const, label: "Cansada" },
  { value: "indifferent" as const, label: "Indiferente" },
  {
    value: "interested_indecisive" as const,
    label: "Interesada, pero indecisa",
  },
  { value: "eager_to_grow" as const, label: "Con ganas de crecer" },
];

/** Paso 9 — emoción deseada */
export const DESIRED_EMOTION_OPTIONS = [
  { value: "clarity" as const, label: "Claridad" },
  { value: "trust" as const, label: "Confianza" },
  { value: "desire" as const, label: "Deseo" },
  { value: "pride" as const, label: "Orgullo" },
  { value: "calm" as const, label: "Tranquilidad" },
  { value: "positive_urgency" as const, label: "Urgencia positiva" },
  { value: "belonging" as const, label: "Pertenencia" },
];

/** Paso 10 — acción esperada */
export const DESIRED_ACTION_OPTIONS = [
  { value: "purchase" as const, label: "Compre" },
  { value: "sign_up" as const, label: "Se inscriba" },
  { value: "request_information" as const, label: "Pida información" },
  { value: "share" as const, label: "Comparta" },
  { value: "trust_brand" as const, label: "Confíe en la marca" },
  {
    value: "change_perception_action" as const,
    label: "Cambie una percepción",
  },
  {
    value: "keep_consuming_content" as const,
    label: "Siga consumiendo contenido",
  },
];

/** Paso 11 — por qué importa ahora */
export const WHY_NOW_OPTIONS = [
  { value: "launching" as const, label: "Estoy lanzando algo" },
  { value: "need_growth" as const, label: "Necesito crecer" },
  { value: "heavy_competition" as const, label: "Hay mucha competencia" },
  {
    value: "misunderstood_value" as const,
    label: "No entienden bien mi valor",
  },
  {
    value: "change_perception_now" as const,
    label: "Quiero cambiar una percepción",
  },
  { value: "need_audience" as const, label: "Necesito convocar audiencia" },
  {
    value: "order_communication" as const,
    label: "Quiero ordenar mi comunicación",
  },
];

/** Paso 12 — tensión principal */
export const CENTRAL_TENSION_OPTIONS = [
  {
    value: "valuable_not_understood" as const,
    label: "Somos valiosos, pero no nos entienden",
  },
  {
    value: "good_unknown" as const,
    label: "Somos buenos, pero no nos conocen",
  },
  {
    value: "known_misperceived" as const,
    label: "Nos conocen, pero no nos perciben bien",
  },
  {
    value: "new_needs_explanation" as const,
    label: "Tenemos algo nuevo, pero hay que explicarlo",
  },
  {
    value: "connect_sound_generic" as const,
    label: "Queremos conectar, pero sonamos genéricos",
  },
  {
    value: "sell_not_aggressive" as const,
    label: "Queremos vender, pero sin sonar agresivos",
  },
  {
    value: "growth_with_identity" as const,
    label: "Queremos crecer, pero con identidad clara",
  },
];

export const NO_CLEAR_EVIDENCE = "no_clear_evidence" as const;

/** Paso 13 — tipos de evidencia (valores = claves en evidence_details) */
export const EVIDENCE_TYPE_OPTIONS = [
  { value: "results" as const, label: "Cifras o resultados" },
  { value: "testimonials" as const, label: "Testimonios" },
  { value: "clients_partners" as const, label: "Clientes o aliados" },
  { value: "awards" as const, label: "Premios o reconocimientos" },
  { value: "case_studies" as const, label: "Casos de éxito" },
  { value: "differentiators" as const, label: "Diferenciales claros" },
  { value: "market_data" as const, label: "Datos de mercado" },
  {
    value: NO_CLEAR_EVIDENCE,
    label: "Todavía no tengo evidencia clara",
  },
];

/** Paso 14 */
export const RESTRICTED_CLAIMS_OPTIONS = [
  { value: "yes" as const, label: "Sí" },
  { value: "no" as const, label: "No" },
  { value: "unsure" as const, label: "No estoy seguro" },
];

/** Paso 16 — atmósfera visual (exactamente 3) */
export const VISUAL_ATMOSPHERE_OPTIONS = [
  {
    value: "sun" as const,
    label: "Sol",
    semanticHints: ["claridad", "optimismo", "vitalidad", "visibilidad", "energía"],
  },
  {
    value: "rain" as const,
    label: "Lluvia",
    semanticHints: ["pausa", "memoria", "introspección", "renovación", "melancolía suave"],
  },
  {
    value: "sea" as const,
    label: "Mar",
    semanticHints: ["profundidad", "horizonte", "movimiento constante", "inmensidad", "libertad"],
  },
  {
    value: "city" as const,
    label: "Ciudad",
    semanticHints: ["ritmo", "densidad", "modernidad", "conexión", "urgencia urbana"],
  },
  {
    value: "home" as const,
    label: "Casa",
    semanticHints: ["acogida", "intimidad", "seguridad", "cercanía", "raíces"],
  },
  {
    value: "road" as const,
    label: "Carretera",
    semanticHints: ["trayecto", "avance", "decisión", "independencia", "camino"],
  },
  {
    value: "forest" as const,
    label: "Bosque",
    semanticHints: ["misterio orgánico", "calma", "vida silenciosa", "refugio", "naturaleza"],
  },
  {
    value: "stage" as const,
    label: "Escenario",
    semanticHints: ["performance", "presencia", "luz focal", "exhibición", "momento cumbre"],
  },
  {
    value: "workshop" as const,
    label: "Taller",
    semanticHints: ["hacer", "artesanía", "prueba y error", "manos a la obra", "autenticidad"],
  },
  {
    value: "airport" as const,
    label: "Aeropuerto",
    semanticHints: ["transición", "escala", "ambición", "expansión", "cambio de perspectiva"],
  },
  {
    value: "fire" as const,
    label: "Fuego",
    semanticHints: ["pasión", "transformación", "urgencia", "peligro controlado", "impulso"],
  },
  {
    value: "sunrise" as const,
    label: "Amanecer",
    semanticHints: ["comienzo", "esperanza", "renacer", "suavidad", "promesa"],
  },
] as const satisfies readonly LimbicSemanticOption[];

/** Paso 17 — color */
export const EMOTIONAL_COLOR_OPTIONS = [
  {
    value: "red" as const,
    label: "Rojo",
    semanticHints: ["pasión", "urgencia", "atención", "fuerza", "calor simbólico"],
  },
  {
    value: "blue" as const,
    label: "Azul",
    semanticHints: ["confianza", "profundidad", "orden", "frialdad noble", "serenidad"],
  },
  {
    value: "green" as const,
    label: "Verde",
    semanticHints: ["equilibrio", "naturaleza", "crecimiento", "salud", "renovación"],
  },
  {
    value: "yellow" as const,
    label: "Amarillo",
    semanticHints: ["optimismo", "luz", "juego", "cercanía", "energía suave"],
  },
  {
    value: "black" as const,
    label: "Negro",
    semanticHints: ["sofisticación", "autoridad", "misterio", "sobriedad", "elegancia"],
  },
  {
    value: "white" as const,
    label: "Blanco",
    semanticHints: ["claridad", "pureza", "espacio", "minimalismo", "honestidad"],
  },
  {
    value: "purple" as const,
    label: "Morado",
    semanticHints: ["creatividad", "lujo simbólico", "intuición", "singularidad", "imaginación"],
  },
  {
    value: "orange" as const,
    label: "Naranja",
    semanticHints: ["entusiasmo", "cercanía cálida", "acción amable", "vitalidad social", "dinamismo"],
  },
] as const satisfies readonly LimbicSemanticOption[];

export const COLOR_FEELING_OPTIONS = [
  {
    value: "bright" as const,
    label: "Brillante",
    semanticHints: ["claridad", "acento", "presencia", "acento visual", "vivacidad"],
  },
  {
    value: "soft" as const,
    label: "Suave",
    semanticHints: ["delicadeza", "empatía", "difuminado", "cuidado", "cercanía"],
  },
  {
    value: "intense" as const,
    label: "Intenso",
    semanticHints: ["carga emocional", "fuerza", "profundidad", "compromiso", "impacto"],
  },
  {
    value: "elegant" as const,
    label: "Elegante",
    semanticHints: ["refinamiento", "mesura", "distancia amable", "sofisticación", "control"],
  },
  {
    value: "warm" as const,
    label: "Cálido",
    semanticHints: ["cercanía", "acogida", "humanidad", "confianza afectiva", "calidez"],
  },
  {
    value: "cold" as const,
    label: "Frío",
    semanticHints: ["distancia", "precisión", "orden", "racionalidad", "mesura emocional"],
  },
] as const satisfies readonly LimbicSemanticOption[];

/** Paso 18 — olor */
export const SENSORY_SMELL_OPTIONS = [
  {
    value: "coffee" as const,
    label: "Café",
    semanticHints: ["ritual", "vigor suave", "intimidad cotidiana", "concentración", "calidez"],
  },
  {
    value: "wet_soil" as const,
    label: "Tierra mojada",
    semanticHints: ["origen", "honestidad", "renovación", "naturalidad", "memoria"],
  },
  {
    value: "sea" as const,
    label: "Mar (olor)",
    semanticHints: ["sal", "horizonte", "libertad", "vasto", "aire limpio"],
  },
  {
    value: "wood" as const,
    label: "Madera",
    semanticHints: ["solidez", "trabajo artesanal", "tiempo", "calidez material", "resistencia"],
  },
  {
    value: "elegant_perfume" as const,
    label: "Perfume elegante",
    semanticHints: ["sofisticación", "detalle", "distinción", "cuidado estético", "presencia"],
  },
  {
    value: "warm_bread" as const,
    label: "Pan caliente",
    semanticHints: ["cuidado", "hogar", "abundancia simbólica", "cercanía", "confianza"],
  },
] as const satisfies readonly LimbicSemanticOption[];

/** Paso 18 — movimiento */
export const SENSORY_MOVEMENT_OPTIONS = [
  {
    value: "bicycle" as const,
    label: "Bicicleta",
    semanticHints: ["autonomía", "sencillez", "movimiento humano", "equilibrio", "ritmo propio"],
  },
  {
    value: "airplane" as const,
    label: "Avión",
    semanticHints: ["expansión", "escala", "ambición", "transición", "cambio de perspectiva"],
  },
  {
    value: "train" as const,
    label: "Tren",
    semanticHints: ["dirección", "constancia", "infraestructura", "rumbo colectivo", "progreso lineal"],
  },
  {
    value: "motorcycle" as const,
    label: "Moto",
    semanticHints: ["velocidad", "riesgo calculado", "individualidad", "libertad", "impulso"],
  },
  {
    value: "walking" as const,
    label: "Caminata",
    semanticHints: ["humanidad", "paso a paso", "presencia", "cercanía", "paciencia activa"],
  },
  {
    value: "rocket" as const,
    label: "Cohete",
    semanticHints: ["disrupción", "ambición extrema", "salto", "futuro", "aceleración"],
  },
] as const satisfies readonly LimbicSemanticOption[];

/** Paso 18 — edad emocional */
export const SENSORY_EMOTIONAL_AGE_OPTIONS = [
  {
    value: "curious_child" as const,
    label: "Niño curioso",
    semanticHints: ["asombro", "pregunta", "juego", "apertura", "frescura"],
  },
  {
    value: "ambitious_young" as const,
    label: "Joven ambicioso",
    semanticHints: ["impulso", "osadía", "crecimiento", "energía", "horizonte"],
  },
  {
    value: "reliable_adult" as const,
    label: "Adulto confiable",
    semanticHints: ["solidez", "responsabilidad", "calma competente", "consistencia", "confianza"],
  },
  {
    value: "wise_person" as const,
    label: "Persona sabia",
    semanticHints: ["perspectiva", "mesura", "historia", "autoridad suave", "profundidad"],
  },
  {
    value: "timeless" as const,
    label: "Atemporal",
    semanticHints: ["universalidad", "elegancia clásica", "fuera de moda efímera", "perdurabilidad", "serenidad"],
  },
] as const satisfies readonly LimbicSemanticOption[];

/** Paso 18 — vestuario simbólico */
export const SENSORY_CLOTHING_OPTIONS = [
  {
    value: "formal_suit" as const,
    label: "Traje formal",
    semanticHints: ["autoridad", "seriedad", "protocolo", "precisión", "estatus"],
  },
  {
    value: "sportswear" as const,
    label: "Ropa deportiva",
    semanticHints: ["energía", "acción", "rendimiento", "dinamismo", "salud"],
  },
  {
    value: "jeans_tshirt" as const,
    label: "Jeans y camiseta",
    semanticHints: ["naturalidad", "accesibilidad", "honestidad", "cercanía", "simplicidad"],
  },
  {
    value: "minimal_black" as const,
    label: "Todo negro minimalista",
    semanticHints: ["sofisticación", "misterio", "orden", "fuerza silenciosa", "diseño"],
  },
  {
    value: "colorful_clothes" as const,
    label: "Ropa colorida",
    semanticHints: ["expresividad", "diversión", "apertura", "celebración", "humanidad"],
  },
  {
    value: "work_overall" as const,
    label: "Overol de trabajo",
    semanticHints: ["hacer", "honestidad laboral", "resistencia", "pragmatismo", "oficio"],
  },
] as const satisfies readonly LimbicSemanticOption[];

/** Paso 19 — intensidad (valor numérico 1–5 en DB) */
export const EMOTIONAL_INTENSITY_OPTIONS = [
  {
    value: 1 as const,
    label: "Muy racional",
    semanticHints: ["orden", "precisión", "frialdad útil", "lógica", "contención emocional"],
  },
  {
    value: 2 as const,
    label: "Racional con emoción sutil",
    semanticHints: ["equilibrio sesgado a lo cerebral", "toques humanos", "mesura", "claridad"],
  },
  {
    value: 3 as const,
    label: "Equilibrado",
    semanticHints: ["mix cabeza-corazón", "versatilidad", "naturalidad", "empatía moderada"],
  },
  {
    value: 4 as const,
    label: "Emocional pero elegante",
    semanticHints: ["carga afectiva", "contención estética", "profundidad sin grito", "movilización suave"],
  },
  {
    value: 5 as const,
    label: "Muy emocional y movilizador",
    semanticHints: ["impulso", "urgencia afectiva", "movilización", "cercanía intensa", "llamado"],
  },
] as const satisfies readonly LimbicSemanticOption<number>[];

export type EmotionalIntensityLevel =
  (typeof EMOTIONAL_INTENSITY_OPTIONS)[number]["value"];

/** Paso 20 — voz deseada (máx. 3) */
export const DESIRED_VOICE_TRAIT_OPTIONS = [
  {
    value: "human" as const,
    label: "Humana",
    semanticHints: ["cercanía", "imperfección útil", "conversación", "empatía", "autenticidad"],
  },
  {
    value: "clear" as const,
    label: "Clara",
    semanticHints: ["orden mental", "directez", "comprensión", "economía verbal", "luz"],
  },
  {
    value: "premium" as const,
    label: "Premium",
    semanticHints: ["refinamiento", "detalle", "exclusividad simbólica", "calidad", "mesura"],
  },
  {
    value: "close" as const,
    label: "Cercana",
    semanticHints: ["tú a tú", "acogida", "confianza", "calidez", "barreras bajas"],
  },
  {
    value: "inspiring" as const,
    label: "Inspiradora",
    semanticHints: ["elevación", "propósito", "visión", "movilización suave", "horizonte"],
  },
  {
    value: "provocative" as const,
    label: "Provocadora",
    semanticHints: ["pregunta incómoda", "tensión creativa", "despertar", "desafío", "originalidad"],
  },
  {
    value: "playful" as const,
    label: "Divertida",
    semanticHints: ["ligereza", "juego", "ironía amable", "sorpresa", "humanidad"],
  },
  {
    value: "expert" as const,
    label: "Experta",
    semanticHints: ["autoridad suave", "precisión", "credibilidad", "pedagogía", "dominio"],
  },
] as const satisfies readonly LimbicSemanticOption[];

/** Paso 21 — tonos a evitar (máx. 3) */
export const AVOIDED_VOICE_TRAIT_OPTIONS = [
  {
    value: "cheesy" as const,
    label: "Cursi",
    semanticHints: ["sobreexplicación afectiva", "falsedad percibida", "exceso dulce", "comodidad barata"],
  },
  {
    value: "cold" as const,
    label: "Fría",
    semanticHints: ["distancia excesiva", "despersonalización", "rigidez", "falta de humanidad"],
  },
  {
    value: "generic" as const,
    label: "Genérica",
    semanticHints: ["intercambiabilidad", "falta de seña", "plantilla", "olvido", "borrosidad"],
  },
  {
    value: "aggressive" as const,
    label: "Agresiva",
    semanticHints: ["presión", "hostilidad simbólica", "choque", "incomodidad", "exceso de pulso"],
  },
  {
    value: "institutional" as const,
    label: "Institucional",
    semanticHints: ["burocracia", "distancia oficial", "monolito", "falta de tacto humano"],
  },
  {
    value: "childish" as const,
    label: "Infantil",
    semanticHints: ["falta de seriedad percibida", "simplificación excesiva", "inmadurez", "dudas de confianza"],
  },
  {
    value: "exaggerated" as const,
    label: "Exagerada",
    semanticHints: ["hiperbole cansina", "poca credibilidad", "ruido", "fatiga"],
  },
  {
    value: "confusing" as const,
    label: "Confusa",
    semanticHints: ["ambigüedad mala", "laberinto", "fricción cognitiva", "pérdida de foco"],
  },
] as const satisfies readonly LimbicSemanticOption[];

/** Deep-link into the new-project wizard on a specific step (optional `returnTo`). */
export function wizardReviewEditHref(
  projectId: string,
  step: WizardStepId,
  returnTo: "review" | "project",
): string {
  const q = new URLSearchParams({
    projectId,
    editStep: step,
    returnTo,
  });
  return `/projects/new?${q.toString()}`;
}
