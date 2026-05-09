import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import { questionForMiniStep } from "@/lib/intake/guided-interview-flow";
import { isStrategicRecommendationOrDelegateAsk } from "@/lib/intake/guided-intake-recommendation-ask";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import type { LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";

/** Suggested chips after explaining “evidencia” (labels only; user sends as free text). */
export const EVIDENCE_CLARIFICATION_SUGGESTED_CHIPS: readonly string[] = [
  "Años de experiencia",
  "Clientes o casos",
  "Datos o cifras",
  "Testimonios",
  "Observaciones o aprendizajes",
  "No tengo evidencia todavía",
] as const;

const EVIDENCE_CHIP_SET = new Set(EVIDENCE_CLARIFICATION_SUGGESTED_CHIPS);

const CLARIFICATION_PHRASE_RES = [
  /no entiendo/i,
  /no sé qué responder/i,
  /no se qué responder/i,
  /qué quieres decir/i,
  /que quieres decir/i,
  /a qué te refieres/i,
  /a que te refieres/i,
  /qué significa/i,
  /que significa/i,
  /me das ejemplos/i,
  /qué tipo de dato/i,
  /que tipo de dato/i,
  /eso qué es/i,
  /eso que es/i,
  /no entiendo la pregunta/i,
  /explícame/i,
  /explicame/i,
  /explíqueme/i,
  /qué es lo que/i,
  /que es lo que/i,
  /cómo debo responder/i,
  /como debo responder/i,
  /no me queda claro/i,
  /puedes aclarar/i,
  /me lo explicas/i,
];

/**
 * Fast path: meta-questions about the current prompt (not substantive answers).
 * Deliberately conservative on long prose to avoid blocking real answers.
 */
export function detectDeterministicClarificationIntent(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 4) return false;
  if (EVIDENCE_CHIP_SET.has(t)) return false;
  /** Let capture-phase orientation handle “¿qué pongo?” / “¿a quién me recomiendas?” — not prompt gloss. */
  if (isStrategicRecommendationOrDelegateAsk(t)) return false;

  for (const re of CLARIFICATION_PHRASE_RES) {
    if (re.test(t)) return true;
  }

  if (/[?¿]/.test(t)) {
    if (t.length > 220) return false;
    if (
      /^(¿|\s)*(qué|cómo|por qué|porque|quién|quien|a qué|a que|para qué|para que|me puedes|puedes|dónde|donde|cuándo|cuando|por qué|porque)\b/i.test(
        t,
      )
    ) {
      return true;
    }
  }

  return false;
}

/** Normalize persisted trace so follow-up / advance logic runs on `main` / `follow_up`. */
export function traceForLlmProcessing(
  trace: LimbicInterviewTraceV1,
): LimbicInterviewTraceV1 {
  if (
    trace.phase === "clarifying_question" ||
    trace.phase === "strategy_validation" ||
    trace.phase === "segment_confirmation"
  ) {
    return { ...trace, phase: "main" };
  }
  return trace;
}

export type ClarificationTurnContent = {
  interviewer_message: string;
  next_question: string;
  suggested_chips: string[];
};

