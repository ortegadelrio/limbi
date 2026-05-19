import type { ConversationDirectorAssistantMove } from "@/lib/brainstormer/conversation-director/types";
import { BRAINSTORMER_QUESTION_BANK } from "@/lib/brainstormer/question-engine/question-bank";
import { buildQuestionReason } from "@/lib/brainstormer/question-engine/build-question-reason";
import type {
  BrainstormerQuestionAsksFor,
  BrainstormerQuestionCandidate,
  ResolveNextQuestionInput,
  ResolveNextQuestionResult,
} from "@/lib/brainstormer/question-engine/types";

const STAGE_ORDER = [
  "opening",
  "exploration",
  "focusing",
  "structuring",
  "ready_for_project_seed",
] as const;

/** Solo elegibles cuando el director activa ese movimiento. */
const MOVE_ONLY_QUESTION_IDS = new Set([
  "cross-repair-prioritize",
  "cross-research-benchmark-criteria",
  "cross-research-event-references",
  "cross-project-seed-type",
  "cross-plan-horizon",
  "cross-compare-routes",
]);

/** Pregunta fija por movimiento del director. */
const ASSISTANT_MOVE_QUESTION_IDS: Partial<
  Record<ConversationDirectorAssistantMove, readonly string[]>
> = {
  repair_and_reframe: ["cross-repair-prioritize"],
  suggest_research: ["cross-research-event-references", "cross-research-benchmark-criteria"],
  suggest_project_seed: ["cross-project-seed-type"],
  propose_micro_plan: ["cross-plan-horizon"],
  compare_options: ["cross-compare-routes"],
};

/** Alineación entre texto de missing_information y asks_for. */
const MISSING_TO_ASKS_FOR: ReadonlyArray<{
  pattern: RegExp;
  asks_for: BrainstormerQuestionAsksFor;
  boost: number;
}> = [
  { pattern: /prioridad del posicionamiento|percepción/i, asks_for: "perception_priority", boost: 40 },
  { pattern: /horizonte temporal|plazo/i, asks_for: "deadline", boost: 35 },
  { pattern: /meta de ventas|boletas/i, asks_for: "sales_gap", boost: 45 },
  { pattern: /canal principal|canal prioritario/i, asks_for: "channels", boost: 40 },
  { pattern: /objetivo de campaña/i, asks_for: "objective", boost: 40 },
  { pattern: /audiencia prioritaria|audiencias/i, asks_for: "audience_priority", boost: 30 },
  { pattern: /objetivo del contenido/i, asks_for: "content_goal", boost: 35 },
  { pattern: /frecuencia|cadencia/i, asks_for: "channels", boost: 25 },
  { pattern: /tipo de experiencia|activación/i, asks_for: "activation_context", boost: 40 },
  { pattern: /formato y duración|formato/i, asks_for: "format", boost: 35 },
  { pattern: /benchmark|criterios/i, asks_for: "evidence", boost: 50 },
  { pattern: /definición concreta del reto/i, asks_for: "objective", boost: 30 },
  { pattern: /contexto operativo/i, asks_for: "objective", boost: 25 },
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function knownBlob(known: readonly string[]): string {
  return normalize(known.join(" "));
}

function shouldAvoidCandidate(
  candidate: BrainstormerQuestionCandidate,
  known: readonly string[],
): boolean {
  if (!candidate.avoid_if_known?.length) return false;
  const blob = knownBlob(known);
  return candidate.avoid_if_known.some((token) => blob.includes(normalize(token)));
}

function stageDistance(
  candidateStage: BrainstormerQuestionCandidate["stage"],
  targetStage: ResolveNextQuestionInput["conversation_stage"],
): number {
  const a = STAGE_ORDER.indexOf(candidateStage);
  const b = STAGE_ORDER.indexOf(targetStage);
  if (a < 0 || b < 0) return 99;
  return Math.abs(a - b);
}

function scoreCandidate(
  candidate: BrainstormerQuestionCandidate,
  input: ResolveNextQuestionInput,
): number {
  let score = candidate.priority;

  const stageDist = stageDistance(candidate.stage, input.conversation_stage);
  if (stageDist === 0) score += 30;
  else if (stageDist === 1) score += 12;
  else score -= stageDist * 8;

  if (candidate.challenge_type === input.challenge_type) {
    score += 50;
  } else if (candidate.challenge_type === "unknown") {
    score += 5;
  } else {
    score -= 80;
  }

  const missingJoined = normalize(input.missing_information.join(" "));
  for (const rule of MISSING_TO_ASKS_FOR) {
    if (rule.pattern.test(missingJoined) && candidate.asks_for === rule.asks_for) {
      score += rule.boost;
    }
  }

  if (input.user_intent === "unclear" && !input.user_selected_previous_option) {
    if (
      input.session_progress.current_challenge.trim().length > 0 &&
      candidate.id === "cross-unclear-continue-challenge"
    ) {
      score += 120;
    }
    if (candidate.id === "cross-fallback-two-week-outcome") {
      score -= 40;
    }
  }

  if (
    (input.user_intent === "selected_option" || input.user_selected_previous_option) &&
    candidate.id === "cross-unclear-continue-challenge"
  ) {
    score -= 500;
  }

  if (input.user_intent === "ask_how" && candidate.asks_for === "sales_gap") {
    score += 25;
  }

  if (
    input.assistant_move === "give_hypothesis_then_question" &&
    candidate.asks_for === "perception_priority"
  ) {
    score += 35;
  }

  if (shouldAvoidCandidate(candidate, input.known_from_brand_base)) {
    score -= 500;
  }

  return score;
}

function pickFromIds(
  ids: readonly string[],
  input: ResolveNextQuestionInput,
): BrainstormerQuestionCandidate | null {
  const byId = new Map(BRAINSTORMER_QUESTION_BANK.map((c) => [c.id, c]));
  let best: BrainstormerQuestionCandidate | null = null;
  let bestScore = -Infinity;

  for (const id of ids) {
    const candidate = byId.get(id);
    if (!candidate) continue;
    const score = scoreCandidate(candidate, input);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function resolveFromBank(input: ResolveNextQuestionInput): BrainstormerQuestionCandidate {
  const moveIds = ASSISTANT_MOVE_QUESTION_IDS[input.assistant_move];
  if (moveIds?.length) {
    const fromMove = pickFromIds(moveIds, input);
    if (fromMove && scoreCandidate(fromMove, input) > 0) {
      return fromMove;
    }
  }

  let best: BrainstormerQuestionCandidate | null = null;
  let bestScore = -Infinity;

  for (const candidate of BRAINSTORMER_QUESTION_BANK) {
    if (MOVE_ONLY_QUESTION_IDS.has(candidate.id)) continue;
    const score = scoreCandidate(candidate, input);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (best) return best;

  return BRAINSTORMER_QUESTION_BANK.find((c) => c.id === "cross-fallback-two-week-outcome")!;
}

/**
 * BRAIN-7: elige la pregunta estratégica que más avanza la conversación.
 */
export function resolveNextQuestion(input: ResolveNextQuestionInput): ResolveNextQuestionResult {
  const chosen = resolveFromBank(input);

  const reason = buildQuestionReason({
    asks_for: chosen.asks_for,
    challenge_type: input.challenge_type,
    assistant_move: input.assistant_move,
    missing_information: input.missing_information,
  });

  return {
    question: chosen.question,
    candidate_id: chosen.id,
    asks_for: chosen.asks_for,
    reason,
  };
}
