import {
  OFFERING_TYPE_OPTIONS,
  PROBLEM_CATEGORY_OPTIONS,
  TRANSFORMATION_TYPE_OPTIONS,
} from "@/lib/constants/wizard";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
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

function readStrategicBase(
  r: Record<string, unknown>,
): Record<string, unknown> {
  const sb = r.strategic_base;
  if (sb && typeof sb === "object" && !Array.isArray(sb)) {
    return { ...(sb as Record<string, unknown>) };
  }
  return {};
}

/**
 * Sanitizes model-proposed `strategic_base` fields: only known keys, enums validated.
 */
export function sanitizeStrategicBasePatch(
  raw: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  const out: Record<string, unknown> = {};
  const p = raw;
  if (typeof p.simple_description === "string") {
    out.simple_description = p.simple_description.trim();
  }
  if (typeof p.offering_type === "string" && OFFERING.has(p.offering_type)) {
    out.offering_type = p.offering_type;
  }
  if (
    typeof p.problem_category === "string" &&
    PROBLEM.has(p.problem_category)
  ) {
    out.problem_category = p.problem_category;
  }
  if (p.problem_description_optional !== undefined) {
    const t =
      typeof p.problem_description_optional === "string"
        ? p.problem_description_optional.trim()
        : "";
    out.problem_description_optional = t ? t : null;
  }
  if (
    typeof p.transformation_type === "string" &&
    TRANSFORM.has(p.transformation_type)
  ) {
    out.transformation_type = p.transformation_type;
  }
  if (p.transformation_from !== undefined) {
    const t =
      typeof p.transformation_from === "string"
        ? p.transformation_from.trim()
        : "";
    out.transformation_from = t ? t : null;
  }
  if (p.transformation_to !== undefined) {
    const t =
      typeof p.transformation_to === "string" ? p.transformation_to.trim() : "";
    out.transformation_to = t ? t : null;
  }
  if (Array.isArray(p.guided_intake_limitations_optional)) {
    out.guided_intake_limitations_optional = p.guided_intake_limitations_optional
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim());
  }
  return out;
}

export type ApplyExtractionResult = {
  mergedResponses: Record<string, unknown>;
  /** Canonical wizard step indices to merge into `completed_steps` (3–5). */
  completedStepIndicesToMerge: number[];
};

const MIN_DESCRIPTION_LEN = 12;

/**
 * Merges extraction into `baseResponses`, returns which wizard steps (indices 3–5)
 * are satisfied so `completed_steps` can include `strategic_what` | `strategic_problem` | `strategic_transformation`.
 */
export function applyOfferingPilotExtraction(
  baseResponses: Record<string, unknown>,
  extraction: IntakeExtractionOutput,
): ApplyExtractionResult {
  const rawSb = extraction.extracted_response_updates?.strategic_base;
  const patch = sanitizeStrategicBasePatch(
    rawSb && typeof rawSb === "object" && !Array.isArray(rawSb)
      ? (rawSb as Record<string, unknown>)
      : undefined,
  );
  const prevSb = readStrategicBase(baseResponses);
  const nextSb = { ...prevSb, ...patch };
  const mergedResponses = deepMergeResponses(baseResponses, {
    strategic_base: nextSb,
  });

  const sb = readStrategicBase(mergedResponses);
  const desc =
    typeof sb.simple_description === "string" ? sb.simple_description.trim() : "";
  const offering =
    typeof sb.offering_type === "string" ? sb.offering_type.trim() : "";
  const problem =
    typeof sb.problem_category === "string" ? sb.problem_category.trim() : "";
  const tt =
    typeof sb.transformation_type === "string" ? sb.transformation_type.trim() : "";
  const lim = Array.isArray(sb.guided_intake_limitations_optional)
    ? (sb.guided_intake_limitations_optional as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  const skippedTransform =
    lim.some((s) =>
      /transform|transformation|transformación/i.test(s),
    ) || extraction.answer_status === "skipped";

  const indices: number[] = [];
  if (desc.length >= MIN_DESCRIPTION_LEN && OFFERING.has(offering)) {
    indices.push(3);
  }
  if (indices.includes(3) && PROBLEM.has(problem)) {
    indices.push(4);
  }
  if (indices.includes(4) && (TRANSFORM.has(tt) || skippedTransform)) {
    indices.push(5);
  }

  return { mergedResponses, completedStepIndicesToMerge: indices };
}
