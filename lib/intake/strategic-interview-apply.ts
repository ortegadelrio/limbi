import {
  AUDIENCE_TYPE_OPTIONS,
  EVIDENCE_TYPE_OPTIONS,
  NO_CLEAR_EVIDENCE,
  OFFERING_TYPE_OPTIONS,
  PROBLEM_CATEGORY_OPTIONS,
  TRANSFORMATION_TYPE_OPTIONS,
} from "@/lib/constants/wizard";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { sanitizeStrategicBasePatch } from "@/lib/intake/apply-extraction";
import { deepMergeResponses } from "@/lib/utils/deep-merge";

const OFFERING = new Set(
  OFFERING_TYPE_OPTIONS.map((o) => o.value) as readonly string[],
);
const PROBLEM = new Set(
  PROBLEM_CATEGORY_OPTIONS.map((o) => o.value) as readonly string[],
);
const TRANSFORM = new Set(
  TRANSFORMATION_TYPE_OPTIONS.map((o) => o.value) as readonly string[],
);
const AUDIENCE = new Set(
  AUDIENCE_TYPE_OPTIONS.map((o) => o.value) as readonly string[],
);
const EVIDENCE = new Set(
  EVIDENCE_TYPE_OPTIONS.map((o) => o.value) as readonly string[],
);

/** Trace/limitations: audience was explicitly skipped in guided pilot — never infer audience from defaults. */
export const GUIDED_INTAKE_AUDIENCE_PENDING_LIM =
  "guided_intake:audience_pending" as const;

function readStrategicBase(
  r: Record<string, unknown>,
): Record<string, unknown> {
  const sb = r.strategic_base;
  if (sb && typeof sb === "object" && !Array.isArray(sb)) {
    return { ...(sb as Record<string, unknown>) };
  }
  return {};
}

function readAudienceBase(
  r: Record<string, unknown>,
): Record<string, unknown> {
  const ab = r.audience_base;
  if (ab && typeof ab === "object" && !Array.isArray(ab)) {
    return { ...(ab as Record<string, unknown>) };
  }
  return {};
}

function readEvidenceBase(
  r: Record<string, unknown>,
): Record<string, unknown> {
  const eb = r.evidence_base;
  if (eb && typeof eb === "object" && !Array.isArray(eb)) {
    return { ...(eb as Record<string, unknown>) };
  }
  return {};
}

function sanitizeAudienceBasePatch(
  raw: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  const out: Record<string, unknown> = {};
  if (
    typeof raw.audience_type === "string" &&
    AUDIENCE.has(raw.audience_type)
  ) {
    out.audience_type = raw.audience_type;
  }
  if (raw.audience_description_optional !== undefined) {
    const t =
      typeof raw.audience_description_optional === "string"
        ? raw.audience_description_optional.trim().slice(0, 4000)
        : "";
    out.audience_description_optional = t ? t : null;
  }
  return out;
}

function sanitizeEvidenceBasePatch(
  raw: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  const out: Record<string, unknown> = {};
  if (Array.isArray(raw.evidence_types)) {
    const types = raw.evidence_types
      .filter((x): x is string => typeof x === "string" && EVIDENCE.has(x))
      .filter((t, i, a) => a.indexOf(t) === i);
    if (types.length > 0) {
      out.evidence_types = types;
    }
  }
  if (raw.evidence_details && typeof raw.evidence_details === "object") {
    const d = raw.evidence_details as Record<string, unknown>;
    const detailsOut: Record<string, string> = {};
    for (const [k, v] of Object.entries(d)) {
      if (typeof v === "string" && v.trim()) detailsOut[k] = v.trim();
    }
    if (Object.keys(detailsOut).length > 0) {
      out.evidence_details = detailsOut;
    }
  }
  return out;
}

const MIN_DESCRIPTION_LEN = 12;

export type StrategicInterviewApplyResult = {
  mergedResponses: Record<string, unknown>;
  /** Wizard step indices to merge into `completed_steps`. */
  completedStepIndicesToMerge: number[];
};

/**
 * Merges model extraction into responses for the strategic interview pilot.
 * Does not write `_limbic_interview_v1` (caller merges trace).
 */
export function applyStrategicInterviewExtraction(
  baseResponses: Record<string, unknown>,
  extraction: IntakeExtractionOutput,
): StrategicInterviewApplyResult {
  const rawSb = extraction.extracted_response_updates?.strategic_base;
  const sbPatch = sanitizeStrategicBasePatch(
    rawSb && typeof rawSb === "object" && !Array.isArray(rawSb)
      ? (rawSb as Record<string, unknown>)
      : undefined,
  );

  const rawAb = extraction.extracted_response_updates?.audience_base;
  const abPatch = sanitizeAudienceBasePatch(
    rawAb && typeof rawAb === "object" && !Array.isArray(rawAb)
      ? (rawAb as Record<string, unknown>)
      : undefined,
  );

  const rawEb = extraction.extracted_response_updates?.evidence_base;
  const ebPatch = sanitizeEvidenceBasePatch(
    rawEb && typeof rawEb === "object" && !Array.isArray(rawEb)
      ? (rawEb as Record<string, unknown>)
      : undefined,
  );

  let merged = deepMergeResponses(baseResponses, {
    strategic_base: { ...readStrategicBase(baseResponses), ...sbPatch },
  });
  if (Object.keys(abPatch).length > 0) {
    merged = deepMergeResponses(merged, {
      audience_base: { ...readAudienceBase(merged), ...abPatch },
    });
  }
  if (Object.keys(ebPatch).length > 0) {
    merged = deepMergeResponses(merged, {
      evidence_base: { ...readEvidenceBase(merged), ...ebPatch },
    });
  }

  const indices = collectSatisfiedWizardIndices(merged);
  return { mergedResponses: merged, completedStepIndicesToMerge: indices };
}

