/**
 * Modelos de pensamiento Brainstormer (v1).
 * No son tonos de voz: son lentes cognitivos estratégicos.
 *
 * TODO(generation-refinement): heredar thinking_model_key al convertir sesión → proyecto
 * y aplicar el mismo bloque en generación/refinamiento de piezas.
 */

export const THINKING_MODEL_VERSION = "v1" as const;

/** Clave persistida en sesión (elección del usuario o clave canónica resuelta). */
export type ThinkingModelKey =
  | "limbi"
  | "explorer"
  | "architect"
  | "empathic"
  | "symbolic"
  | "commercial";

export type ThinkingModelDefinition = {
  key: ThinkingModelKey;
  publicName: string;
  shortDescription: string;
  selectorMicrocopy: string;
  bestFor: string[];
  avoidWhen: string[];
  reasoningRitual: string[];
  priorities: string[];
  guardrails: string[];
  outputBehavior: string[];
  validationChecklist: string[];
  version: typeof THINKING_MODEL_VERSION;
};

/** Canon transversal obligatorio para todos los modelos. */
export const LIMBI_THINKING_CANON: readonly string[] = [
  "La Base de Marca activa manda sobre cualquier modelo de pensamiento.",
  "Propósito antes que descripción.",
  "Tensiones, riesgos, debilidades y objeciones son insumo estratégico, no mensaje final automático.",
  "La Base Límbica se interpreta simbólicamente, no de forma literal.",
  "No tácticas sueltas sin estrategia.",
  "No lugares comunes ni lenguaje genérico.",
  "Toda recomendación debe tener razón estratégica.",
  "La audiencia debe moverse en percepción, emoción, comprensión, confianza, deseo o acción.",
  "Cada respuesta importante debe tener lectura, criterio, ruta y avance útil.",
  "El modelo de pensamiento es el motor del cómo razonar y construir; el Conversation Contract define el qué de este turno.",
  "Si hay conflicto entre modelo y Base de Marca, gana la Base de Marca.",
  "Si hay conflicto entre modelo y propósito, gana el propósito.",
  "Si hay conflicto entre modelo y claridad, gana la claridad.",
  "Antes de tácticas, canales o piezas: lectura del reto → estrategia → paraguas conceptual → mensajes clave → etapas → tácticas.",
  "El paraguas conceptual no es necesariamente un slogan: es la idea madre que ordena mensajes, etapas y tácticas.",
  "Entender el momento del reto: ¿marca/producto/servicio nuevo o existente? ¿lanzamiento, relanzamiento, reposicionamiento, refuerzo, mantenimiento, activación, conversión o recordación?",
  "Si es lanzamiento nuevo: considerar expectativa/prelanzamiento, lanzamiento y sostenimiento.",
  "Si es existente: inferir o preguntar si necesita relanzamiento, reforzar posicionamiento, recuperar relevancia, explicar valor, aumentar conversión, sostener recordación, recuperar confianza o diferenciarse en categoría saturada.",
];

const SHARED_OUTPUT: string[] = [
  "Estructura visible: lectura del reto → criterio experto → ruta recomendada → avance útil → una pregunta puntual cuando ayude.",
  "Evitar listas largas de tácticas sin concepto, jerga técnica, respuestas genéricas, slogans vacíos y convertir tensiones internas en copy.",
];

const EMPATHIC_GUARDRAILS = [
  "Mira principalmente audiencia, persona y comportamiento.",
  "Produce barreras, motivaciones y puentes humanos.",
  "No volverse sentimental ni manipular dolores o miedos.",
];

const SYMBOLIC_GUARDRAILS = [
  "Mira principalmente sentido, narrativa y símbolo.",
  "Produce metáforas, territorios, idea fuerza y universo verbal.",
  "No es escribir bonito: no poesía vacía ni metáforas literales de la Base Límbica.",
];

