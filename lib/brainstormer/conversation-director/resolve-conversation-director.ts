import { isBareAffirmationWithoutSubstance } from "@/lib/intake/conversational-engine/bare-confirmation";
import { resolveNextQuestion } from "@/lib/brainstormer/question-engine";
import { detectConsultingStyle } from "@/lib/brainstormer/consulting-style";
import {
  buildCredentialsInquiryDirective,
  detectCredentialsInquiry,
} from "@/lib/brainstormer/credentials-inquiry";
import { detectDeliverableBuilding } from "@/lib/brainstormer/deliverable-building-mode";
import { THIRD_PARTY_IP_GUARDRAIL_NOTE_ES } from "@/lib/brainstormer/third-party-ip-guardrail";
import { detectOptionSelection } from "@/lib/brainstormer/option-selection-advancement";
import type { SelectedOptionFocus } from "@/lib/brainstormer/option-selection-advancement/types";
import {
  detectUserMaterialReference,
  detectWorkModeAndTransition,
} from "@/lib/brainstormer/conversation-director/detect-work-mode-and-transition";
import { sanitizeConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/sanitize-conversation-director-decision";
import { truncateDirectorSignal } from "@/lib/brainstormer/conversation-director/truncate-director-signal";
import type {
  ConversationDirectorAssistantMove,
  ConversationDirectorChallengeType,
  ConversationDirectorDecision,
  ConversationDirectorProjectReadiness,
  ConversationDirectorStage,
  ConversationDirectorUserIntent,
  ConversationDirectorWorkMode,
  ResolveConversationDirectorInput,
} from "@/lib/brainstormer/conversation-director/types";
import type { BrainstormerQuestionAsksFor } from "@/lib/brainstormer/question-engine/types";

function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export function classifyChallengeType(userMessage: string): ConversationDirectorChallengeType {
  const t = normalizeForMatch(userMessage);

  if (
    hasAny(t, [
      /\bposicionamiento\b/,
      /\bposicionarme\b/,
      /\bposicionamos\b/,
      /\bposicionar(me)?\b/,
      /\breconocimiento\b/,
      /\bautoridad publica\b/,
      /\bpercepcion del mercado\b/,
      /\bque el mercado entienda\b/,
    ])
  ) {
    return "positioning";
  }

  if (
    hasAny(t, [
      /\binvestiga\b/,
      /\binvestigar\b/,
      /\bbenchmark\b/,
      /\bque estan haciendo otros\b/,
      /\bque hacen otros\b/,
      /\bcompetencia\b/,
      /\breferentes\b/,
    ]) &&
    hasAny(t, [/\bevento/, /\beventos\b/, /\bfestival\b/, /\bconcierto\b/])
  ) {
    return "event_promotion";
  }

  if (hasAny(t, [/\bboleta/, /\bboletas\b/, /\btickets?\b/, /\bvender\b/, /\bventas\b/, /\bconversion\b/, /\bcierre\b/])) {
    if (hasAny(t, [/\bevento/, /\beventos\b/, /\bfestival\b/, /\bshow\b/])) {
      return "event_promotion";
    }
    return "sales";
  }

  if (hasAny(t, [/\bcampana\b/, /\blanzamiento\b/, /\b360\b/, /\bmediatica amplia\b/])) {
    return "campaign";
  }

  if (
    hasAny(t, [
      /\bcontenido\b/,
      /\bredes\b/,
      /\beditorial\b/,
      /\bpiezas\b/,
      /\binstagram\b/,
      /\btiktok\b/,
      /\bposteo\b/,
    ])
  ) {
    return "content";
  }

  if (hasAny(t, [/\bactivacion\b/, /\bexperiencia presencial\b/, /\bbrand activation\b/])) {
    return "activation";
  }

  if (hasAny(t, [/\baudiovisual\b/, /\bvideo\b/, /\breels?\b/, /\bspots?\b/, /\bfilmar\b/])) {
    return "audiovisual";
  }

  if (
    hasAny(t, [
      /\bevento/,
      /\beventos\b/,
      /\bfestival\b/,
      /\bpromove(r|mos)\b/,
      /\bpromocion de evento\b/,
      /\bpromover (el )?evento\b/,
    ])
  ) {
    return "event_promotion";
  }

  if (hasAny(t, [/\bestrategia\b/, /\breto estrategico\b/, /\bplan estrategico\b/])) {
    return "general_strategy";
  }

  return "unknown";
}

export function classifyUserIntent(
  userMessage: string,
  challengeType: ConversationDirectorChallengeType,
): ConversationDirectorUserIntent {
  const t = normalizeForMatch(userMessage);

  if (isBareAffirmationWithoutSubstance(userMessage)) {
    return "unclear";
  }

  if (
    hasAny(t, [
      /\bno entiendo\b/,
      /\bno me queda claro\b/,
      /\bno me quedo claro\b/,
      /\bexplicame mejor\b/,
      /\bexplicalo mejor\b/,
      /\bestoy perdido\b/,
      /\bme perdi\b/,
    ])
  ) {
    return "needs_clarity";
  }

  if (
    hasAny(t, [
      /\bconvertir(en)? (en )?proyecto\b/,
      /\bpasar a proyecto\b/,
      /\bcrear (un )?proyecto\b/,
      /\bhazlo proyecto\b/,
      /\bconviertelo en proyecto\b/,
      /\barmar(el)? proyecto\b/,
    ])
  ) {
    return "wants_project";
  }

  if (
    hasAny(t, [
      /\binvestiga\b/,
      /\binvestigar\b/,
      /\bbenchmark\b/,
      /\bque estan haciendo\b/,
      /\bque hacen otros\b/,
      /\breferentes externos\b/,
      /\bbusca en (la )?web\b/,
      /\bbuscar en internet\b/,
    ])
  ) {
    return "ask_for_research";
  }

  if (
    hasAny(t, [
      /\bya deberias saber\b/,
      /\besta en la base\b/,
      /\bde la base\b/,
      /\bno me entendiste\b/,
      /\beso no es\b/,
      /\bincorrecto\b/,
      /\bno es asi\b/,
      /\bya lo tienes\b/,
      /\bpor que preguntas eso\b/,
    ])
  ) {
    return "correct_assistant";
  }

  if (hasAny(t, [/\bplan\b/, /\bpasos\b/, /\broadmap\b/, /\bestructura(r)?\b/, /\bcronograma\b/])) {
    return "ask_for_plan";
  }

  if (hasAny(t, [/\bideas\b/, /\bopciones\b/, /\balternativas\b/, /\bpropuestas\b/])) {
    return "ask_for_ideas";
  }

  if (hasAny(t, [/\bte parece\b/, /\bvalidas\b/, /\bestoy en lo correcto\b/, /\bconfirmas\b/])) {
    return "ask_validation";
  }

  if (detectCredentialsInquiry(userMessage)) {
    return "ask_credentials";
  }

  if (
    hasAny(t, [
      /\bcomo\b/,
      /\bcomo puedo\b/,
      /\bcomo hago\b/,
      /\bnecesito vender\b/,
      /\bque hago para\b/,
    ])
  ) {
    return "ask_how";
  }

  if (
    hasAny(t, [
      /\bquiero mejorar\b/,
      /\bquiero explorar\b/,
      /\bexplorar\b/,
      /\bpensar\b/,
      /\bordenar\b/,
    ]) ||
    (challengeType === "positioning" && hasAny(t, [/\bquiero\b/, /\bnecesito\b/]))
  ) {
    return "explore";
  }

  if (hasAny(t, [/\bquiero\b/, /\bnecesito\b/, /\bme gustaria\b/])) {
    return "explore";
  }

  return "unclear";
}

export function deriveConversationStage(
  input: ResolveConversationDirectorInput,
): ConversationDirectorStage {
  const { session_progress, user_message_count } = input;
  const summary = session_progress.session_summary.trim();
  const challenge = session_progress.current_challenge.trim();
  const objective = session_progress.preliminary_objective.trim();

  if (
    session_progress.project_readiness === "high" ||
    session_progress.should_suggest_project_conversion
  ) {
    return "ready_for_project_seed";
  }

  if (objective.length > 0 || summary.length > 400) {
    return "structuring";
  }

  if (challenge.length > 0) {
    return "focusing";
  }

  if (user_message_count <= 1 && summary.length < 80) {
    return "opening";
  }

  if (summary.length > 0 || user_message_count >= 2) {
    return "exploration";
  }

  return "opening";
}

function pickKnownFromBrandBase(
  challengeType: ConversationDirectorChallengeType,
  signals: ResolveConversationDirectorInput["brand_signals"],
): string[] {
  const out: string[] = [];
  const push = (items: readonly string[], label: string) => {
    if (items.length > 0) {
      const body = items
        .slice(0, 3)
        .map((item) => truncateDirectorSignal(item, 160))
        .join("; ");
      out.push(truncateDirectorSignal(`${label}: ${body}`));
    }
  };

  switch (challengeType) {
    case "positioning":
    case "general_strategy":
      push(signals.identity_or_positioning, "Identidad / posicionamiento");
      push(signals.differentiators, "Diferenciadores");
      push(signals.credibility_assets, "Activos de credibilidad");
      break;
    case "sales":
    case "event_promotion":
      push(signals.audiences, "Audiencias");
      push(signals.offer_or_roles, "Oferta");
      push(signals.credibility_assets, "Prueba social / credibilidad");
      break;
    case "campaign":
      push(signals.audiences, "Audiencias");
      push(signals.differentiators, "Diferenciadores");
      push(signals.identity_or_positioning, "Marca / territorio");
      break;
    case "content":
      push(signals.tone_or_limbic_cues, "Tono / atmósfera");
      push(signals.audiences, "Audiencias");
      push(signals.identity_or_positioning, "Territorios editoriales");
      break;
    case "activation":
    case "audiovisual":
      push(signals.offer_or_roles, "Oferta / formatos");
      push(signals.tone_or_limbic_cues, "Experiencia / tono");
      push(signals.audiences, "Audiencias");
      break;
    default:
      push(signals.identity_or_positioning, "Identidad");
      push(signals.audiences, "Audiencias");
      push(signals.offer_or_roles, "Oferta");
  }

  if (signals.guardrails.length > 0) {
    const body = signals.guardrails
      .slice(0, 2)
      .map((g) => truncateDirectorSignal(g, 200))
      .join("; ");
    out.push(truncateDirectorSignal(`Guardrails: ${body}`));
  }

  return out.slice(0, 8);
}

function pickMissingInformation(
  challengeType: ConversationDirectorChallengeType,
  userIntent: ConversationDirectorUserIntent,
  stage: ConversationDirectorStage,
): string[] {
  const missing: string[] = [];

  switch (challengeType) {
    case "positioning":
      missing.push(
        "Prioridad del posicionamiento (venta vs autoridad vs visibilidad pública)",
        "Horizonte temporal del reto",
      );
      break;
    case "sales":
    case "event_promotion":
      missing.push("Meta de ventas / boletas", "Plazo", "Canal principal de conversión");
      break;
    case "campaign":
      missing.push("Objetivo de campaña", "Audiencia prioritaria", "Plazo de lanzamiento");
      break;
    case "content":
      missing.push("Canal prioritario", "Frecuencia / cadencia", "Objetivo del contenido");
      break;
    case "activation":
      missing.push("Tipo de experiencia", "Escala / logística", "KPI de activación");
      break;
    case "audiovisual":
      missing.push("Formato y duración", "Uso del pieza", "Plazo de producción");
      break;
    default:
      missing.push("Definición concreta del reto en esta sesión");
  }

  if (userIntent === "ask_for_research") {
    missing.push("Criterios de benchmark (competidores, geografía, periodo)");
  }

  if (stage === "opening") {
    missing.push("Contexto operativo inmediato del usuario");
  }

  return missing.slice(0, 6).map((m) => truncateDirectorSignal(m));
}

function resolveAssistantMove(args: {
  challengeType: ConversationDirectorChallengeType;
  userIntent: ConversationDirectorUserIntent;
  stage: ConversationDirectorStage;
  projectReadiness: ConversationDirectorProjectReadiness;
  workMode: ConversationDirectorWorkMode;
  multiDeliverableProjectShape: boolean;
  selectedOptionFocus: SelectedOptionFocus | null;
}): ConversationDirectorAssistantMove {
  const {
    challengeType,
    userIntent,
    stage,
    projectReadiness,
    workMode,
    multiDeliverableProjectShape,
    selectedOptionFocus,
  } = args;

  if (userIntent === "correct_assistant" || userIntent === "needs_clarity") {
    return "repair_and_reframe";
  }
  if (userIntent === "build_deliverable_content") {
    return "propose_micro_plan";
  }
  if (userIntent === "ask_credentials") {
    return "give_hypothesis_then_question";
  }
  if (userIntent === "selected_option") {
    if (selectedOptionFocus === "has_notes_to_share") return "ask_one_strategic_question";
    if (selectedOptionFocus === "confirm_ideas") return "compare_options";
    return "give_hypothesis_then_question";
  }
  if (userIntent === "ask_for_research" || workMode === "research_needed") return "suggest_research";
  if (
    workMode === "project_seed" ||
    multiDeliverableProjectShape ||
    userIntent === "wants_project" ||
    (stage === "ready_for_project_seed" && projectReadiness !== "low")
  ) {
    return "suggest_project_seed";
  }
  if (workMode === "deliverable_building") {
    return "propose_micro_plan";
  }
  if (userIntent === "ask_for_plan") return "propose_micro_plan";
  if (userIntent === "ask_for_ideas") return "compare_options";

  if (challengeType === "positioning" && (userIntent === "explore" || userIntent === "unclear")) {
    return "give_hypothesis_then_question";
  }

  if (userIntent === "ask_how" || userIntent === "unclear") {
    return "ask_one_strategic_question";
  }

  if (userIntent === "ask_validation") {
    return "give_hypothesis_then_question";
  }

  if (userIntent === "explore" && challengeType === "positioning") {
    return "give_hypothesis_then_question";
  }

  return "ask_one_strategic_question";
}

function resolveProjectReadiness(
  input: ResolveConversationDirectorInput,
  stage: ConversationDirectorStage,
  userIntent: ConversationDirectorUserIntent,
  workMode: ConversationDirectorWorkMode,
  multiDeliverableProjectShape: boolean,
): ConversationDirectorProjectReadiness {
  const fromProgress = input.session_progress.project_readiness;
  if (fromProgress === "high") return "high";
  if (userIntent === "wants_project" || workMode === "project_seed" || multiDeliverableProjectShape) {
    return "high";
  }
  if (workMode === "deliverable_building") return "medium";
  if (stage === "ready_for_project_seed") return fromProgress === "medium" ? "medium" : "high";
  if (stage === "structuring") return "medium";
  return fromProgress;
}

function applyMaterialRequestQuestion(args: {
  should_request_user_material: boolean;
  material_kind: string | null;
  requested_material_reason: string | null;
  fallback_question: string;
  fallback_id: string;
  fallback_asks_for: BrainstormerQuestionAsksFor;
  fallback_reason: string;
}): {
  next_best_question: string;
  question_id: string;
  question_asks_for: BrainstormerQuestionAsksFor;
  question_reason: string;
} {
  if (!args.should_request_user_material) {
    return {
      next_best_question: args.fallback_question,
      question_id: args.fallback_id,
      question_asks_for: args.fallback_asks_for,
      question_reason: args.fallback_reason,
    };
  }

  const kind = args.material_kind ?? "archivo";
  const question =
    kind === "Word"
      ? "¿Puedes subir el Word o pegar aquí el contenido base?"
      : `¿Puedes subir el ${kind} o pegar aquí el contenido base?`;

  return {
    next_best_question: question,
    question_id: "brain9-request-user-material",
    question_asks_for: "resources",
    question_reason:
      args.requested_material_reason ??
      "Hace falta el insumo del usuario antes de redactar piezas finales.",
  };
}

/**
 * Capa determinística BRAIN-6: decide el movimiento conversacional antes del renderer.
 */
export function resolveConversationDirector(
  input: ResolveConversationDirectorInput,
): ConversationDirectorDecision {
  let challenge_type = classifyChallengeType(input.user_message);
  let user_intent = classifyUserIntent(input.user_message, challenge_type);

  const optionSelectionPreview = detectOptionSelection({
    user_message: input.user_message,
    conversation_excerpt: input.conversation_excerpt,
  });

  const deliverableBuilding = detectDeliverableBuilding({
    user_message: input.user_message,
    conversation_excerpt: input.conversation_excerpt,
  });

  if (deliverableBuilding.should_generate_content_now) {
    user_intent = "build_deliverable_content";
  } else if (optionSelectionPreview.user_selected_previous_option) {
    user_intent = "selected_option";
    if (optionSelectionPreview.updated_challenge_type) {
      challenge_type = optionSelectionPreview.updated_challenge_type;
    }
  }

  const optionSelection =
    deliverableBuilding.user_has_no_material &&
    optionSelectionPreview.selected_option_focus === "has_notes_to_share"
      ? {
          ...optionSelectionPreview,
          user_selected_previous_option: false,
          selected_option_focus: null,
          preferred_next_question: null,
          preferred_question_id: null,
        }
      : optionSelectionPreview;

  const conversation_stage = deriveConversationStage(input);
  const known_from_brand_base = pickKnownFromBrandBase(challenge_type, input.brand_signals);
  const missing_information = pickMissingInformation(challenge_type, user_intent, conversation_stage);

  const workModeResult = detectWorkModeAndTransition({
    user_message: input.user_message,
    conversation_excerpt: input.conversation_excerpt,
    user_intent,
    challenge_type,
    session_progress: input.session_progress,
  });

  const effectiveWorkMode =
    deliverableBuilding.should_generate_content_now ||
    deliverableBuilding.user_has_no_material
      ? "deliverable_building"
      : workModeResult.work_mode;

  const project_readiness = resolveProjectReadiness(
    input,
    conversation_stage,
    user_intent,
    workModeResult.work_mode,
    workModeResult.multi_deliverable_project_shape,
  );

  const assistant_move = resolveAssistantMove({
    challengeType: challenge_type,
    userIntent: user_intent,
    stage: conversation_stage,
    projectReadiness: project_readiness,
    workMode: effectiveWorkMode,
    multiDeliverableProjectShape: workModeResult.multi_deliverable_project_shape,
    selectedOptionFocus: optionSelection.selected_option_focus,
  });

  const resolvedQuestion = resolveNextQuestion({
    challenge_type,
    user_intent,
    conversation_stage,
    assistant_move,
    known_from_brand_base,
    missing_information,
    user_selected_previous_option: optionSelection.user_selected_previous_option,
    session_progress: input.session_progress,
  });

  const materialRef = detectUserMaterialReference(
    `${input.conversation_excerpt}\n${input.user_message}`,
  );

  const consultingStyle = detectConsultingStyle({
    user_message: input.user_message,
    conversation_excerpt: input.conversation_excerpt,
    challenge_type,
  });

  const optionAdvancementDirective =
    optionSelection.user_selected_previous_option && consultingStyle.user_insight_anchor
      ? detectOptionSelection(
          {
            user_message: input.user_message,
            conversation_excerpt: input.conversation_excerpt,
          },
          { user_insight_anchor: consultingStyle.user_insight_anchor },
        ).advancement_directive
      : optionSelection.advancement_directive;

  let consulting_style_directive = consultingStyle.consulting_style_directive;
  if (optionAdvancementDirective) {
    consulting_style_directive = truncateDirectorSignal(
      `${optionAdvancementDirective}\n\n${consulting_style_directive}`,
      2000,
    );
  }
  if (deliverableBuilding.deliverable_building_directive) {
    consulting_style_directive = truncateDirectorSignal(
      `${deliverableBuilding.deliverable_building_directive}\n\n${consulting_style_directive}`,
      2000,
    );
  }

  const credentialsDirective = buildCredentialsInquiryDirective({
    user_message: input.user_message,
    challenge_type,
    brand_signals: {
      identity_or_positioning: [...input.brand_signals.identity_or_positioning],
      audiences: [...input.brand_signals.audiences],
      offer_or_roles: [...input.brand_signals.offer_or_roles],
      differentiators: [...input.brand_signals.differentiators],
      credibility_assets: [...input.brand_signals.credibility_assets],
      tone_or_limbic_cues: [...input.brand_signals.tone_or_limbic_cues],
      guardrails: [...input.brand_signals.guardrails],
    },
    current_deliverable_type: deliverableBuilding.current_deliverable_type,
  });
  if (credentialsDirective) {
    consulting_style_directive = truncateDirectorSignal(
      `${credentialsDirective}\n\n${consulting_style_directive}`,
      2000,
    );
  }

  let consultingPreferredClosing = consultingStyle.preferred_closing_question;
  if (deliverableBuilding.user_has_no_material) {
    if (
      consultingPreferredClosing &&
      /notas|pegar|subir|word/i.test(consultingPreferredClosing)
    ) {
      consultingPreferredClosing = null;
    }
    if (consulting_style_directive) {
      consulting_style_directive = consulting_style_directive
        .replace(/Pide comparar con sus notas[^.\n]*[.\n]?/gi, "")
        .replace(/Pregunta si ya tiene notas[^.\n]*[.\n]?/gi, "")
        .replace(/la versión buena sale de sus notas/gi, "construye desde la base de marca y el hilo de sesión")
        .trim();
    }
  }

  let {
    next_best_question,
    question_id,
    question_asks_for,
    question_reason,
  } = applyMaterialRequestQuestion({
    should_request_user_material:
      workModeResult.should_request_user_material &&
      !deliverableBuilding.user_has_no_material &&
      !optionSelection.user_selected_previous_option,
    material_kind: materialRef.material_kind,
    requested_material_reason: workModeResult.requested_material_reason,
    fallback_question: resolvedQuestion.question,
    fallback_id: resolvedQuestion.candidate_id,
    fallback_asks_for: resolvedQuestion.asks_for,
    fallback_reason: resolvedQuestion.reason,
  });

  if (deliverableBuilding.should_generate_content_now && deliverableBuilding.preferred_next_question) {
    next_best_question = deliverableBuilding.preferred_next_question;
    question_id = "brain12-section-draft-followup";
    question_asks_for = "decision";
    question_reason = truncateDirectorSignal(
      "BRAIN-12: tras borrador de sección, una pregunta sobre tono o siguiente sección.",
      2000,
    );
  } else if (optionSelection.user_selected_previous_option && optionSelection.preferred_next_question) {
    next_best_question = optionSelection.preferred_next_question;
    question_id = optionSelection.preferred_question_id ?? "brain11-option-advance";
    question_asks_for = "decision";
    question_reason = truncateDirectorSignal(
      "BRAIN-11: el usuario eligió una opción; avanzar a la siguiente micro-decisión, no re-preguntar si seguimos.",
      2000,
    );
  } else if (consultingPreferredClosing) {
    next_best_question = consultingPreferredClosing;
    question_id = `brain10-${consultingStyle.consulting_style_mode}`;
    question_asks_for = "decision";
    question_reason = truncateDirectorSignal(
      `Cierre alineado al modo consultivo: ${consultingStyle.consulting_style_mode}.`,
      2000,
    );
  }

  const should_use_web_search = user_intent === "ask_for_research";
  const web_search_reason = should_use_web_search
    ? challenge_type === "event_promotion"
      ? "Necesita benchmarking externo reciente."
      : "El usuario pidió investigación o referentes externos."
    : null;

  const should_suggest_project_conversion =
    user_intent === "wants_project" ||
    workModeResult.work_mode === "project_seed" ||
    workModeResult.multi_deliverable_project_shape ||
    (workModeResult.work_mode === "deliverable_building" && project_readiness !== "low") ||
    (conversation_stage === "ready_for_project_seed" && project_readiness !== "low");

  let transition_message = workModeResult.transition_message;
  if (workModeResult.world_cup_ip_guardrail && !transition_message) {
    transition_message = truncateDirectorSignal(THIRD_PARTY_IP_GUARDRAIL_NOTE_ES, 1200);
  }

  return sanitizeConversationDirectorDecision({
    challenge_type,
    user_intent,
    conversation_stage,
    known_from_brand_base,
    missing_information,
    assistant_move,
    next_best_question,
    question_id,
    question_asks_for,
    question_reason,
    should_use_web_search,
    web_search_reason,
    should_suggest_project_conversion,
    project_readiness,
    work_mode: effectiveWorkMode,
    concrete_deliverable_detected: workModeResult.concrete_deliverable_detected,
    detected_deliverable_type: workModeResult.detected_deliverable_type,
    should_request_user_material:
      workModeResult.should_request_user_material && !deliverableBuilding.user_has_no_material,
    requested_material_reason: workModeResult.requested_material_reason,
    transition_message,
    world_cup_ip_guardrail: workModeResult.world_cup_ip_guardrail,
    consulting_style_mode: consultingStyle.consulting_style_mode,
    consulting_style_directive,
    user_insight_anchor: consultingStyle.user_insight_anchor,
    typo_avoid_terms: consultingStyle.typo_avoid_terms,
    allow_structured_sections_list:
      consultingStyle.allow_structured_sections_list ||
      deliverableBuilding.should_generate_content_now ||
      deliverableBuilding.deliverable_build_depth === "section_draft",
    user_selected_previous_option: optionSelection.user_selected_previous_option,
    selected_option_focus: optionSelection.selected_option_focus,
    option_advancement_directive: optionAdvancementDirective,
    user_has_no_material: deliverableBuilding.user_has_no_material,
    current_deliverable_type: deliverableBuilding.current_deliverable_type,
    current_deliverable_section: deliverableBuilding.current_deliverable_section,
    deliverable_build_depth: deliverableBuilding.deliverable_build_depth,
    should_generate_content_now: deliverableBuilding.should_generate_content_now,
    deliverable_building_directive: deliverableBuilding.deliverable_building_directive,
  });
}