/** Which canonical wizard steps are satisfied by current merged responses. */
export function collectSatisfiedWizardIndices(
  mergedResponses: Record<string, unknown>,
): number[] {
  const sb = readStrategicBase(mergedResponses);
  const desc =
    typeof sb.simple_description === "string" ? sb.simple_description.trim() : "";
  const offering =
    typeof sb.offering_type === "string" ? sb.offering_type.trim() : "";
  const problem =
    typeof sb.problem_category === "string" ? sb.problem_category.trim() : "";
  const probDesc =
    typeof sb.problem_description_optional === "string"
      ? sb.problem_description_optional.trim()
      : "";
  const tt =
    typeof sb.transformation_type === "string" ? sb.transformation_type.trim() : "";
  const tto =
    typeof sb.transformation_to === "string" ? sb.transformation_to.trim() : "";
  const lim = Array.isArray(sb.guided_intake_limitations_optional)
    ? (sb.guided_intake_limitations_optional as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  const skippedTransform =
    lim.some((s) =>
      /transform|transformation|transformación/i.test(s),
    ) || false;

  const ab = readAudienceBase(mergedResponses);
  const aud =
    typeof ab.audience_type === "string" ? ab.audience_type.trim() : "";

  const eb = readEvidenceBase(mergedResponses);
  const evTypes = Array.isArray(eb.evidence_types)
    ? (eb.evidence_types as unknown[]).filter(
        (x): x is string => typeof x === "string" && EVIDENCE.has(x),
      )
    : [];

  const indices: number[] = [];

  if (desc.length >= MIN_DESCRIPTION_LEN && OFFERING.has(offering)) {
    indices.push(3);
  }
  if (
    indices.includes(3) &&
    (PROBLEM.has(problem) || probDesc.length >= 12)
  ) {
    indices.push(4);
  }
  if (
    indices.includes(4) &&
    (TRANSFORM.has(tt) || skippedTransform || tto.length >= 12)
  ) {
    indices.push(5);
  }
  const audienceExplicitlyPending = lim.some(
    (s) =>
      s.includes(GUIDED_INTAKE_AUDIENCE_PENDING_LIM) ||
      /guided_intake:audience_pending/i.test(s),
  );
  if (AUDIENCE.has(aud) && !audienceExplicitlyPending) {
    indices.push(6);
  }
  if (evTypes.length > 0) {
    indices.push(12);
  }

  return [...new Set(indices)].sort((a, b) => a - b);
}

/** Removes wizard audience slug/description so missing-audience turns cannot leave inferred defaults. */
export function responsesWithAudienceWizardFieldsCleared(
  merged: Record<string, unknown>,
): Record<string, unknown> {
  const ab = readAudienceBase(merged);
  const nextAb: Record<string, unknown> = { ...ab };
  delete nextAb.audience_type;
  delete nextAb.audience_description_optional;
  return deepMergeResponses(merged, { audience_base: nextAb });
}

/** When user has no evidence narrative, set `no_clear_evidence` so step 12 can complete. */
export function evidenceBaseNoClearPatch(): Record<string, unknown> {
  return {
    evidence_types: [NO_CLEAR_EVIDENCE],
    evidence_details: {},
  };
}

/** Evidence step: user lacks clarity on what to provide, without a meta-question about the prompt. */
export function buildEvidenceUncertaintyDeterministicExtraction(params: {
  strategicBase: Record<string, unknown>;
}): IntakeExtractionOutput {
  const sb = { ...params.strategicBase };
  const lim = Array.isArray(sb.guided_intake_limitations_optional)
    ? (sb.guided_intake_limitations_optional as unknown[]).filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      )
    : [];
  const nextLim = lim.includes("guided_intake:not_available_yet")
    ? lim
    : [...lim, "guided_intake:not_available_yet"];

  return {
    extracted_response_updates: {
      strategic_base: {
        ...sb,
        guided_intake_limitations_optional: nextLim,
      },
      evidence_base: evidenceBaseNoClearPatch(),
    },
    confidence_by_field: {},
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [],
    answer_status: "skipped",
    target_response_paths: [
      "strategic_base.guided_intake_limitations_optional",
      "evidence_base.evidence_types",
    ],
    internal_notes: "evidence_uncertainty_advance",
    interviewer_message:
      "Entendido. Dejé la evidencia marcada como pendiente por ahora: no repito qué cuenta como evidencia salvo que lo pidas con una pregunta concreta. Cuando tengas datos o referencias, podremos anclar claims más fuertes.",
    public_copy_allowed: false,
    user_intent: "answer",
  };
}