export const THINKING_MODELS: readonly ThinkingModelDefinition[] = [
  {
    key: "limbi",
    publicName: "Limbi",
    shortDescription: "Orquestador automático que elige el mejor enfoque según el reto.",
    selectorMicrocopy: "Elige automáticamente el mejor enfoque según tu reto.",
    bestFor: ["Cuando no estás seguro del ángulo", "Retos mixtos", "Exploración inicial"],
    avoidWhen: ["Necesitas forzar un solo criterio creativo de punta a punta"],
    reasoningRitual: [
      "Clasificar el reto y su momento.",
      "Leer Base de Marca y Base Límbica activas.",
      "Elegir modelo principal y apoyo si aporta.",
      "Explicar brevemente la elección cuando sume valor.",
      "Aplicar el ritual del modelo principal.",
      "Validar coherencia con la marca.",
      "Cerrar con avance útil.",
    ],
    priorities: [
      "Criterio estratégico sobre moda creativa.",
      "Coherencia con Base de Marca.",
      "Claridad de ruta.",
    ],
    guardrails: [
      "No convertirse en asistente genérico sin postura.",
      "No mezclar Empático y Conceptual en un solo rol.",
    ],
    outputBehavior: SHARED_OUTPUT,
    validationChecklist: [
      "¿La elección de modelos tiene razón legible?",
      "¿Se respetó el canon transversal?",
    ],
    version: THINKING_MODEL_VERSION,
  },
  {
    key: "explorer",
    publicName: "Disruptor",
    shortDescription: "Rompe lo obvio con criterio creativo y busca diferenciación memorable.",
    selectorMicrocopy: "Para salir de lo obvio y encontrar ideas más memorables.",
    bestFor: ["Campaña", "activación", "naming", "concepto", "algo diferente"],
    avoidWhen: ["El reto pide solo orden y claridad sin ángulo nuevo"],
    reasoningRitual: [
      "Leer el reto real.",
      "Identificar la respuesta obvia de categoría.",
      "Buscar grieta creativa.",
      "Convertirla en territorio creativo.",
      "Proponer rutas.",
      "Evaluar riesgo y coherencia.",
      "Recomendar siguiente avance.",
    ],
    priorities: ["Diferenciación", "Memorabilidad", "Sorpresa controlada"],
    guardrails: [
      "No confundir creatividad con rareza ni provocación gratuita.",
      "La grieta debe ser defendible con la Base de Marca.",
    ],
    outputBehavior: SHARED_OUTPUT,
    validationChecklist: [
      "¿Hay grieta real frente a lo obvio?",
      "¿El riesgo está evaluado?",
    ],
    version: THINKING_MODEL_VERSION,
  },
  {
    key: "architect",
    publicName: "Planner",
    shortDescription: "Ordena estrategia, mensajes, posicionamiento y estructura defendible.",
    selectorMicrocopy: "Para ordenar estrategia, mensajes y posicionamiento.",
    bestFor: ["Posicionamiento", "estructura", "propuesta de valor", "portafolio", "claridad"],
    avoidWhen: ["El reto es puramente emocional-simbólico sin necesidad de arquitectura"],
    reasoningRitual: [
      "Identificar objetivo estratégico.",
      "Separar información de interpretación.",
      "Encontrar eje ordenador.",
      "Jerarquizar mensajes.",
      "Detectar vacíos o contradicciones.",
      "Proponer estructura.",
      "Dejar avance claro.",
    ],
    priorities: ["Eje estratégico", "Jerarquía de mensajes", "Ruta clara"],
    guardrails: [
      "No volverse frío, corporativo genérico ni matar la emoción por exceso de orden.",
    ],
    outputBehavior: SHARED_OUTPUT,
    validationChecklist: ["¿Hay eje ordenador?", "¿Los mensajes están jerarquizados?"],
    version: THINKING_MODEL_VERSION,
  },
  {
    key: "empathic",
    publicName: "Empático",
    shortDescription: "Lee audiencia, emociones, barreras y motivaciones para abrir el mensaje.",
    selectorMicrocopy: "Para entender a la audiencia, sus barreras y motivaciones.",
    bestFor: ["Audiencia", "confianza", "comunidad", "percepción", "barreras"],
    avoidWhen: ["El reto es solo estructura comercial sin dimensión humana"],
    reasoningRitual: [
      "Identificar audiencia real.",
      "Leer emoción actual probable.",
      "Detectar barrera principal.",
      "Identificar deseo o motivación.",
      "Construir puente emocional.",
      "Traducir en comunicación accionable.",
      "Cerrar con decisión útil.",
    ],
    priorities: EMPATHIC_GUARDRAILS,
    guardrails: EMPATHIC_GUARDRAILS,
    outputBehavior: SHARED_OUTPUT,
    validationChecklist: [
      "¿La barrera y el puente son específicos?",
      "¿Se evitó manipulación emocional?",
    ],
    version: THINKING_MODEL_VERSION,
  },
  {
    key: "symbolic",
    publicName: "Conceptual",
    shortDescription: "Traduce símbolos, atmósferas y sentido en territorios narrativos.",
    selectorMicrocopy: "Para convertir símbolos, atmósferas y sentido en narrativa.",
    bestFor: ["Narrativa", "storytelling", "manifiesto", "tono", "atmósfera", "metáfora"],
    avoidWhen: ["El reto pide solo conversión directa sin capa simbólica"],
    reasoningRitual: [
      "Leer propósito profundo.",
      "Leer Base Límbica como señal, no instrucción literal.",
      "Identificar imagen dominante.",
      "Traducir imagen en territorio narrativo.",
      "Definir tono, ritmo y campo semántico.",
      "Conectar símbolo con audiencia.",
      "Convertir en salida accionable.",
    ],
    priorities: SYMBOLIC_GUARDRAILS,
    guardrails: SYMBOLIC_GUARDRAILS,
    outputBehavior: SHARED_OUTPUT,
    validationChecklist: [
      "¿Hay territorio narrativo accionable?",
      "¿Se evitó poesía vacía?",
    ],
    version: THINKING_MODEL_VERSION,
  },
  {
    key: "commercial",
    publicName: "Comercial",
    shortDescription: "Convierte valor en decisión, prueba, promesa y acción.",
    selectorMicrocopy: "Para convertir valor en decisión, prueba y acción.",
    bestFor: ["Venta", "conversión", "leads", "pauta", "landing", "objeciones"],
    avoidWhen: ["El reto es solo exploración simbólica sin decisión"],
    reasoningRitual: [
      "Identificar oferta real.",
      "Identificar audiencia y momento de decisión.",
      "Detectar objeción principal.",
      "Traducir atributos en beneficios.",
      "Construir promesa comercial.",
      "Elegir prueba adecuada.",
      "Definir CTA.",
      "Cerrar con ruta de conversión.",
    ],
    priorities: ["Decisión", "Prueba", "Promesa creíble", "CTA"],
    guardrails: [
      "No sonar agresivo, inventar resultados ni usar urgencias falsas.",
    ],
    outputBehavior: SHARED_OUTPUT,
    validationChecklist: [
      "¿La promesa es creíble con la evidencia?",
      "¿Hay CTA y ruta de conversión?",
    ],
    version: THINKING_MODEL_VERSION,
  },
] as const;

