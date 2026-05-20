import {
  BRAINSTORMER_CONVERSATION_CONTRACT_VERSION,
  coerceBrainstormerWorkingBrief,
  type BrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import type { BrainstormerCampaignStage } from "@/lib/brainstormer/working-brief-memory";
import type {
  BrainstormerProjectReadiness,
  BrainstormerSessionProgressPayload,
  BrainstormerSuggestedProjectType,
} from "@/lib/schemas/brainstormer-session";

const READINESS_RANK: Record<BrainstormerProjectReadiness, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

type StringProgressField = {
  [K in keyof BrainstormerSessionProgressPayload]-?: BrainstormerSessionProgressPayload[K] extends string
    ? K
    : never;
}[keyof BrainstormerSessionProgressPayload];

const STRING_FIELDS = [
  "session_summary",
  "current_challenge",
  "preliminary_objective",
  "audience_notes",
  "tension_or_pain",
  "opportunities",
  "ideas_explored",
  "recommended_routes",
  "open_questions",
  "next_step",
  "project_seed_summary",
] as const satisfies readonly StringProgressField[];

/** Fusiona dos briefs; campos vacíos en `next` no borran valores confirmados en `prev`. */
export function mergeWorkingBrief(prev: BrainstormerWorkingBrief, next: BrainstormerWorkingBrief): BrainstormerWorkingBrief {
  const mergeLists = (a: string[], b: string[], max: number) => {
    const out = [...a];
    for (const item of b) {
      const norm = item.trim().toLowerCase();
      if (!norm) continue;
      if (!out.some((x) => x.toLowerCase() === norm || x.toLowerCase().includes(norm))) {
        out.push(item.trim());
      }
    }
    return out.slice(-max);
  };

  const pickStage = (a: BrainstormerCampaignStage, b: BrainstormerCampaignStage): BrainstormerCampaignStage => {
    if (b !== "unknown") return b;
    return a;
  };

  return {
    contract_version: BRAINSTORMER_CONVERSATION_CONTRACT_VERSION,
    strategic_moment: next.strategic_moment !== "unknown" ? next.strategic_moment : prev.strategic_moment,
    current_request_type: next.current_request_type,
    active_constraints: mergeLists(prev.active_constraints, next.active_constraints, 32),
    user_corrections: mergeLists(prev.user_corrections, next.user_corrections, 24),
    rejected_paths: mergeLists(prev.rejected_paths, next.rejected_paths, 20),
    approved_signals: mergeLists(prev.approved_signals, next.approved_signals, 20),
    open_decisions: mergeLists(prev.open_decisions, next.open_decisions, 16),
    next_best_step: next.next_best_step.trim() || prev.next_best_step,
    confirmed_decisions: mergeLists(prev.confirmed_decisions, next.confirmed_decisions, 16),
    confirmed_conceptual_umbrella:
      next.confirmed_conceptual_umbrella.trim() || prev.confirmed_conceptual_umbrella,
    campaign_stage: pickStage(prev.campaign_stage, next.campaign_stage),
    conversion_bridge: next.conversion_bridge.trim() || prev.conversion_bridge,
  };
}

function mergeSuggestedType(
  prev: BrainstormerSuggestedProjectType,
  next: BrainstormerSuggestedProjectType,
): BrainstormerSuggestedProjectType {
  if (next !== "other") return next;
  if (prev !== "other") return prev;
  return "other";
}

/** Fusiona el resumen operativo previo con el turno actual (solo sobrescribe campos no vacíos en `next`, salvo señales de proyecto). */
export function mergeBrainstormerSessionProgress(
  prev: BrainstormerSessionProgressPayload,
  next: BrainstormerSessionProgressPayload,
): BrainstormerSessionProgressPayload {
  const out: BrainstormerSessionProgressPayload = { ...prev };

  for (const k of STRING_FIELDS) {
    const value = next[k];
    const n = typeof value === "string" ? value.trim() : "";
    if (n) out[k] = n;
  }

  out.project_readiness =
    READINESS_RANK[next.project_readiness] >= READINESS_RANK[prev.project_readiness]
      ? next.project_readiness
      : prev.project_readiness;

  out.should_suggest_project_conversion =
    prev.should_suggest_project_conversion || next.should_suggest_project_conversion;

  out.suggested_project_type = mergeSuggestedType(prev.suggested_project_type, next.suggested_project_type);

  out.missing_project_inputs =
    next.missing_project_inputs.length > 0 ? next.missing_project_inputs : prev.missing_project_inputs;

  const prevBrief = coerceBrainstormerWorkingBrief(prev.working_brief);
  const nextBrief = coerceBrainstormerWorkingBrief(next.working_brief);
  out.working_brief = mergeWorkingBrief(prevBrief, nextBrief);

  return out;
}

/**
 * Brief persistido tras un turno: servidor (updateBrainstormerWorkingBrief) es fuente de verdad;
 * si el modelo envía working_brief, se fusiona antes sin poder borrar confirmaciones con strings vacíos.
 */
export function resolveWorkingBriefForSessionMerge(args: {
  priorProgress: BrainstormerSessionProgressPayload;
  serverBrief: BrainstormerWorkingBrief;
  modelWorkingBrief?: unknown;
}): BrainstormerWorkingBrief {
  const prevBrief = coerceBrainstormerWorkingBrief(args.priorProgress.working_brief);
  const serverBrief = args.serverBrief;

  if (args.modelWorkingBrief === undefined) {
    return mergeWorkingBrief(prevBrief, serverBrief);
  }

  const modelBrief = coerceBrainstormerWorkingBrief(args.modelWorkingBrief);
  return mergeWorkingBrief(mergeWorkingBrief(prevBrief, modelBrief), serverBrief);
}
