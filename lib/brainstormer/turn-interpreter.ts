/**
 * Turn Interpreter — única fuente de autoridad para entender el turno del usuario.
 * Solo datos estructurados; no copy ni bloques en el prompt creativo.
 */

import type { ThinkingModelKey } from "@/lib/ai/thinking-models";
import type {
  BrainstormerTurnIntent,
  BrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { userSeeksFeedbackOnProposedConcept } from "@/lib/brainstormer/brainstormer-natural-voice";
import {
  coerceStrategyStage,
  isConceptualLevelCorrection,
  maxStrategyStage,
  type BrainstormerStrategyStage,
} from "@/lib/brainstormer/strategy-journey";
import {
  isExternalResearchRequest,
  isProjectHandoffRequest,
} from "@/lib/brainstormer/special-turn-detectors";
import {
  extractConfirmedConceptualUmbrella,
  extractQuotedConceptCandidate,
  extractRejectedConceptSignal,
  isAudienceStrategyRequest,
  isConceptRejectionOrAlternativeRequest,
  isConversionBridgeRequest,
  isProjectStatusOrLaunchBriefMessage,
  isUserConfusionPhrase,
  isValidConceptualUmbrellaCandidate,
  userReferencesParaguasConfirmation,
} from "@/lib/brainstormer/working-brief-memory";
import { z } from "zod";

export const conversationActSchema = z.enum([
  "asking_strategy",
  "asking_audience",
  "proposing_concept",
  "confirming_concept",
  "rejecting_concept",
  "asking_alternatives",
  "asking_next_step",
  "asking_tactics",
  "user_confusion",
  "changing_focus",
  "validating_concept",
  "external_research_request",
  "project_handoff_request",
]);

export type ConversationAct = z.infer<typeof conversationActSchema>;

export const responseModeSchema = z.enum([
  "guide_to_concept",
  "answer_audience",
  "validate_concept",
  "propose_alternatives",
  "explain_simple",
  "advance_next_step",
  "answer_tactic_if_ready",
  "answer_conversion",
  "conduct_external_research",
  "prepare_project_handoff",
]);

export type ResponseMode = z.infer<typeof responseModeSchema>;

export const memoryUpdateSchema = z.object({
  update_umbrella: z.boolean(),
  umbrella_candidate: z.string().max(200).nullable(),
  reject_current_concept: z.boolean(),
  clear_umbrella: z.boolean(),
});

export type MemoryUpdate = z.infer<typeof memoryUpdateSchema>;

export const interpretedStrategyStageSchema = z.enum([
  "challenge_open",
  "concept_needed",
  "concept_proposed",
  "concept_confirmed",
  "audience_needed",
  "campaign_mechanism_needed",
  "execution_needed",
  "conversion_needed",
  "ready_for_project",
]);

export type InterpretedStrategyStage = z.infer<typeof interpretedStrategyStageSchema>;

export const brainstormerTurnInterpretationSchema = z.object({
  conversation_act: conversationActSchema,
  response_mode: responseModeSchema,
  memory_update: memoryUpdateSchema,
  strategy_stage: interpretedStrategyStageSchema,
});

export type BrainstormerTurnInterpretation = z.infer<typeof brainstormerTurnInterpretationSchema>;

export type InterpretBrainstormerTurnArgs = {
  last_user_message: string;
  conversation_excerpt?: string;
  working_brief: BrainstormerWorkingBrief;
  brand_dna?: string | null;
  thinking_model_key?: ThinkingModelKey | null;
  brand_name?: string;
};

export type InterpretBrainstormerTurnResult = {
  interpretation: BrainstormerTurnInterpretation;
  source: "deterministic" | "openai";
};

const HOW_TO_OR_EXPLAIN_PATTERNS: RegExp[] = [
  /\bcomo\s+hago\s+eso\b/,
  /\bcomo\s+lo\s+hago\b/,
  /\by\s+como\s+hago\b/,
  /\bcomo\s+hacemos\s+eso\b/,
  /\bcomo\s+se\s+hace\b/,
];

const NEXT_STEP_PATTERNS: RegExp[] = [
  /\bque\s+seguir[ií]a\b/,
  /\bqu[eé]\s+seguir[ií]a\b/,
  /\bqu[eé]\s+me\s+aconsejas\b/,
  /\bque\s+me\s+aconsejas\b/,
  /\baconsejas\s+hacer\s+ahora\b/,
  /\bsiguiente\s+paso\b/,
  /\bque\s+sigue\b/,
  /\bqu[eé]\s+hacemos\s+ahora\b/,
  /\bpor\s+donde\s+seguimos\b/,
  /\bruta\s+a\s+seguir\b/,
  /\bcual\s+es\s+la\s+ruta\b/,
  /\bcu[aá]l\s+es\s+la\s+ruta\b/,
];

const CAMPAIGN_STAGE_INQUIRY_PATTERNS: RegExp[] = [
  /qu[eé]\s+etapa\s+de\s+campa[nñ]a/,
  /etapa\s+de\s+campa[nñ]a\s+es/,
  /que\s+etapa\s+de\s+campana/,
];

const VALIDATING_CONCEPT_PATTERNS: RegExp[] = [
  /\bcomo\s+defino\s+si\b/,
  /\bc[oó]mo\s+defino\s+si\b/,
  /\ble\s+pega\s+a\b/,
  /\bpega\s+a\s+(mi\s+)?audiencia\b/,
  /\bvalidar.*audiencia\b/,
  /\bvalidarlo\s+con\s+audiencia\b/,
  /\bconstruyo\s+la\s+campa[nñ]a\b/,
  /\bcomo\s+construyo\s+la\s+campa[nñ]a\b/,
];

const TACTICAL_PATTERNS: RegExp[] = [
  /\bhazme\s+los\s+posts\b/,
  /\blos\s+posts\b/,
  /\btactica(s)?\b/,
  /\bpieza(s)?\b/,
  /\bpost(s)?\b/,
  /\bguion\b/,
  /\bcalendario\b/,
  /\bhashtag\b/,
  /\bpauta\b/,
];

export const CAMPAIGN_EXPECTATION_PATTERNS: RegExp[] = [
  /\bcampana\s+de\s+expectativa\b/,
  /\bexpectativa\s+antes\b/,
  /\bprelanzamiento\b/,
];

const LAUNCH_BRIEF_PATTERNS: RegExp[] = [
  /\bquiero\s+lanzar\b/,
  /\blanzar\s+la\s+marca\b/,
  /\bmarca\s+nueva\b/,
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function hasAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((p) => p.test(normalize(text)));
}

export function priorHasConfirmedConcept(brief: BrainstormerWorkingBrief): boolean {
  const u = brief.confirmed_conceptual_umbrella.trim();
  return Boolean(u && isValidConceptualUmbrellaCandidate(u));
}

export function mapInterpretedStageToBriefStage(
  stage: InterpretedStrategyStage,
): BrainstormerStrategyStage {
  switch (stage) {
    case "audience_needed":
      return "concept_confirmed";
    case "execution_needed":
      return "campaign_mechanism_needed";
    case "challenge_open":
      return "challenge_open";
    case "concept_needed":
      return "concept_needed";
    case "concept_proposed":
      return "concept_proposed";
    case "concept_confirmed":
      return "concept_confirmed";
    case "campaign_mechanism_needed":
      return "campaign_mechanism_needed";
    case "conversion_needed":
      return "conversion_needed";
    case "ready_for_project":
      return "ready_for_project";
    default:
      return "challenge_open";
  }
}

function mayDegradeStrategyStage(
  act: ConversationAct,
  memory: MemoryUpdate,
): boolean {
  return (
    act === "rejecting_concept" ||
    memory.reject_current_concept ||
    memory.clear_umbrella ||
    (act === "asking_alternatives" && memory.reject_current_concept)
  );
}

function finalizeStrategyStage(
  draft: InterpretedStrategyStage,
  brief: BrainstormerWorkingBrief,
  act: ConversationAct,
  memory: MemoryUpdate,
): InterpretedStrategyStage {
  let stage = draft;
  if (mayDegradeStrategyStage(act, memory)) {
    return maxStrategyStage(
      stage as BrainstormerStrategyStage,
      "concept_needed",
    ) as InterpretedStrategyStage;
  }
  if (priorHasConfirmedConcept(brief)) {
    const floor = maxStrategyStage(
      mapInterpretedStageToBriefStage(stage),
      "concept_confirmed",
    );
    if (floor === "concept_confirmed" || stage === "audience_needed") {
      stage = "concept_confirmed";
    }
  }
  return stage;
}

function buildInterpretation(
  partial: BrainstormerTurnInterpretation,
  brief: BrainstormerWorkingBrief,
): BrainstormerTurnInterpretation {
  const strategy_stage = finalizeStrategyStage(
    partial.strategy_stage,
    brief,
    partial.conversation_act,
    partial.memory_update,
  );
  return brainstormerTurnInterpretationSchema.parse({
    ...partial,
    strategy_stage,
  });
}

function isConceptProposal(msg: string): boolean {
  if (isConceptRejectionOrAlternativeRequest(msg)) return false;
  const candidate = extractQuotedConceptCandidate(msg);
  if (!candidate) return false;
  return (
    userReferencesParaguasConfirmation(msg) ||
    hasAny(msg, [/\bme\s+gusta\s+m[aá]s\b/, /\bir\s+directo\b/, /\bconfirmamos\b/, /\bquedamos\s+con\b/]) ||
    userSeeksFeedbackOnProposedConcept(msg)
  );
}

function rejectsConfirmedParaguas(msg: string): boolean {
  return hasAny(msg, [
    /\bno\s+me\s+gusta\s+el\s+paraguas\b/,
    /\bese\s+no\s+es\s+el\s+paraguas\b/,
    /\bcambiar\s+el\s+paraguas\b/,
    /\botro\s+paraguas\b/,
  ]);
}

/** Hint corto para DELIVER en prompt creativo. */
export function buildCompactDeliverHintForResponseMode(mode: ResponseMode): string {
  switch (mode) {
    case "guide_to_concept":
      return "Responder la pregunta; guiar al siguiente paso. No usar el mensaje del usuario como concepto.";
    case "answer_audience":
      return "Responder audiencia con criterio; no bloquear por paraguas.";
    case "validate_concept":
      return "Validar el concepto confirmado; no citar la pregunta del usuario como paraguas.";
    case "propose_alternatives":
      return "Reconocer rechazo; ofrecer alternativas sin citar el mensaje como concepto.";
    case "explain_simple":
      return "Explicar más simple; no proponer un eje creativo nuevo.";
    case "advance_next_step":
      return "Explicar el orden de pasos; responder cómo seguir.";
    case "answer_tactic_if_ready":
      return "Responder la táctica solo si el paraguas ya está cerrado.";
    case "answer_conversion":
      return "Explicar puente hacia compra en página.";
    case "conduct_external_research":
      return "Investigar referentes externos con fuentes; no usar memoria interna sola.";
    case "prepare_project_handoff":
      return "Evaluar madurez y preparar handoff a Proyecto; no repetir brainstorm anterior.";
    default:
      return "Responder en prosa directa; no usar el mensaje como concepto.";
  }
}

export type MapInterpretationContext = {
  userMessage?: string;
  conversationExcerpt?: string;
};

/** Mapeo legacy para current_request_type en brief/API. */
export function mapInterpretationToTurnIntent(
  interp: BrainstormerTurnInterpretation,
  ctx?: MapInterpretationContext,
): BrainstormerTurnIntent {
  const msg = ctx?.userMessage?.trim() ?? "";
  const t = msg ? normalize(msg) : "";

  if (msg && hasAny(t, CAMPAIGN_EXPECTATION_PATTERNS)) {
    return "campaign_expectation";
  }
  if (msg && hasAny(t, CAMPAIGN_STAGE_INQUIRY_PATTERNS)) {
    return "campaign_stage_inquiry";
  }
  if (msg && hasAny(t, [/\bdime\s+t[uú]\b/, /\bdecide\s+t[uú]\b/, /\belige\s+t[uú]\b/])) {
    return "delegate_to_limbi";
  }
  if (msg && isConceptualLevelCorrection(msg, ctx?.conversationExcerpt ?? "")) {
    return "conceptual_level_correction";
  }

  switch (interp.response_mode) {
    case "answer_conversion":
      return "conversion_bridge";
    case "answer_audience":
      return "audience_strategy_request";
    case "propose_alternatives":
      return "concept_rejection_or_alternative_request";
    case "explain_simple":
      return "user_confusion";
    case "answer_tactic_if_ready":
      return "tactical_grounding";
    default:
      break;
  }

  switch (interp.conversation_act) {
    case "external_research_request":
      return "external_research_request";
    case "project_handoff_request":
      return "project_handoff_request";
    case "asking_audience":
      return "audience_strategy_request";
    case "proposing_concept":
    case "confirming_concept":
    case "validating_concept":
      return "conceptual_strategy_request";
    case "rejecting_concept":
    case "asking_alternatives":
      return "concept_rejection_or_alternative_request";
    case "asking_next_step":
      return "next_step";
    case "asking_strategy":
      if (interp.response_mode === "advance_next_step") {
        return "next_step";
      }
      return "launch_strategy";
    case "asking_tactics":
      return "tactical_grounding";
    case "user_confusion":
      return "user_confusion";
    case "changing_focus":
      return "adjust_proposal";
    default:
      return "general";
  }
}

export function interpretBrainstormerTurnDeterministic(
  args: InterpretBrainstormerTurnArgs,
): BrainstormerTurnInterpretation {
  const msg = args.last_user_message.trim();
  const brief = args.working_brief;
  const t = normalize(msg);
  const hasConcept = priorHasConfirmedConcept(brief);

  if (isProjectHandoffRequest(msg)) {
    return buildInterpretation(
      {
        conversation_act: "project_handoff_request",
        response_mode: "prepare_project_handoff",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: hasConcept ? "ready_for_project" : "concept_needed",
      },
      brief,
    );
  }

  if (isExternalResearchRequest(msg)) {
    return buildInterpretation(
      {
        conversation_act: "external_research_request",
        response_mode: "conduct_external_research",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: hasConcept ? "concept_confirmed" : "concept_needed",
      },
      brief,
    );
  }

  if (isUserConfusionPhrase(msg)) {
    return buildInterpretation(
      {
        conversation_act: "user_confusion",
        response_mode: "explain_simple",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: Boolean(
            brief.confirmed_conceptual_umbrella.trim() &&
              (isUserConfusionPhrase(brief.confirmed_conceptual_umbrella) ||
                normalize(brief.confirmed_conceptual_umbrella) === t),
          ),
        },
        strategy_stage: hasConcept ? "concept_confirmed" : "concept_needed",
      },
      brief,
    );
  }

  if (isConceptRejectionOrAlternativeRequest(msg)) {
    const rejectParaguas = rejectsConfirmedParaguas(msg);
    return buildInterpretation(
      {
        conversation_act: hasAny(t, [
          /dame\s+otras?\s+opciones/,
          /\botras?\s+opciones\s+de\s+conceptos/,
          /\bpidiendo\s+otras?\s+opciones/,
          /\balternativas/,
          /\botros?\s+conceptos/,
        ])
          ? "asking_alternatives"
          : "rejecting_concept",
        response_mode: "propose_alternatives",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: true,
          clear_umbrella: rejectParaguas,
        },
        strategy_stage: "concept_needed",
      },
      brief,
    );
  }

  if (isConceptualLevelCorrection(msg, args.conversation_excerpt ?? "")) {
    return buildInterpretation(
      {
        conversation_act: "changing_focus",
        response_mode: "guide_to_concept",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: hasConcept ? "concept_confirmed" : "concept_needed",
      },
      brief,
    );
  }

  if (hasAny(t, TACTICAL_PATTERNS)) {
    return buildInterpretation(
      {
        conversation_act: "asking_tactics",
        response_mode: hasConcept ? "answer_tactic_if_ready" : "guide_to_concept",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: hasConcept ? "execution_needed" : "concept_needed",
      },
      brief,
    );
  }

  if (isAudienceStrategyRequest(msg)) {
    return buildInterpretation(
      {
        conversation_act: "asking_audience",
        response_mode: "answer_audience",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: hasConcept ? "audience_needed" : "concept_needed",
      },
      brief,
    );
  }

  if (isConversionBridgeRequest(msg)) {
    return buildInterpretation(
      {
        conversation_act: "asking_strategy",
        response_mode: hasConcept ? "answer_conversion" : "guide_to_concept",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: hasConcept ? "conversion_needed" : "concept_needed",
      },
      brief,
    );
  }

  if (hasAny(t, CAMPAIGN_STAGE_INQUIRY_PATTERNS)) {
    return buildInterpretation(
      {
        conversation_act: "asking_strategy",
        response_mode: hasConcept ? "advance_next_step" : "guide_to_concept",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: hasConcept ? "campaign_mechanism_needed" : "concept_needed",
      },
      brief,
    );
  }

  if (hasAny(t, HOW_TO_OR_EXPLAIN_PATTERNS)) {
    return buildInterpretation(
      {
        conversation_act: "asking_next_step",
        response_mode: "advance_next_step",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: hasConcept ? "concept_confirmed" : "concept_needed",
      },
      brief,
    );
  }

  if (hasAny(t, NEXT_STEP_PATTERNS)) {
    return buildInterpretation(
      {
        conversation_act: "asking_next_step",
        response_mode: hasConcept ? "advance_next_step" : "guide_to_concept",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: hasConcept ? "campaign_mechanism_needed" : "concept_needed",
      },
      brief,
    );
  }

  const suggestedUmbrella = extractConfirmedConceptualUmbrella({
    userMessage: msg,
    conversationExcerpt: args.conversation_excerpt ?? "",
    priorUmbrella: brief.confirmed_conceptual_umbrella,
  });
  if (suggestedUmbrella && !isProjectStatusOrLaunchBriefMessage(msg)) {
    const confirming =
      userReferencesParaguasConfirmation(msg) ||
      hasAny(msg, [/\bme\s+gusta\b/, /\bese\s+es\s+el\b/, /\bconfirmamos\b/, /\bquedamos\s+con\b/]) ||
      userSeeksFeedbackOnProposedConcept(msg);
    const bareProposal =
      isValidConceptualUmbrellaCandidate(suggestedUmbrella) &&
      normalize(msg) === normalize(suggestedUmbrella) &&
      hasAny(msg, [/\bme\s+gusta\b/, /\bme\s+gusta\s+m[aá]s\b/, /\bconfirmamos\b/]);
    if (confirming || bareProposal || (isConceptProposal(msg) && extractQuotedConceptCandidate(msg))) {
      return buildInterpretation(
        {
          conversation_act: confirming ? "confirming_concept" : "proposing_concept",
          response_mode: "validate_concept",
          memory_update: {
            update_umbrella: true,
            umbrella_candidate: suggestedUmbrella,
            reject_current_concept: false,
            clear_umbrella: false,
          },
          strategy_stage: "concept_confirmed",
        },
        brief,
      );
    }
  }

  const conceptCandidate = extractQuotedConceptCandidate(msg);
  if (conceptCandidate && isConceptProposal(msg)) {
    const confirming =
      userReferencesParaguasConfirmation(msg) ||
      hasAny(msg, [/\bme\s+gusta\b/, /\bir\s+directo\b/, /\bconfirmamos\b/]);
    return buildInterpretation(
      {
        conversation_act: confirming ? "confirming_concept" : "proposing_concept",
        response_mode: "validate_concept",
        memory_update: {
          update_umbrella: true,
          umbrella_candidate: conceptCandidate,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: "concept_confirmed",
      },
      brief,
    );
  }

  if (hasConcept && hasAny(t, VALIDATING_CONCEPT_PATTERNS)) {
    return buildInterpretation(
      {
        conversation_act: "validating_concept",
        response_mode: "validate_concept",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: "concept_confirmed",
      },
      brief,
    );
  }

  if (hasAny(t, CAMPAIGN_EXPECTATION_PATTERNS)) {
    return buildInterpretation(
      {
        conversation_act: "asking_strategy",
        response_mode: hasConcept ? "advance_next_step" : "guide_to_concept",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: hasConcept ? "campaign_mechanism_needed" : "concept_needed",
      },
      brief,
    );
  }

  if (isProjectStatusOrLaunchBriefMessage(msg) || hasAny(t, LAUNCH_BRIEF_PATTERNS)) {
    return buildInterpretation(
      {
        conversation_act: "asking_strategy",
        response_mode: "guide_to_concept",
        memory_update: {
          update_umbrella: false,
          umbrella_candidate: null,
          reject_current_concept: false,
          clear_umbrella: false,
        },
        strategy_stage: "concept_needed",
      },
      brief,
    );
  }

  return buildInterpretation(
    {
      conversation_act: /\?$/.test(msg) ? "asking_strategy" : "changing_focus",
      response_mode: hasConcept ? "advance_next_step" : "guide_to_concept",
      memory_update: {
        update_umbrella: false,
        umbrella_candidate: null,
        reject_current_concept: false,
        clear_umbrella: false,
      },
      strategy_stage: hasConcept ? "concept_confirmed" : "challenge_open",
    },
    brief,
  );
}

export async function interpretBrainstormerTurn(
  args: InterpretBrainstormerTurnArgs,
): Promise<InterpretBrainstormerTurnResult> {
  const deterministic = interpretBrainstormerTurnDeterministic(args);
  if (process.env.BRAINSTORMER_TURN_INTERPRET_OPENAI !== "1" || args.last_user_message.length < 12) {
    return { interpretation: deterministic, source: "deterministic" };
  }
  try {
    const { generateBrainstormerTurnInterpretationJson } = await import(
      "@/lib/openai/brainstormer-turn-interpret"
    );
    const { raw_json_text } = await generateBrainstormerTurnInterpretationJson({
      last_user_message: args.last_user_message,
      conversation_excerpt: args.conversation_excerpt ?? "",
      working_brief: args.working_brief,
      brand_name: args.brand_name ?? "",
    });
    const parsed = brainstormerTurnInterpretationSchema.safeParse(JSON.parse(raw_json_text));
    if (!parsed.success) {
      return { interpretation: deterministic, source: "deterministic" };
    }
    return {
      interpretation: buildInterpretation(parsed.data, args.working_brief),
      source: "openai",
    };
  } catch {
    return { interpretation: deterministic, source: "deterministic" };
  }
}