export const DEFAULT_THINKING_MODEL_KEY: ThinkingModelKey = "limbi";

/** Opciones visibles en UI (orden de producto). */
export const THINKING_MODEL_SELECTOR_OPTIONS = [
  "limbi",
  "explorer",
  "architect",
  "empathic",
  "symbolic",
  "commercial",
] as const satisfies readonly ThinkingModelKey[];

export type ResolvedThinkingModel = {
  selectedKey: ThinkingModelKey;
  primaryKey: ThinkingModelKey;
  secondaryKey: ThinkingModelKey | null;
  /** Texto breve para el usuario cuando Limbi elige (español). */
  creativeOrientationSummary: string | null;
  isAutoResolved: boolean;
};

export function getThinkingModelByKey(key: string): ThinkingModelDefinition | undefined {
  return THINKING_MODELS.find((m) => m.key === key);
}

export function isThinkingModelKey(key: string): key is ThinkingModelKey {
  return THINKING_MODELS.some((m) => m.key === key);
}

function normalizeChallengeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

type SignalRule = {
  key: Exclude<ThinkingModelKey, "limbi">;
  patterns: RegExp[];
  weight: number;
};

const SIGNAL_RULES: SignalRule[] = [
  {
    key: "commercial",
    weight: 3,
    patterns: [
      /\b(venta|vender|conversion|convertir|leads?|pauta|landing|pitch|objecion|cta|comercial|roi|funnel)\b/,
      /\blanzamiento comercial\b/,
    ],
  },
  {
    key: "explorer",
    weight: 3,
    patterns: [
      /\b(campana|activacion|naming|concepto creativo|algo diferente|disruptiv|memorable|sorprend)\b/,
      /\b(ideas? mas creativas?|salir de lo obvio)\b/,
    ],
  },
  {
    key: "architect",
    weight: 3,
    patterns: [
      /\b(posicionamiento|estructura|propuesta de valor|portafolio|claridad|presentacion|ordenar)\b/,
      /\b(jerarqui[sz]a de mensajes|mapa estrategico)\b/,
    ],
  },
  {
    key: "empathic",
    weight: 3,
    patterns: [
      /\b(audiencia|confianza|cercania|comunidad|percepcion|miedo|barrera|motivacion|empati)\b/,
      /\b(causa social|movilizador)\b/,
    ],
  },
  {
    key: "symbolic",
    weight: 3,
    patterns: [
      /\b(narrativa|storytelling|manifiesto|tono|atmosfera|metafora|universo verbal|simbolo)\b/,
      /\b(territorio narrativo|idea fuerza)\b/,
    ],
  },
];