export function buildClarificationTurnContent(params: {
  miniStep: GuidedMiniStepId;
  challengeType: string | null;
  otherChallenge: boolean;
}): ClarificationTurnContent {
  const { miniStep, challengeType, otherChallenge } = params;
  const bank = questionForMiniStep(
    miniStep,
    challengeType,
    otherChallenge,
  );

  switch (miniStep) {
    case "tailored_what":
      return {
        interviewer_message:
          "Cuando pregunto qué ofreces y qué problema resuelve, busco una descripción concreta de tu producto, servicio o iniciativa y la situación o necesidad que atiende para las personas o equipos involucrados. No hace falta redacción perfecta: basta con hechos y contexto.",
        next_question:
          bank ??
          "Cuéntame con tus palabras qué ofreces y qué problema o situación ayuda a resolver.",
        suggested_chips: [],
      };
    case "problem":
      return {
        interviewer_message:
          "Aquí “problema” no es solo algo negativo: es la fricción, la tensión o la necesidad que está en el centro del reto —lo que hace incómoda, cara o confusa la situación hoy. Puede ser falta de claridad, confianza, tiempo, diferenciación, etc.",
        next_question:
          bank ??
          "¿Qué situación, fricción o necesidad concreta está en el centro de este reto?",
        suggested_chips: [],
      };
    case "transformation":
      return {
        interviewer_message:
          "Por “transformación” o beneficio me refiero al cambio que quieres que la gente perciba, sienta o logré cuando tu comunicación y tu oferta funcionan bien: qué deja de preocupar, qué entiende mejor o qué puede hacer después.",
        next_question:
          bank ??
          "¿Qué cambio, resultado o beneficio buscas que la gente sienta o logre cuando esto funciona bien?",
        suggested_chips: [],
      };
    case "audience":
      return {
        interviewer_message:
          "Por audiencia principal me refiero a quién debe entender, creer o actuar primero con este mensaje —a veces quien usa el producto y otras quien autoriza, paga o recomienda. Si hay varios actores, importa quién es el decisor prioritario hoy.",
        next_question:
          bank ??
          "¿A quién debe convencer primero la comunicación hoy, y quiénes son decisores o vetos clave además?",
        suggested_chips: [],
      };
    case "evidence":
      return {
        interviewer_message:
          "Cuando hablo de evidencia me refiero a cualquier dato, prueba, experiencia o referencia que ayude a sostener lo que estás diciendo. Puede ser una cifra, un resultado, un testimonio, años de experiencia, clientes anteriores, casos, observaciones o aprendizajes. Si todavía no tienes evidencia, no pasa nada: lo dejamos marcado como pendiente para que Limbi no invente pruebas ni haga afirmaciones fuertes.",
        next_question:
          "¿Tienes alguna evidencia de este tipo o prefieres continuar sin evidencia por ahora?",
        suggested_chips: [...EVIDENCE_CLARIFICATION_SUGGESTED_CHIPS],
      };
    default:
      return {
        interviewer_message:
          "Te explico con más calma qué estamos buscando en esta pregunta, para que puedas responder con seguridad.",
        next_question:
          bank ??
          "Cuando quieras, responde con lo que sí sepas; lo que falte lo marcaremos como pendiente.",
        suggested_chips: [],
      };
  }
}

/**
 * Evidence step: user signals missing clarity on what to answer, without asking for a
 * definition of “evidencia” (those go through `detectDeterministicClarificationIntent`).
 */
export function detectEvidenceUncertaintyWithoutMetaQuestion(userText: string): boolean {
  if (detectDeterministicClarificationIntent(userText)) return false;
  const t = userText.trim();
  if (t.length < 8) return false;
  const tl = t.toLowerCase();
  if (/\bno tengo claridad\b/i.test(tl)) return true;
  if (/\bno (lo )?tengo claro\b/i.test(tl)) return true;
  if (/\bno puedo aportar evidencia\b/i.test(tl)) return true;
  if (/\ba[uú]n no tengo (datos|pruebas|evidencia)\b/i.test(tl)) return true;
  if (
    /\bno estoy seguro\b/i.test(tl) &&
    !/\b(a qui[eé]n|quien|recomiendas|audiencia|p[uú]blico|convencer)\b/i.test(tl)
  ) {
    return true;
  }
  return false;
}

export function buildClarificationSyntheticExtraction(
  content: ClarificationTurnContent,
): IntakeExtractionOutput {
  return {
    extracted_response_updates: {},
    confidence_by_field: {},
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [...content.suggested_chips],
    answer_status: "missing_choice",
    target_response_paths: [],
    internal_notes: "clarification_question",
    interviewer_message: content.interviewer_message,
    public_copy_allowed: false,
    user_intent: "clarification_question",
  };
}
