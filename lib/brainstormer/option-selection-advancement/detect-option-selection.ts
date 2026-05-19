import type {
  OptionSelectionDetectionInput,
  OptionSelectionDetectionResult,
  SelectedOptionFocus,
} from "@/lib/brainstormer/option-selection-advancement/types";
import { detectUserDeclaredNoMaterial } from "@/lib/brainstormer/deliverable-building-mode";
import { truncateDirectorSignal } from "@/lib/brainstormer/conversation-director/truncate-director-signal";
import { isBareAffirmationWithoutSubstance } from "@/lib/intake/conversational-engine/bare-confirmation";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function lastAssistantMessage(excerpt: string): string {
  const blocks = excerpt.split(/\n\n+/);
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i] ?? "";
    if (/^assistant:/i.test(b.trim())) {
      return normalize(b.replace(/^assistant:\s*/i, ""));
    }
  }
  return "";
}

function assistantAskedPositioningPriority(lastAssistant: string): boolean {
  return hasAny(lastAssistant, [
    /consultor[ií]a.*conferencias.*autoridad/,
    /vender consultor[ií]a.*conferencias/,
    /posicionamiento trabaje mas para/,
    /consultorias.*conferencias.*autoridad publica/,
  ]);
}

function assistantOfferedIdeas(lastAssistant: string): boolean {
  return hasAny(lastAssistant, [
    /\bideas\b/,
    /\bopciones\b/,
    /\brutas\b/,
    /\bte propongo\b/,
    /\bpodemos explorar\b/,
  ]);
}

const FOCUS_MATCHERS: ReadonlyArray<{
  focus: SelectedOptionFocus;
  patterns: RegExp[];
}> = [
  {
    focus: "get_conferences",
    patterns: [
      /^conseguir conferencias?\.?$/,
      /^conferencias?\.?$/,
      /\bconseguir conferencias?\b/,
      /\bmas conferencias?\b/,
      /\bfoco en conferencias?\b/,
    ],
  },
  {
    focus: "sell_consulting",
    patterns: [
      /^vender consultor[ií]as?\.?$/,
      /^consultor[ií]as?\.?$/,
      /\bvender consultor[ií]a\b/,
      /\bfoco en consultor[ií]a\b/,
    ],
  },
  {
    focus: "public_authority",
    patterns: [
      /^fortalecer autoridad publica\.?$/,
      /^autoridad publica\.?$/,
      /\bfortalecer autoridad\b/,
      /\bautoridad publica\b/,
      /\bvisibilidad publica\b/,
    ],
  },
];

function matchSelectedFocus(userMessage: string, lastAssistant: string): SelectedOptionFocus | null {
  const u = normalize(userMessage);
  if (u.length === 0 || u.length > 120) return null;

  if (/\bposicionamiento\b/.test(u) && /\bconferencias?\b/.test(u) && u.length > 40) {
    return null;
  }

  for (const { focus, patterns } of FOCUS_MATCHERS) {
    if (patterns.some((p) => p.test(u))) {
      return focus;
    }
  }

  if (!assistantAskedPositioningPriority(lastAssistant)) return null;

  if (/\bconferencias?\b/.test(u) && !/\bconsultor/.test(u)) return "get_conferences";
  if (/\bconsultor/.test(u)) return "sell_consulting";
  if (/\bautoridad\b/.test(u)) return "public_authority";

  return null;
}

function buildAdvancementDirective(
  focus: SelectedOptionFocus,
  userInsightAnchor: string | null,
): string {
  const insightLine = userInsightAnchor
    ? `Eje ya en sesión: ${userInsightAnchor}`
    : "";

  const base = `MODO AVANCE TRAS DECISIÓN (BRAIN-11):
- El usuario YA eligió una opción; NO preguntes "¿seguimos profundizando o cambiamos de foco?".
- Reconoce la decisión en una frase ("Perfecto. Entonces…").
- Avanza a la SIGUIENTE micro-decisión con postura consultiva (mi lectura es / yo lo enfocaría).
${insightLine}`;

  switch (focus) {
    case "get_conferences":
      return truncateDirectorSignal(
        `${base}
- Nuevo foco: empaquetar oferta de conferencia vendible (no posicionamiento genérico).
- Menciona 2–3 rutas de empaquetado (liderazgo, reputación, creatividad estratégica) dentro de la hipótesis, luego UNA pregunta de priorización.`,
        2000,
      );
    case "sell_consulting":
      return truncateDirectorSignal(
        `${base}
- Nuevo foco: convertir autoridad en oferta de consultoría vendible.
- Siguiente paso: priorizar tipo de consultoría o cliente ideal — no reabrir posicionamiento general.`,
        2000,
      );
    case "public_authority":
      return truncateDirectorSignal(
        `${base}
- Nuevo foco: autoridad pública / percepción (no venta directa ni solo conferencias).
- Siguiente paso: qué señal pública priorizar en 90 días.`,
        2000,
      );
    case "confirm_ideas":
      return truncateDirectorSignal(
        `${base}
- El usuario confirmó ("sí"); entrega 2–3 ideas o rutas CONCRETAS en prosa breve (no lista larga).
- Luego UNA pregunta para elegir cuál desarrollar primero.`,
        2000,
      );
    case "has_notes_to_share":
      return truncateDirectorSignal(
        `${base}
- Tiene notas pero no las pegó: pide pegar o subir ANTES de estructura final.
- Referencia el eje de la sesión si existe.`,
        2000,
      );
  }
}

