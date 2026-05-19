import type { ConversationDirectorAssistantMove } from "@/lib/brainstormer/conversation-director/types";
import type { ConversationDirectorChallengeType } from "@/lib/brainstormer/conversation-director/types";
import type { BrainstormerQuestionAsksFor } from "@/lib/brainstormer/question-engine/types";

const ASKS_FOR_REASON_ES: Record<BrainstormerQuestionAsksFor, string> = {
  objective:
    "Sin objetivo concreto y horizonte, cualquier táctica sería genérica; hay que anclar el resultado esperado.",
  audience_priority:
    "La audiencia prioritaria define mensaje, canal y prueba social; la base ya sugiere segmentos pero falta priorizar para este reto.",
  sales_gap:
    "En ventas/eventos, la meta faltante y el plazo cambian la estrategia antes de proponer tácticas.",
  deadline:
    "El plazo condiciona intensidad, canales y alcance; conviene fijarlo antes de armar rutas.",
  conversion_block:
    "Identificar el freno principal (precio, confianza, distribución) evita recomendar tácticas que no atacan la causa.",
  positioning_goal:
    "El cambio de percepción buscado (conocer, preferir, pagar más) ordena el territorio narrativo.",
  perception_priority:
    "En posicionamiento, hay que priorizar si el territorio trabaja para venta, visibilidad o autoridad antes de ejecutar formatos.",
  evidence:
    "Anclar la pregunta en activos reales de la base reduce dispersión y da credibilidad al siguiente paso.",
  channels:
    "El canal priorizado define esfuerzo y mensaje; sin eso el plan se fragmenta.",
  resources:
    "Presupuesto y recursos internos determinan qué es ejecutable en el horizonte del reto.",
  format:
    "Formato y uso de la pieza definen guion, tono y producción; conviene acotarlos temprano.",
  activation_context:
    "La experiencia memorable es el norte de la activación; lo demás (logística, amplificación) se deriva de ahí.",
  content_goal:
    "El objetivo del contenido (autoridad, leads, ventas) evita piezas decorativas sin función.",
  decision:
    "Hace falta una micro-decisión para avanzar la sesión sin reabrir todo el diagnóstico.",
};

const MOVE_REASON_PREFIX: Partial<Record<ConversationDirectorAssistantMove, string>> = {
  give_hypothesis_then_question:
    "El movimiento es hipótesis con evidencia de marca y luego validación; no abrir con menú de opciones.",
  repair_and_reframe:
    "El usuario señaló desalineación con la base; reparar con hechos concretos y reencuadrar con una sola priorización.",
  suggest_research:
    "Piden benchmark externo; acotar criterios antes de buscar referentes (la búsqueda web aún no está activa).",
  suggest_project_seed:
    "La sesión está lista para sembrar proyecto; confirmar tipo de entregable sin forzar conversión.",
  propose_micro_plan:
    "Pidieron estructura; el horizonte del plan define el nivel de detalle del siguiente paso.",
  compare_options:
    "Pidieron ideas u opciones; cerrar con decisión entre rutas, no con lista larga.",
};

export function buildQuestionReason(args: {
  asks_for: BrainstormerQuestionAsksFor;
  challenge_type: ConversationDirectorChallengeType;
  assistant_move: ConversationDirectorAssistantMove;
  missing_information: readonly string[];
}): string {
  const parts: string[] = [];

  const movePrefix = MOVE_REASON_PREFIX[args.assistant_move];
  if (movePrefix) parts.push(movePrefix);

  const asksReason = ASKS_FOR_REASON_ES[args.asks_for];
  if (asksReason) parts.push(asksReason);

  if (
    (args.challenge_type === "sales" || args.challenge_type === "event_promotion") &&
    args.asks_for === "sales_gap"
  ) {
    parts.push("En ventas/eventos, la meta faltante y el plazo cambian la estrategia antes de proponer tácticas.");
  }

  const topMissing = args.missing_information[0];
  if (topMissing && parts.length < 2) {
    parts.push(`Información faltante prioritaria: ${topMissing}.`);
  }

  const unique = [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
  return unique.slice(0, 3).join(" ");
}
