import type { BrainstormerQuestionCandidate } from "@/lib/brainstormer/question-engine/types";

/**
 * Banco de preguntas estratégicas por reto y etapa.
 * El resolver prioriza según missing_information, stage e avoid_if_known.
 */
export const BRAINSTORMER_QUESTION_BANK: readonly BrainstormerQuestionCandidate[] = [
  // —— Movimientos transversales (cualquier reto) ——
  {
    id: "cross-repair-prioritize",
    challenge_type: "unknown",
    stage: "opening",
    question:
      "¿Qué priorizamos ahora con lo que ya está en la base: percepción, oferta o canal?",
    asks_for: "decision",
    priority: 100,
  },
  {
    id: "cross-research-benchmark-criteria",
    challenge_type: "unknown",
    stage: "opening",
    question: "¿Qué criterios debe cumplir el benchmark (sector, geografía, periodo)?",
    asks_for: "evidence",
    priority: 100,
  },
  {
    id: "cross-research-event-references",
    challenge_type: "event_promotion",
    stage: "opening",
    question:
      "¿Qué tipo de eventos o competidores quieres que tomemos como referencia (tamaño, ciudad, fecha)?",
    asks_for: "evidence",
    priority: 100,
  },
  {
    id: "cross-project-seed-type",
    challenge_type: "unknown",
    stage: "ready_for_project_seed",
    question:
      "¿Quieres que armemos el proyecto con foco en campaña, contenido, activación o promoción de evento?",
    asks_for: "decision",
    priority: 100,
  },
  {
    id: "cross-plan-horizon",
    challenge_type: "unknown",
    stage: "structuring",
    question: "¿Prefieres un plan de 2 semanas o uno de 30 días para este reto?",
    asks_for: "deadline",
    priority: 100,
  },
  {
    id: "cross-compare-routes",
    challenge_type: "unknown",
    stage: "exploration",
    question: "¿Cuál de estas rutas te acerca más al objetivo inmediato?",
    asks_for: "decision",
    priority: 100,
  },
  {
    id: "cross-unclear-continue-challenge",
    challenge_type: "unknown",
    stage: "focusing",
    question: "¿Seguimos profundizando en el reto actual o cambiamos de foco?",
    asks_for: "decision",
    priority: 85,
  },
  {
    id: "cross-fallback-two-week-outcome",
    challenge_type: "unknown",
    stage: "opening",
    question: "¿Cuál es el resultado concreto que necesitas en las próximas dos semanas?",
    asks_for: "objective",
    priority: 10,
  },

  // —— Posicionamiento ——
  {
    id: "positioning-opening-perception-priority",
    challenge_type: "positioning",
    stage: "opening",
    question:
      "¿Quieres que este posicionamiento trabaje más para vender consultoría, conseguir conferencias o fortalecer autoridad pública?",
    asks_for: "perception_priority",
    priority: 100,
    avoid_if_known: ["Prioridad del posicionamiento"],
  },
  {
    id: "positioning-opening-positioning-goal",
    challenge_type: "positioning",
    stage: "opening",
    question:
      "¿Qué cambio de percepción buscas primero: que te conozcan, que te prefieran o que te paguen más?",
    asks_for: "positioning_goal",
    priority: 90,
  },
  {
    id: "positioning-exploration-evidence",
    challenge_type: "positioning",
    stage: "exploration",
    question:
      "¿Qué activo de credibilidad de la base quieres que lidere la narrativa en los próximos 90 días?",
    asks_for: "evidence",
    priority: 88,
    avoid_if_known: ["Activos de credibilidad"],
  },
  {
    id: "positioning-focusing-decision",
    challenge_type: "positioning",
    stage: "focusing",
    question:
      "¿Confirmamos un solo territorio de percepción o mantenemos dos rutas en paralelo por ahora?",
    asks_for: "decision",
    priority: 92,
  },
  {
    id: "positioning-structuring-deadline",
    challenge_type: "positioning",
    stage: "structuring",
    question: "¿Para cuándo necesitas ver señales claras de ese posicionamiento en el mercado?",
    asks_for: "deadline",
    priority: 86,
    avoid_if_known: ["Horizonte temporal"],
  },

  // —— Ventas ——
  {
    id: "sales-opening-sales-gap",
    challenge_type: "sales",
    stage: "opening",
    question: "¿Cuántas boletas faltan por vender y cuánto tiempo queda?",
    asks_for: "sales_gap",
    priority: 100,
    avoid_if_known: ["Meta de ventas"],
  },
  {
    id: "sales-opening-conversion-block",
    challenge_type: "sales",
    stage: "opening",
    question: "¿Qué frena más la venta hoy: precio, desconocimiento, confianza o distribución?",
    asks_for: "conversion_block",
    priority: 95,
  },
  {
    id: "sales-exploration-audience",
    challenge_type: "sales",
    stage: "exploration",
    question: "¿A qué segmento de audiencia le estás vendiendo primero según la base?",
    asks_for: "audience_priority",
    priority: 88,
    avoid_if_known: ["Audiencias"],
  },
  {
    id: "sales-exploration-channels",
    challenge_type: "sales",
    stage: "exploration",
    question: "¿Cuál canal de conversión vas a priorizar esta semana: directo, aliados o paid?",
    asks_for: "channels",
    priority: 92,
    avoid_if_known: ["Canal principal"],
  },
  {
    id: "sales-focusing-channels",
    challenge_type: "sales",
    stage: "focusing",
    question: "¿Cuál canal de conversión vas a priorizar esta semana: directo, aliados o paid?",
    asks_for: "channels",
    priority: 90,
    avoid_if_known: ["Canal principal"],
  },

  // —— Promoción de evento ——
  {
    id: "event-opening-sales-gap",
    challenge_type: "event_promotion",
    stage: "opening",
    question: "¿Cuántas entradas faltan, a qué precio y con qué fecha límite?",
    asks_for: "sales_gap",
    priority: 100,
    avoid_if_known: ["Meta de ventas"],
  },
  {
    id: "event-exploration-audience",
    challenge_type: "event_promotion",
    stage: "exploration",
    question: "¿Qué perfil de asistente priorizas para llenar el evento más rápido?",
    asks_for: "audience_priority",
    priority: 92,
  },
  {
    id: "event-focusing-channels",
    challenge_type: "event_promotion",
    stage: "focusing",
    question: "¿Dónde concentrarás el push de boletas: redes, aliados, email o venta en puerta?",
    asks_for: "channels",
    priority: 90,
  },

  // —— Campaña ——
  {
    id: "campaign-opening-objective",
    challenge_type: "campaign",
    stage: "opening",
    question:
      "¿Cuál es el objetivo principal de la campaña (awareness, leads, ventas) y para cuándo?",
    asks_for: "objective",
    priority: 100,
    avoid_if_known: ["Objetivo de campaña"],
  },
  {
    id: "campaign-exploration-audience",
    challenge_type: "campaign",
    stage: "exploration",
    question: "¿Qué audiencia es imprescindible para que la campaña funcione?",
    asks_for: "audience_priority",
    priority: 92,
    avoid_if_known: ["Audiencia prioritaria"],
  },
  {
    id: "campaign-focusing-resources",
    challenge_type: "campaign",
    stage: "focusing",
    question: "¿Qué presupuesto o recursos internos tienes confirmados para ejecutar?",
    asks_for: "resources",
    priority: 88,
  },
  {
    id: "campaign-structuring-deadline",
    challenge_type: "campaign",
    stage: "structuring",
    question: "¿Cuál es la fecha de lanzamiento que no se puede mover?",
    asks_for: "deadline",
    priority: 90,
    avoid_if_known: ["Plazo de lanzamiento"],
  },

  // —— Contenido ——
  {
    id: "content-opening-channels",
    challenge_type: "content",
    stage: "opening",
    question: "¿Qué canal es prioritario y con qué frecuencia realista puedes sostenerlo?",
    asks_for: "channels",
    priority: 100,
    avoid_if_known: ["Canal prioritario"],
  },
  {
    id: "content-opening-content-goal",
    challenge_type: "content",
    stage: "opening",
    question: "¿El contenido debe construir autoridad, generar leads o sostener ventas?",
    asks_for: "content_goal",
    priority: 95,
    avoid_if_known: ["Objetivo del contenido"],
  },
  {
    id: "content-exploration-audience",
    challenge_type: "content",
    stage: "exploration",
    question: "¿A quién le hablas primero con este contenido según tu base de marca?",
    asks_for: "audience_priority",
    priority: 88,
    avoid_if_known: ["Audiencias"],
  },
  {
    id: "content-focusing-format",
    challenge_type: "content",
    stage: "focusing",
    question: "¿Qué formato te da más retorno ahora: video corto, carrusel, live o artículo?",
    asks_for: "format",
    priority: 86,
  },

  // —— Activación ——
  {
    id: "activation-opening-context",
    challenge_type: "activation",
    stage: "opening",
    question:
      "¿Qué experiencia quieres que la gente recuerde al salir de la activación?",
    asks_for: "activation_context",
    priority: 100,
    avoid_if_known: ["Tipo de experiencia"],
  },
  {
    id: "activation-exploration-audience",
    challenge_type: "activation",
    stage: "exploration",
    question: "¿Quién debe vivir la activación primero: clientes, comunidad o prensa?",
    asks_for: "audience_priority",
    priority: 92,
  },
  {
    id: "activation-focusing-resources",
    challenge_type: "activation",
    stage: "focusing",
    question: "¿Qué escala y logística tienes definida (lugar, capacidad, staff)?",
    asks_for: "resources",
    priority: 88,
    avoid_if_known: ["Escala / logística"],
  },

  // —— Audiovisual ——
  {
    id: "audiovisual-opening-format",
    challenge_type: "audiovisual",
    stage: "opening",
    question: "¿Qué formato y duración necesitas, y dónde se publicará la pieza?",
    asks_for: "format",
    priority: 100,
    avoid_if_known: ["Formato y duración"],
  },
  {
    id: "audiovisual-opening-objective",
    challenge_type: "audiovisual",
    stage: "opening",
    question: "¿La pieza debe explicar, emocionar o convertir — y a quién?",
    asks_for: "objective",
    priority: 95,
    avoid_if_known: ["Uso del pieza"],
  },
  {
    id: "audiovisual-structuring-deadline",
    challenge_type: "audiovisual",
    stage: "structuring",
    question: "¿Cuál es la fecha tope de entrega de la pieza?",
    asks_for: "deadline",
    priority: 90,
    avoid_if_known: ["Plazo de producción"],
  },

  // —— Estrategia general ——
  {
    id: "strategy-opening-objective",
    challenge_type: "general_strategy",
    stage: "opening",
    question: "¿Cuál es el resultado de negocio que quieres mover en las próximas 4 semanas?",
    asks_for: "objective",
    priority: 100,
  },
  {
    id: "strategy-exploration-decision",
    challenge_type: "general_strategy",
    stage: "exploration",
    question: "¿Qué decisión estratégica te está bloqueando avanzar hoy?",
    asks_for: "decision",
    priority: 92,
  },
  {
    id: "strategy-focusing-evidence",
    challenge_type: "general_strategy",
    stage: "focusing",
    question: "¿Qué evidencia de la base te da más confianza para apostar por esa ruta?",
    asks_for: "evidence",
    priority: 88,
  },
] as const;