function preferredQuestionForFocus(focus: SelectedOptionFocus): {
  question: string;
  id: string;
} {
  switch (focus) {
    case "get_conferences":
      return {
        id: "brain11-advance-conference-package",
        question:
          "¿Cuál quieres empaquetar primero como conferencia: liderazgo, reputación o creatividad estratégica?",
      };
    case "sell_consulting":
      return {
        id: "brain11-advance-consulting-package",
        question:
          "¿Qué tipo de consultoría quieres priorizar primero: estrategia, comunicación o equipos?",
      };
    case "public_authority":
      return {
        id: "brain11-advance-public-authority",
        question:
          "¿Qué señal de autoridad pública quieres mover primero: visibilidad, credibilidad o demanda inbound?",
      };
    case "confirm_ideas":
      return {
        id: "brain11-advance-after-confirm",
        question: "¿Cuál de estas rutas quieres desarrollar primero en esta sesión?",
      };
    case "has_notes_to_share":
      return {
        id: "brain11-advance-paste-notes",
        question: "¿Puedes pegar tus notas aquí o subirlas para cruzarlas con el eje de la sesión?",
      };
  }
}

function challengeTypeForFocus(
  focus: SelectedOptionFocus,
): OptionSelectionDetectionResult["updated_challenge_type"] {
  switch (focus) {
    case "get_conferences":
      return "event_promotion";
    case "sell_consulting":
      return "sales";
    case "public_authority":
      return "positioning";
    default:
      return null;
  }
}

export function detectUserHasNotesOnly(userMessage: string, conversationExcerpt = ""): boolean {
  if (conversationExcerpt && detectUserDeclaredNoMaterial(conversationExcerpt)) {
    return false;
  }
  const t = normalize(userMessage);
  return hasAny(t, [
    /^tengo(\s+unas)?\s+notas\.?$/,
    /^tengo\s+notas\.?$/,
    /^ya tengo notas\.?$/,
    /^tengo\s+unas\s+notas\s+en\s+word\.?$/,
  ]);
}

/**
 * BRAIN-11: detecta cuando el usuario eligió una opción de la pregunta anterior.
 */
export function detectOptionSelection(
  input: OptionSelectionDetectionInput,
  options?: { user_insight_anchor?: string | null },
): OptionSelectionDetectionResult {
  const lastAssistant = lastAssistantMessage(input.conversation_excerpt);

  if (detectUserHasNotesOnly(input.user_message, input.conversation_excerpt)) {
    const focus: SelectedOptionFocus = "has_notes_to_share";
    return {
      user_selected_previous_option: true,
      selected_option_focus: focus,
      advancement_directive: buildAdvancementDirective(focus, options?.user_insight_anchor ?? null),
      preferred_next_question: preferredQuestionForFocus(focus).question,
      preferred_question_id: preferredQuestionForFocus(focus).id,
      updated_challenge_type: null,
    };
  }

  if (isBareAffirmationWithoutSubstance(input.user_message) && assistantOfferedIdeas(lastAssistant)) {
    const focus: SelectedOptionFocus = "confirm_ideas";
    return {
      user_selected_previous_option: true,
      selected_option_focus: focus,
      advancement_directive: buildAdvancementDirective(focus, options?.user_insight_anchor ?? null),
      preferred_next_question: preferredQuestionForFocus(focus).question,
      preferred_question_id: preferredQuestionForFocus(focus).id,
      updated_challenge_type: null,
    };
  }

  const focus = matchSelectedFocus(input.user_message, lastAssistant);
  if (!focus) {
    return {
      user_selected_previous_option: false,
      selected_option_focus: null,
      advancement_directive: null,
      preferred_next_question: null,
      preferred_question_id: null,
      updated_challenge_type: null,
    };
  }

  const pq = preferredQuestionForFocus(focus);

  return {
    user_selected_previous_option: true,
    selected_option_focus: focus,
    advancement_directive: buildAdvancementDirective(focus, options?.user_insight_anchor ?? null),
    preferred_next_question: pq.question,
    preferred_question_id: pq.id,
    updated_challenge_type: challengeTypeForFocus(focus),
  };
}
