import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import { GUIDED_MINI_STEPS, nextMiniStep } from "@/lib/intake/guided-interview-flow";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import type { PilotEscapeChipId } from "@/lib/intake/question-bank";
import {
  normalizeDecisionStates,
  type StrategicDecisionStatesV1,
} from "@/lib/intake/decision-state";

export const LIMBIC_INTERVIEW_TRACE_KEY = "_limbic_interview_v1" as const;

export type LimbicInterviewPilotId =
  | "offering_module_v1"
  | "strategic_interview_v1";

/** Internal: provisional audience priority Limbi proposed; cleared on confirm/reject. */
export type AudienceRecommendationPendingV1 = {
  version: 1;
  primary_label: string;
  secondary_label: string;
  /** Optional third actor surfaced in copy only. */
  tertiary_label?: string;
  /** Draft for audience_description_optional on confirm (still inside project_responses JSON). */
  audience_description_draft?: string;
  /** Heuristic for mapping to wizard audience_type slug on confirm. */
  audience_type_hint?: "b2b" | "b2c" | "mixed";
  /** User named the secondary actor; next turn may confirm inverting primary/secondary. */
  invert_question_active?: boolean;
};

export type LimbicInterviewTraceV1 = {
  version: 1;
  pilot_id: LimbicInterviewPilotId;
  phase:
    | "main"
    | "follow_up"
    | "clarifying_question"
    | "strategy_validation"
    | "done";
  follow_up_used: boolean;
  /** Strategic pilot journey position (ignored for legacy offering_module_v1). */
  mini_step?: GuidedMiniStepId;
  /** User chose “Otro” at challenge type — tailored question uses freeform path. */
  other_challenge?: boolean;
  /** After a provisional audience recommendation; next turn may confirm in plain language. */
  audience_recommendation_pending?: AudienceRecommendationPendingV1;
  /** Short audit trail (not full raw chat for master). */
  turns: { at: string; role: "user" | "assistant"; summary: string }[];
  /** Internal-only strategic decision lifecycle (Phase 2 conversational engine). */
  decision_states?: StrategicDecisionStatesV1;
};

