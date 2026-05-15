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

  return out;
}