function scoreModels(challengeText: string): Map<Exclude<ThinkingModelKey, "limbi">, number> {
  const normalized = normalizeChallengeText(challengeText);
  const scores = new Map<Exclude<ThinkingModelKey, "limbi">, number>();
  for (const rule of SIGNAL_RULES) {
    let score = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) score += rule.weight;
    }
    if (score > 0) scores.set(rule.key, score);
  }
  return scores;
}

function pickTop(
  scores: Map<Exclude<ThinkingModelKey, "limbi">, number>,
): [Exclude<ThinkingModelKey, "limbi">, Exclude<ThinkingModelKey, "limbi"> | null] {
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return ["architect", null];
  const primary = ranked[0]![0];
  const secondary = ranked[1] && ranked[1][1] >= ranked[0]![1] * 0.6 ? ranked[1][0] : null;
  return [primary, secondary];
}

function applyCombinationOverrides(
  normalized: string,
  primary: Exclude<ThinkingModelKey, "limbi">,
  secondary: Exclude<ThinkingModelKey, "limbi"> | null,
): { primary: Exclude<ThinkingModelKey, "limbi">; secondary: Exclude<ThinkingModelKey, "limbi"> | null } {
  const has = (re: RegExp) => re.test(normalized);

  if (
    has(/\b(lanzamiento|lanzar)\b/) &&
    (has(/\b(creativ|campana|concepto)\b/) || has(/\b(venta|vender|conversion)\b/)) &&
    has(/\b(venta|vender|conversion|comercial)\b/)
  ) {
    return { primary: "commercial", secondary: "explorer" };
  }
  if (has(/\b(reposicionamiento|reposicionar)\b/) && has(/\b(narrativa|manifiesto|simbolo)\b/)) {
    return { primary: "architect", secondary: "symbolic" };
  }
  if (has(/\b(causa social|movilizador)\b/)) {
    return { primary: "empathic", secondary: "symbolic" };
  }
  if (has(/\b(pitch|presentacion comercial|deck)\b/) && has(/\b(vendedor|venta|conversion)\b/)) {
    return { primary: "architect", secondary: "commercial" };
  }
  if (has(/\b(campana cultural|cultural)\b/) && has(/\b(simbolo|simbolico|icono)\b/)) {
    return { primary: "explorer", secondary: "symbolic" };
  }

  return { primary, secondary };
}

function buildOrientationSummary(
  primary: ThinkingModelDefinition,
  secondary: ThinkingModelDefinition | null,
): string {
  if (!secondary) {
    return `Para este reto voy a pensarlo principalmente desde ${primary.publicName}.`;
  }
  return `Para este reto voy a pensarlo principalmente desde ${primary.publicName}, con apoyo de ${secondary.publicName}, porque el reto combina ${primary.shortDescription.toLowerCase().replace(/\.$/, "")} y ${secondary.shortDescription.toLowerCase().replace(/\.$/, "")}.`;
}

/**
 * Resuelve modelo principal/secundario para Brainstormer.
 * Si `selectedKey` no es `limbi`, fija ese modelo sin secundario.
 */
