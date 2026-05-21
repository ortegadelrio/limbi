/**
 * Contrato de turno derivado solo de BrainstormerTurnInterpretation (sin re-interpretar).
 */

import type { ThinkingModelKey } from "@/lib/ai/thinking-models";
import type {
  BrainstormerTurnIntent,
  BrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { GENERIC_TACTIC_PATTERNS } from "@/lib/brainstormer/conversation-contract";
import { VISIBLE_FRAMEWORK_HEADERS_FORBIDDEN } from "@/lib/brainstormer/brainstormer-natural-voice";
import type { BrainstormerTurnInterpretation, ResponseMode } from "@/lib/brainstormer/turn-interpreter";
import {
  buildCompactDeliverHintForResponseMode,
  mapInterpretationToTurnIntent,
} from "@/lib/brainstormer/turn-interpreter";
import {
  buildConfirmedUmbrellaAnchor,
  userExplicitlyRequestsNewOptions,
} from "@/lib/brainstormer/working-brief-memory";

const BASE_FORBIDDEN = [
  "cierres genéricos vacíos",
  "pedir archivo/brief en ideación",
  "Mi recomendación es una dirección clara",
  "alineada al pedido del usuario",
  "Yo trabajaría «",
  "como eje de la campaña",
  "usar el mensaje del usuario como paraguas",
  "usar el mensaje del usuario como eje",
];

export function buildObligationForResponseMode(
  mode: ResponseMode,
  brief: BrainstormerWorkingBrief,
  ctx: {
    thinkingPrimaryKey: ThinkingModelKey | null;
    userMessage: string;
  },
): { obligation: string; forbidden: string[] } {
  const constraints =
    brief.active_constraints.length > 0
      ? ` Respeta: ${brief.active_constraints.slice(-4).join("; ")}.`
      : "";
  const rejected =
    brief.rejected_paths.length > 0
      ? ` No retomes: ${brief.rejected_paths.slice(-3).join(" | ")}.`
      : "";
  const { anchor } = buildConfirmedUmbrellaAnchor(
    brief,
    userExplicitlyRequestsNewOptions(ctx.userMessage),
  );
  const forbidden = [
    ...GENERIC_TACTIC_PATTERNS.map((p) => p.source),
    ...BASE_FORBIDDEN,
    ...VISIBLE_FRAMEWORK_HEADERS_FORBIDDEN,
  ];

  const base =
    "Responder la pregunta del usuario en prosa directa. No usar su mensaje completo como paraguas ni eje de campaña.";

  switch (mode) {
    case "guide_to_concept":
      return {
        obligation: `${base} Guiar al siguiente paso estratégico.${constraints}${rejected}`,
        forbidden,
      };
    case "answer_audience":
      return {
        obligation: `${base} Responder audiencia con criterio; no bloquear por falta de paraguas.${constraints}${rejected}`,
        forbidden,
      };
    case "validate_concept":
      return {
        obligation: `${base} Validar el concepto confirmado si existe.${anchor}${constraints}${rejected}`,
        forbidden,
      };
    case "propose_alternatives":
      return {
        obligation: `${base} Reconocer rechazo; ofrecer alternativas sin citar el mensaje como concepto.${constraints}${rejected}`,
        forbidden,
      };
    case "explain_simple":
      return {
        obligation: `${base} Explicar más simple; no proponer un eje creativo nuevo.${constraints}${rejected}`,
        forbidden,
      };
    case "advance_next_step":
      return {
        obligation: `${base} Explicar el orden de pasos y cómo seguir.${anchor}${constraints}${rejected}`,
        forbidden,
      };
    case "answer_tactic_if_ready":
      return {
        obligation: `${base} Responder la táctica solo si el paraguas ya está cerrado.${anchor}${constraints}${rejected}`,
        forbidden,
      };
    case "answer_conversion":
      return {
        obligation: `${base} Explicar puente hacia compra en página.${anchor}${constraints}${rejected}`,
        forbidden,
      };
    case "conduct_external_research":
      return {
        obligation:
          `${base} Activar investigación externa: hallazgos con fuentes, lectura estratégica Limbi, relevancia para sesión. ` +
          "Diferenciar hallazgo de interpretación. No guardar en Brand DNA ni paraguas sin aprobación del usuario.",
        forbidden: [...forbidden, "afirmar hallazgos como verdad de marca", "actualizar paraguas desde referentes"],
      };
    case "prepare_project_handoff":
      return {
        obligation:
          `${base} Evaluar madurez para Proyecto; si falta algo, máximo 1–2 preguntas concretas. ` +
          "Si está listo, confirmar y devolver resumen de transferencia (project_handoff_preview). No repetir la respuesta creativa anterior ni seguir brainstormeando.",
        forbidden: [...forbidden, "repetir campaña anterior", "seguir proponiendo conceptos"],
      };
    default:
      return {
        obligation: base + constraints,
        forbidden,
      };
  }
}

function buildObligationForLegacyTurnIntent(
  turn_intent: BrainstormerTurnIntent,
  brief: BrainstormerWorkingBrief,
  ctx: { userMessage: string },
): { obligation: string; forbidden: string[] } | null {
  const base =
    "Responder la pregunta del usuario en prosa directa. No usar su mensaje completo como paraguas ni eje.";
  const forbidden = [
    ...GENERIC_TACTIC_PATTERNS.map((p) => p.source),
    ...BASE_FORBIDDEN,
    ...VISIBLE_FRAMEWORK_HEADERS_FORBIDDEN,
  ];

  if (turn_intent === "campaign_stage_inquiry") {
    return {
      obligation: `${base} Ubicar la pieza en el marco de campaña (expectativa → lanzamiento → conversión).`,
      forbidden,
    };
  }
  return null;
}

export function buildContractPayloadFromInterpretation(args: {
  brief: BrainstormerWorkingBrief;
  interpretation: BrainstormerTurnInterpretation;
  thinkingPrimaryKey?: ThinkingModelKey | null;
  userMessage: string;
}): {
  turn_intent: BrainstormerTurnIntent;
  brief: BrainstormerWorkingBrief;
  response_obligation: string;
  prompt_deliver_hint: string;
  forbidden_response_patterns: string[];
} {
  const turn_intent = mapInterpretationToTurnIntent(args.interpretation, {
    userMessage: args.userMessage,
  });
  const brief = { ...args.brief, current_request_type: turn_intent };
  const ctx = {
    thinkingPrimaryKey: args.thinkingPrimaryKey ?? null,
    userMessage: args.userMessage,
  };
  const legacy = buildObligationForLegacyTurnIntent(turn_intent, brief, ctx);
  const { obligation, forbidden } =
    legacy ??
    buildObligationForResponseMode(args.interpretation.response_mode, brief, ctx);

  return {
    turn_intent,
    brief,
    response_obligation: obligation,
    prompt_deliver_hint: buildCompactDeliverHintForResponseMode(args.interpretation.response_mode),
    forbidden_response_patterns: forbidden,
  };
}
