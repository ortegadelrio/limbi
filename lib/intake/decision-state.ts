import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";

/**
 * Canonical lifecycle for a strategic field in guided intake (stored under
 * `_limbic_interview_v1.decision_states`, internal-only).
 *
 * - unstarted: no meaningful capture yet for this topic.
 * - in_progress: user is actively answering; not safe to treat as closed.
 * - provisional: Limbi or the user has a hypothesis but nothing is confirmed.
 * - confirmed: user explicitly accepted or gave a clear, committed answer.
 * - pending: user chose to skip / leave open / continue without deciding.
 * - reopened: user returned to this topic after the flow moved on; needs re-resolution.
 * - rejected: user declined a proposed framing (distinct from pending).
 * - low_confidence: something was saved but is vague, contradictory, or weak.
 */
export type DecisionStatus =
  | "unstarted"
  | "in_progress"
  | "provisional"
  | "confirmed"
  | "pending"
  | "reopened"
  | "rejected"
  | "low_confidence";

/** Phase 2 routing scope; designed so more keys (voice, limbic, etc.) can be added later. */
export type StrategicDecisionTopicKey =
  | "audience"
  | "evidence"
  | "problem"
  | "transformation";

export type StrategicDecisionStateEntry = {
  status: DecisionStatus;
  confidence?: number;
  reason?: string;
  last_updated_at?: string;
  /** e.g. guided_intake | user | engine */
  source?: string;
};

export type StrategicDecisionStatesV1 = Partial<
  Record<StrategicDecisionTopicKey, StrategicDecisionStateEntry>
>;

export type DecisionStatusPatch = {
  topic: StrategicDecisionTopicKey;
  status: DecisionStatus;
  confidence?: number;
  reason?: string;
  source?: string;
};

/** User-visible follow-up lines after provisional guidance (wording may vary in copy). */
export const STRATEGIC_DECISION_CONFIRMATION_OPTIONS_ES = [
  "Podemos hacer una de tres cosas:",
  "1. Confirmar esta opción.",
  "2. Cambiar la prioridad.",
  "3. Dejarlo pendiente para revisarlo al final.",
] as const;

export const STRATEGIC_DECISION_OPTION_BLOCK_ES =
  STRATEGIC_DECISION_CONFIRMATION_OPTIONS_ES.join("\n");

export function miniStepToStrategicTopicKey(
  miniStep: GuidedMiniStepId,
): StrategicDecisionTopicKey | null {
  if (
    miniStep === "audience" ||
    miniStep === "evidence" ||
    miniStep === "problem" ||
    miniStep === "transformation"
  ) {
    return miniStep;
  }
  return null;
}

export function strategicTopicKeyToMiniStep(
  topic: StrategicDecisionTopicKey,
): GuidedMiniStepId {
  return topic;
}

export function normalizeDecisionStates(
  raw: unknown,
): StrategicDecisionStatesV1 | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const topics: StrategicDecisionTopicKey[] = [
    "audience",
    "evidence",
    "problem",
    "transformation",
  ];
  const out: StrategicDecisionStatesV1 = {};
  for (const k of topics) {
    const v = o[k];
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const e = v as Record<string, unknown>;
    const st = e.status;
    if (typeof st !== "string") continue;
    const allowed: DecisionStatus[] = [
      "unstarted",
      "in_progress",
      "provisional",
      "confirmed",
      "pending",
      "reopened",
      "rejected",
      "low_confidence",
    ];
    if (!allowed.includes(st as DecisionStatus)) continue;
    const entry: StrategicDecisionStateEntry = { status: st as DecisionStatus };
    if (typeof e.confidence === "number") entry.confidence = e.confidence;
    if (typeof e.reason === "string" && e.reason.trim()) entry.reason = e.reason.trim();
    if (typeof e.last_updated_at === "string" && e.last_updated_at.trim()) {
      entry.last_updated_at = e.last_updated_at.trim();
    }
    if (typeof e.source === "string" && e.source.trim()) {
      entry.source = e.source.trim();
    }
    out[k] = entry;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function applyDecisionStatusPatches(
  existing: StrategicDecisionStatesV1 | undefined,
  patches: DecisionStatusPatch[],
  atIso: string,
): StrategicDecisionStatesV1 | undefined {
  if (patches.length === 0) return existing;
  const base: StrategicDecisionStatesV1 = { ...(existing ?? {}) };
  for (const p of patches) {
    const prev = base[p.topic];
    base[p.topic] = {
      status: p.status,
      ...(typeof p.confidence === "number" ? { confidence: p.confidence } : {}),
      ...(p.reason ? { reason: p.reason } : {}),
      last_updated_at: atIso,
      ...(p.source ? { source: p.source } : {}),
      ...(typeof prev?.confidence === "number" && p.confidence === undefined
        ? { confidence: prev.confidence }
        : {}),
    };
  }
  return base;
}

const SUMMARY_BLOCKING: ReadonlySet<DecisionStatus> = new Set([
  "provisional",
  "reopened",
  "low_confidence",
]);

/**
 * When true, the pilot closing summary should be suppressed until the user
 * confirms, marks pending, or explicitly proceeds despite open decisions.
 */
export function pilotSummaryBlockedByDecisionStates(
  states: StrategicDecisionStatesV1 | undefined,
  opts: { userExplicitProceed: boolean },
): boolean {
  if (opts.userExplicitProceed) return false;
  if (!states) return false;
  for (const e of Object.values(states)) {
    if (e && SUMMARY_BLOCKING.has(e.status)) return true;
  }
  return false;
}

/** User explicitly accepts a summary / closure despite pending strategic items. */
export function detectExplicitProceedWithPendingSummary(userText: string): boolean {
  const t = userText.trim().toLowerCase();
  if (t.length < 8) return false;
  return (
    /\b(sigamos con el resumen|muestra el resumen|quiero el resumen|cerramos as[ií]|cerrar as[ií]|adelante con el resumen|est[aá] bien as[ií]|listo,?\s+sigamos)\b/i.test(
      t,
    ) ||
    /\b(acepto cerrar|sigue con el cierre|contin[uú]a con el resumen)\b/i.test(t)
  );
}