export function resolveThinkingModelForBrainstormer(args: {
  selectedKey: ThinkingModelKey;
  challengeText: string;
}): ResolvedThinkingModel {
  if (args.selectedKey !== "limbi") {
    return {
      selectedKey: args.selectedKey,
      primaryKey: args.selectedKey,
      secondaryKey: null,
      creativeOrientationSummary: null,
      isAutoResolved: false,
    };
  }

  const normalized = normalizeChallengeText(args.challengeText);
  const scores = scoreModels(args.challengeText);
  let [primary, secondary] = pickTop(scores);
  const overridden = applyCombinationOverrides(normalized, primary, secondary);
  primary = overridden.primary;
  secondary = overridden.secondary;

  const primaryDef = getThinkingModelByKey(primary)!;
  const secondaryDef = secondary ? getThinkingModelByKey(secondary) : null;

  return {
    selectedKey: "limbi",
    primaryKey: primary,
    secondaryKey: secondary,
    creativeOrientationSummary: buildOrientationSummary(primaryDef, secondaryDef ?? null),
    isAutoResolved: true,
  };
}

export function formatThinkingModelChipLabel(args: {
  thinking_model_key: ThinkingModelKey;
  resolved_primary_model_key: ThinkingModelKey | null;
  resolved_secondary_model_key: ThinkingModelKey | null;
}): string {
  if (args.thinking_model_key !== "limbi") {
    const m = getThinkingModelByKey(args.thinking_model_key);
    return m?.publicName ?? "Limbi";
  }
  if (!args.resolved_primary_model_key) return "Limbi";
  const primary = getThinkingModelByKey(args.resolved_primary_model_key);
  const secondary = args.resolved_secondary_model_key
    ? getThinkingModelByKey(args.resolved_secondary_model_key)
    : null;
  if (!primary) return "Limbi";
  if (!secondary) return primary.publicName;
  return `${primary.publicName} + ${secondary.publicName}`;
}

/** Canon transversal — límites obligatorios (capa 1). Va antes del Working Brief en el prompt. */
export function buildLimbiThinkingCanonPromptBlock(): string {
  const canonBlock = LIMBI_THINKING_CANON.map((r) => `- ${r}`).join("\n");
  return [
    "LIMBI THINKING CANON (transversal mandatory boundaries — prevents unsafe, untrue, off-brand or strategically weak outputs; does not neutralize the active thinking model)",
    "",
    canonBlock,
  ].join("\n");
}

/** Clichés que Disruptor debe rechazar activamente (tests / referencia interna). */
export const DISRUPTOR_FORBIDDEN_GENERIC_CONCEPTS: readonly string[] = [
  "Explora lo extraordinario",
  "Descubre lo inesperado",
  "Viaje de descubrimiento",
  "Aventura de lo extraordinario",
  "Momentos mágicos",
  "Experiencia única",
  "aventura de descubrimiento",
  "curiosidad genérica",
] as const;

const THINKING_MODEL_DELTAS: Record<ThinkingModelKey, string> = {
  explorer:
    "DISRUPTOR: Rompe lo obvio de categoría. Evita la familia genérica de descubrimiento / aventura / curiosidad vacía. Busca ruptura, ironía, deseo inesperado, contraste cultural, humor con criterio o una idea conversable. Una recomendación con filo, no menú de paraguas.",
  commercial:
    "COMERCIAL: Convierte la idea en compra. Conecta concepto → deseo → producto real → landing → CTA → compra. Identifica fricción, objeción, prueba y razón para actuar. No quedarse en expectativa, comunidad o experiencia si no hay puente comercial.",
  architect: [
    "PLANNER — arquitectura de campaña y secuencia estratégica.",
    "Ordenar expectativa → lanzamiento → conversión → sostenimiento en una línea clara; qué va antes y por qué.",
    "Sin volverse táctico (no listar canales, piezas ni calendario); priorizar decisiones de fase.",
  ].join(" "),
  empathic: [
    "EMPÁTICO — audiencia real antes que concepto decorativo.",
    "Partir de barrera, motivación y emoción concreta del contexto; lectura humana sin tono sentimental ni copy de encuesta.",
    "La emoción debe explicar por qué la idea le importa a alguien, no adornarla.",
  ].join(" "),
  symbolic: [
    "CONCEPTUAL — territorio narrativo e idea madre.",
    "Construir metáfora o universo verbal preciso (imagen que sostiene la marca); no redacción decorativa ni adjetivos vacíos.",
    "La idea debe poder vivir como territorio, no como tagline genérico.",
  ].join(" "),
  limbi:
    "LIMBI — orquesta el lente que mejor sirva al pedido; una voz conversacional sin mezclar rituales de otros modelos.",
};