export function readInterviewTrace(
  responses: Record<string, unknown>,
): LimbicInterviewTraceV1 | null {
  const raw = responses[LIMBIC_INTERVIEW_TRACE_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  const pilotId = o.pilot_id;
  if (pilotId !== "offering_module_v1" && pilotId !== "strategic_interview_v1") {
    return null;
  }
  const phase = o.phase;
  if (
    phase !== "main" &&
    phase !== "follow_up" &&
    phase !== "clarifying_question" &&
    phase !== "strategy_validation" &&
    phase !== "done"
  ) {
    return null;
  }
  const miniRaw = o.mini_step;
  const miniStep =
    typeof miniRaw === "string" && GUIDED_MINI_STEPS.includes(miniRaw as GuidedMiniStepId)
      ? (miniRaw as GuidedMiniStepId)
      : undefined;
  const arpRaw = o.audience_recommendation_pending;
  let audience_recommendation_pending: AudienceRecommendationPendingV1 | undefined;
  if (arpRaw && typeof arpRaw === "object" && !Array.isArray(arpRaw)) {
    const ar = arpRaw as Record<string, unknown>;
    if (
      ar.version === 1 &&
      typeof ar.primary_label === "string" &&
      ar.primary_label.trim().length > 0 &&
      typeof ar.secondary_label === "string" &&
      ar.secondary_label.trim().length > 0
    ) {
      const tertiary =
        typeof ar.tertiary_label === "string" && ar.tertiary_label.trim().length > 0
          ? ar.tertiary_label.trim()
          : undefined;
      const draft =
        typeof ar.audience_description_draft === "string" &&
        ar.audience_description_draft.trim().length > 0
          ? ar.audience_description_draft.trim()
          : undefined;
      const hintRaw = ar.audience_type_hint;
      const audience_type_hint =
        hintRaw === "b2b" || hintRaw === "b2c" || hintRaw === "mixed" ? hintRaw : undefined;
      audience_recommendation_pending = {
        version: 1,
        primary_label: ar.primary_label.trim(),
        secondary_label: ar.secondary_label.trim(),
        ...(tertiary ? { tertiary_label: tertiary } : {}),
        ...(draft ? { audience_description_draft: draft } : {}),
        ...(audience_type_hint ? { audience_type_hint } : {}),
        ...(ar.invert_question_active === true
          ? { invert_question_active: true }
          : {}),
      };
    }
  }

  const dsRaw = o.decision_states;
  const decision_states = normalizeDecisionStates(dsRaw);

  return {
    version: 1,
    pilot_id: pilotId as LimbicInterviewPilotId,
    phase,
    follow_up_used: Boolean(o.follow_up_used),
    ...(miniStep ? { mini_step: miniStep } : {}),
    other_challenge: Boolean(o.other_challenge),
    ...(audience_recommendation_pending
      ? { audience_recommendation_pending }
      : {}),
    ...(decision_states ? { decision_states } : {}),
    turns: Array.isArray(o.turns)
      ? (o.turns as unknown[])
          .filter(
            (t): t is LimbicInterviewTraceV1["turns"][number] =>
              t !== null &&
              typeof t === "object" &&
              !Array.isArray(t) &&
              typeof (t as Record<string, unknown>).at === "string" &&
              ((t as Record<string, unknown>).role === "user" ||
                (t as Record<string, unknown>).role === "assistant") &&
              typeof (t as Record<string, unknown>).summary === "string",
          )
          .map((t) => {
            const x = t as Record<string, unknown>;
            return {
              at: x.at as string,
              role: x.role as "user" | "assistant",
              summary: x.summary as string,
            };
          })
      : [],
  };
}

export function initialTrace(): LimbicInterviewTraceV1 {
  return {
    version: 1,
    pilot_id: "strategic_interview_v1",
    phase: "main",
    follow_up_used: false,
    mini_step: "challenge_type",
    turns: [],
  };
}

/** Legacy in-flight trace → restart strategic journey at challenge type. */
export function coerceLegacyTraceForStrategicInterview(
  trace: LimbicInterviewTraceV1 | null,
): LimbicInterviewTraceV1 {
  if (!trace) return initialTrace();
  if (
    trace.pilot_id === "offering_module_v1" &&
    trace.phase !== "done"
  ) {
    return initialTrace();
  }
  if (trace.pilot_id === "strategic_interview_v1" && !trace.mini_step) {
    return { ...trace, mini_step: "challenge_type" };
  }
  return trace;
}

export function appendTurn(
  trace: LimbicInterviewTraceV1,
  role: "user" | "assistant",
  summary: string,
): LimbicInterviewTraceV1 {
  const next = [...trace.turns, { at: new Date().toISOString(), role, summary }];
  return { ...trace, turns: next.slice(-20) };
}

/** Advance journey one mini-step; resets follow-up flags when entering a new step. */
export function advanceMiniStepFrom(
  trace: LimbicInterviewTraceV1,
): LimbicInterviewTraceV1 {
  const ms = trace.mini_step ?? "challenge_type";
  const n = nextMiniStep(ms);
  if (!n || n === "complete") {
    return {
      ...trace,
      mini_step: "complete",
      phase: "done",
      follow_up_used: false,
    };
  }
  return { ...trace, mini_step: n, phase: "main", follow_up_used: false };
}

/**
 * After an LLM extraction, decide whether we stay on the same mini-step for a follow-up
 * or advance. Mutually exclusive with showing the next bank question (caller sets
 * `next_question` null when `wantsFollowUp`).
 */
export function computeTraceAfterStrategicLlmExtraction(params: {
  trace: LimbicInterviewTraceV1;
  extraction: Pick<IntakeExtractionOutput, "needs_follow_up" | "follow_up_question">;
}): { nextTrace: LimbicInterviewTraceV1; wantsFollowUp: boolean } {
  const { trace, extraction } = params;
  const prePhase = trace.phase;
  let wantsFollowUp = false;
  let nextTrace: LimbicInterviewTraceV1;

  if (prePhase === "main") {
    wantsFollowUp =
      Boolean(extraction.needs_follow_up) && !trace.follow_up_used;
    if (wantsFollowUp) {
      nextTrace = {
        ...trace,
        phase: "follow_up",
        follow_up_used: true,
      };
    } else {
      nextTrace = advanceMiniStepFrom({ ...trace, phase: "main" });
    }
  } else {
    nextTrace = advanceMiniStepFrom({ ...trace, phase: "main" });
  }

  return { nextTrace, wantsFollowUp };
}

export function buildStrategicInterviewSystemPrompt(params: {
  challengeType: string | null;
  offeringTypeHint: string | null;
  miniStep: GuidedMiniStepId;
  otherChallenge: boolean;
}): string {
  const stepRules: Record<GuidedMiniStepId, string> = {
    challenge_type: "Not used for model calls.",
    tailored_what: `Current mini-step: WHAT / OFFER (tailored).
- Fill strategic_base.simple_description (clear prose, Spanish) and offering_type (slug: product|service|experience|knowledge|community|solution) when inferable.
- interviewer_message: 2–4 sentences in Spanish — reflect what you understood in strategic terms; if vague, set needs_follow_up (only if allowed). Never mention JSON, fields, slugs, or databases.`,
    problem: `Current mini-step: PROBLEM / SITUATION.
- Fill strategic_base.problem_category (wizard slug) and problem_description_optional when helpful.
- interviewer_message in Spanish as above.`,
    transformation: `Current mini-step: TRANSFORMATION / BENEFIT.
- Fill strategic_base.transformation_type (slug), transformation_from, transformation_to when helpful.
- interviewer_message in Spanish as above.`,
    audience: `Current mini-step: PRIMARY AUDIENCE / DECISOR.
- Fill audience_base.audience_type with one wizard slug ONLY when the user clearly commits to one primary audience (end_consumers|b2b|entrepreneurs|community_citizens|internal_teams|event_attendees|professional_audience).
- If the situation implies multiple stakeholders (e.g. adolescent travelers vs parents who authorize vs schools/agencies), do NOT guess a single slug. Prefer needs_follow_up with ONE sharp question such as who must be convinced first and why.
- Never invent "consumidores finales" or any audience the user did not state or confirm.
- interviewer_message in Spanish as above.`,
    evidence: `Current mini-step: EVIDENCE / LIMITS.
- Fill evidence_base.evidence_types (subset of wizard evidence slugs) and evidence_details for any type with user text; if user lacks evidence, use evidence_types ["no_clear_evidence"].
- You may append short strings to strategic_base.guided_intake_limitations_optional when they declined detail.
- interviewer_message in Spanish as above.`,
    complete: "Not used.",
  };

  const block = stepRules[params.miniStep] ?? stepRules.tailored_what;

  return `You are Limbi, a senior strategist conducting a live strategic interview in Spanish (not a form, not a generic chatbot).
Rules:
- Strategy first. Do NOT write ads, headlines, or final campaign copy.
- Output MUST be one JSON object matching the schema in the user message.
- Voice: strategic, clear, direct, human, helpful — not effusive. Avoid generic praise and permission-seeking filler.
- BANNED (do not use verbatim or close paraphrase): "Suena muy útil", "Es genial", "Qué interesante", "Me encanta", "¿Te gustaría profundizar?", "¿Hay algún aspecto específico?", vague "¿Hay algo más que quieras agregar?", "Cuéntame más" unless the same turn adds ONE precise concrete direction.
- PREFERRED patterns (mix naturally): "Entiendo esto: …", "Aquí aparece una tensión: …", "Me falta precisar: …", "Para construir bien el Sistema Límbico, necesito distinguir entre …", "Podemos dejarlo pendiente, pero entonces Limbi no debe asumirlo como evidencia."
- interviewer_message: concise Spanish — synthesize or name the trade-off, then EITHER (a) if needs_follow_up: set follow_up_question to that ONE concrete question (do not also pose the next journey-step question in prose), OR (b) if advancing: close the turn without a second unrelated question.
- extracted_response_updates may include strategic_base (partial), and when the step requires it audience_base or evidence_base (partial). Only populate keys relevant to this mini-step plus limitations when needed.
- needs_follow_up: true only if the user's last answer is vague AND one targeted follow_up_question would materially sharpen strategy AND follow-up is allowed (see user message).
- If needs_follow_up is true: follow_up_question MUST be non-null, specific to the user's words (who to convince first, which risk, which trade-off), NOT generic scaffolding.
- If follow-up is not allowed, needs_follow_up MUST be false and follow_up_question MUST be null.
- If information is missing, add short reasons to guided_intake_limitations_optional and lower confidence for affected fields. Do not fill gaps with generic defaults.
- public_copy_allowed: false unless everything you extracted is explicit and safe.
- user_intent (required): "answer" | "clarification_question" | "strategic_validation_question" | "skip".
  - "clarification_question": the user only asks what a term means, asks for examples, says they do not understand the question, or asks how to answer — without giving substantive content for this mini-step. Then extracted_response_updates MUST be {} (empty), needs_follow_up false, follow_up_question null. interviewer_message may be a brief Spanish gloss (the product may replace it with a standard explanation).
  - "strategic_validation_question": the user seeks your agreement or a quick strategic judgment on their hypothesis (e.g. "¿crees que los padres deberían ser el objetivo?", "¿tiene sentido este enfoque?") rather than answering the step. Same empty extracted_response_updates rule as clarification. Use strategic, non-generic language in interviewer_message; state the assessment is provisional until the full Sistema Límbico is built; do not write final campaign copy.
  - "skip": the user explicitly refuses to provide this item in free text (rare; the UI chip handles most skips). Same empty extracted_response_updates rule as clarification unless you are sure they gave a partial answer.
  - "answer": default — the user is attempting to answer the strategic question.

${block}

Project challenge_type (may be null): ${JSON.stringify(params.challengeType)}
Other_challenge flag (Otro): ${params.otherChallenge ? "yes" : "no"}
Offering_type already in responses (may be null): ${JSON.stringify(params.offeringTypeHint)}
`.trim();
}

export function buildStrategicInterviewUserPrompt(params: {
  trace: LimbicInterviewTraceV1;
  userText: string;
  strategicBaseSnapshot: Record<string, unknown>;
  audienceBaseSnapshot: Record<string, unknown>;
  evidenceBaseSnapshot: Record<string, unknown>;
  /** True when the previous assistant turn was non-advancing (clarification or strategic validation). */
  resumeAfterClarification?: boolean;
}): string {
  const followUpRound =
    params.trace.phase === "follow_up"
      ? "This is the follow-up answer. needs_follow_up MUST be false and follow_up_question MUST be null. Extract, then the system advances mini_step."
      : params.trace.follow_up_used
        ? "A follow-up was already used for this topic; needs_follow_up MUST be false."
        : "At most one follow-up for this topic if the answer is vague. If you set needs_follow_up true, the user will ONLY see interviewer_message + follow_up_question next — not the next journey question — until they answer.";

  return `strategic_base snapshot:
${JSON.stringify(params.strategicBaseSnapshot, null, 2)}

audience_base snapshot:
${JSON.stringify(params.audienceBaseSnapshot, null, 2)}

evidence_base snapshot:
${JSON.stringify(params.evidenceBaseSnapshot, null, 2)}

Interview phase: ${params.trace.phase}
Mini-step: ${params.trace.mini_step ?? "unknown"}
${followUpRound}
${params.resumeAfterClarification ? "\nThe user just read a non-advancing reply (clarification or provisional validation) about the current question; treat their message below as a new attempt to answer the step unless it is again meta-only (user_intent=clarification_question or strategic_validation_question).\n" : ""}

User message:
${params.userText}

Return the extraction JSON as specified.
`.trim();
}

const SKIP_CHIP_LIMBIC_MESSAGE =
  "Esta información ayudaría a construir mejor el Sistema Límbico, pero puedes completarla más adelante. Por ahora la marcaré como pendiente para no inventar datos ni hacer promesas débiles.";

export function buildSyntheticExtractionForChip(
  _action: PilotEscapeChipId,
  existingLimitations: string[] = [],
): IntakeExtractionOutput {
  const lim = [
    ...existingLimitations,
    "guided_intake:not_available_yet",
  ];
  return {
    extracted_response_updates: {
      strategic_base: {
        guided_intake_limitations_optional: lim,
      },
    },
    confidence_by_field: {},
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [],
    answer_status: "skipped",
    target_response_paths: ["strategic_base.guided_intake_limitations_optional"],
    internal_notes: "User selected: no_information (skip)",
    interviewer_message: SKIP_CHIP_LIMBIC_MESSAGE,
    public_copy_allowed: false,
    user_intent: "skip",
  };
}