/** Delta interno por clave (tests de diferenciación). */
export function getCompactThinkingModelDelta(key: ThinkingModelKey): string {
  return THINKING_MODEL_DELTAS[key];
}

/** Delta corto de comportamiento (v3 prompt simplificado). */
export function buildCompactThinkingModelPromptBlock(args: {
  resolved: ResolvedThinkingModel;
}): string {
  const primary = getThinkingModelByKey(args.resolved.primaryKey);
  const secondary = args.resolved.secondaryKey
    ? getThinkingModelByKey(args.resolved.secondaryKey)
    : null;
  if (!primary) return "";

  const delta =
    THINKING_MODEL_DELTAS[primary.key] ?? primary.priorities.slice(0, 2).join("; ");
  const support = secondary
    ? ` | apoyo: ${THINKING_MODEL_DELTAS[secondary.key] ?? secondary.publicName}`
    : "";
  const orientation = args.resolved.creativeOrientationSummary?.trim()
    ? ` | auto: ${args.resolved.creativeOrientationSummary.slice(0, 120)}`
    : "";

  const selected =
    args.resolved.selectedKey === "limbi"
      ? "Limbi (auto)"
      : (getThinkingModelByKey(args.resolved.selectedKey)?.publicName ?? args.resolved.selectedKey);

  return `THINKING MODEL (internal — ${primary.publicName}${secondary ? ` + ${secondary.publicName}` : ""}, selected: ${selected})
Delta: ${delta} (no repetir etiquetas del modelo en assistant_message)${support}${orientation}`;
}

export function buildThinkingModelPromptBlock(args: {
  resolved: ResolvedThinkingModel;
}): string {
  const primary = getThinkingModelByKey(args.resolved.primaryKey);
  const secondary = args.resolved.secondaryKey
    ? getThinkingModelByKey(args.resolved.secondaryKey)
    : null;

  if (!primary) return "";

  const modelSections = (model: ThinkingModelDefinition, role: "PRIMARY" | "SUPPORT") => {
    return `
THINKING MODEL (${role}): ${model.publicName} [${model.key}]
Description: ${model.shortDescription}
Priorities: ${model.priorities.join("; ")}
Guardrails: ${model.guardrails.join("; ")}
Reasoning ritual: ${model.reasoningRitual.map((s, i) => `${i + 1}. ${s}`).join(" ")}
Output behavior: ${model.outputBehavior.join(" ")}
Validation: ${model.validationChecklist.join("; ")}`.trim();
  };

  const orientation =
    args.resolved.creativeOrientationSummary?.trim().length
      ? `\nAUTO ORIENTATION (Limbi): ${args.resolved.creativeOrientationSummary}`
      : "";

  const boundaryNote =
    primary.key === "empathic" || secondary?.key === "empathic" || primary.key === "symbolic" || secondary?.key === "symbolic"
      ? "\nBOUNDARY: Empático (audiencia/comportamiento) y Conceptual (sentido/símbolo/narrativa) are distinct lenses — do not merge them."
      : "";

  return `
ACTIVE THINKING MODEL (main reasoning engine for HOW — layer 4)
Use the Conversation Contract to determine the required response type for this turn.
Use the active Thinking Model below as the main reasoning engine for how to build that response.
The canon and brand context are boundaries, not a neutral tone.
Do NOT let canon or contract neutralize this model into a generic assistant voice.

USER SELECTED MODE: ${args.resolved.selectedKey === "limbi" ? "Limbi (automatic orchestrator)" : getThinkingModelByKey(args.resolved.selectedKey)?.publicName ?? args.resolved.selectedKey}
${orientation}
${boundaryNote}

${modelSections(primary, "PRIMARY")}
${secondary ? modelSections(secondary, "SUPPORT") : ""}

If primary + support: primary leads HOW; support informs a secondary angle without diluting the response type required by the contract.
`.trim();
}

/** Texto de reto para clasificación automática. */
export function buildChallengeTextForThinkingModelResolution(args: {
  sessionTitle: string;
  currentChallenge: string;
  lastUserMessage: string;
  initialChallenge?: string;
}): string {
  return [args.sessionTitle, args.currentChallenge, args.lastUserMessage, args.initialChallenge ?? ""]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
}
