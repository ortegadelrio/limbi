import { z } from "zod";

/** Allowed partial updates under `responses.strategic_base` for the pilot. */
export const strategicBasePatchSchema = z
  .object({
    simple_description: z.string().optional(),
    offering_type: z.string().optional(),
    problem_category: z.string().optional(),
    problem_description_optional: z.string().nullable().optional(),
    transformation_type: z.string().optional(),
    transformation_from: z.string().nullable().optional(),
    transformation_to: z.string().nullable().optional(),
    guided_intake_limitations_optional: z.array(z.string()).optional(),
  })
  .strict();

export const extractedResponseUpdatesSchema = z
  .object({
    /** Model may suggest extra keys; `sanitizeStrategicBasePatch` drops unknowns. */
    strategic_base: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const ANSWER_STATUS_ENUM = [
  "clear",
  "weak",
  "missing_choice",
  "skipped",
  "fallback_saved",
] as const;

const USER_INTENT_ENUM = [
  "answer",
  "clarification_question",
  "strategic_validation_question",
  "skip",
] as const;

export type GuidedIntakeUserIntent = (typeof USER_INTENT_ENUM)[number];

function shouldLogExtractionZodDetail(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.GUIDED_INTAKE_EXTRACTION_DEBUG === "1"
  );
}

function coerceBoolish(v: unknown): unknown {
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no" || s === "") return false;
  }
  return v;
}

function normalizeAnswerStatus(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  const aliases: Record<string, (typeof ANSWER_STATUS_ENUM)[number]> = {
    ok: "clear",
    good: "clear",
    complete: "clear",
    unclear: "weak",
    vague: "weak",
    partial: "weak",
    uncertain: "weak",
    missing: "missing_choice",
    skip: "skipped",
    skipped: "skipped",
    user_skipped: "skipped",
  };
  if (aliases[s]) return aliases[s];
  if ((ANSWER_STATUS_ENUM as readonly string[]).includes(s)) return s;
  return v;
}

function normalizeConfidenceMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number" && !Number.isNaN(val)) {
      out[k] = val;
      continue;
    }
    if (typeof val === "string") {
      const n = Number(val.trim());
      if (!Number.isNaN(n)) out[k] = n;
    }
  }
  return out;
}

function normalizeStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string");
  }
  if (typeof v === "string" && v.trim()) {
    return [v.trim()];
  }
  return [];
}

/**
 * Best-effort coercion before Zod parse. Reduces false fallback triggers from
 * gpt-4o-mini quirks (string booleans, extra top-level keys, etc.).
 * Unknown top-level keys are stripped here so the model is not penalized.
 */
export function normalizeIntakeExtractionPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };

  const allowedTop = new Set([
    "extracted_response_updates",
    "confidence_by_field",
    "needs_follow_up",
    "follow_up_question",
    "suggested_answer_chips",
    "answer_status",
    "target_response_paths",
    "internal_notes",
    "interviewer_message",
    "public_copy_allowed",
    "user_intent",
  ]);
  for (const k of Object.keys(o)) {
    if (!allowedTop.has(k)) delete o[k];
  }

  o.needs_follow_up =
    o.needs_follow_up === null || o.needs_follow_up === undefined
      ? false
      : coerceBoolish(o.needs_follow_up);
  if (typeof o.needs_follow_up !== "boolean") o.needs_follow_up = false;

  o.public_copy_allowed =
    o.public_copy_allowed === null || o.public_copy_allowed === undefined
      ? false
      : coerceBoolish(o.public_copy_allowed);
  if (typeof o.public_copy_allowed !== "boolean") o.public_copy_allowed = false;

  if (typeof o.answer_status === "number") {
    o.answer_status = String(o.answer_status);
  }
  const normStatus = normalizeAnswerStatus(o.answer_status);
  if (
    typeof normStatus === "string" &&
    (ANSWER_STATUS_ENUM as readonly string[]).includes(normStatus)
  ) {
    o.answer_status = normStatus;
  } else {
    o.answer_status = "weak";
  }

  if (!("follow_up_question" in o) || o.follow_up_question === undefined) {
    o.follow_up_question = null;
  }
  if (o.follow_up_question !== null && typeof o.follow_up_question !== "string") {
    o.follow_up_question =
      o.follow_up_question === null ? null : String(o.follow_up_question);
  }

  if (o.interviewer_message === null || o.interviewer_message === undefined) {
    o.interviewer_message = "";
  } else if (typeof o.interviewer_message !== "string") {
    o.interviewer_message = String(o.interviewer_message);
  }

  if (o.internal_notes === null || o.internal_notes === undefined) {
    o.internal_notes = "";
  } else if (typeof o.internal_notes !== "string") {
    o.internal_notes = String(o.internal_notes);
  }

  o.confidence_by_field = normalizeConfidenceMap(o.confidence_by_field);
  o.suggested_answer_chips = normalizeStringArray(o.suggested_answer_chips);
  o.target_response_paths = normalizeStringArray(o.target_response_paths);

  if (!o.extracted_response_updates || typeof o.extracted_response_updates !== "object") {
    o.extracted_response_updates = {};
  }

  const intentRaw = o.user_intent;
  if (typeof intentRaw === "string") {
    const s = intentRaw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
    if ((USER_INTENT_ENUM as readonly string[]).includes(s)) {
      o.user_intent = s;
    } else {
      o.user_intent = "answer";
    }
  } else {
    o.user_intent = "answer";
  }

  return o;
}

function logZodExtractionIssues(
  error: z.ZodError,
  normalizedPreview: unknown,
): void {
  if (!shouldLogExtractionZodDetail()) return;
  const issues = error.issues.map((i) => ({
    path: i.path.map(String).join(".") || "(root)",
    code: i.code,
    message: i.message,
    ...(i.code === "invalid_type" && "received" in i
      ? { received: (i as { received?: unknown }).received }
      : {}),
    ...(i.code === "invalid_enum_value" && "received" in i
      ? { received: (i as { received?: unknown }).received }
      : {}),
  }));
  console.error(
    "[guided-intake:zod_detail]",
    JSON.stringify({
      issue_count: issues.length,
      issues,
      normalized_preview:
        typeof normalizedPreview === "object" && normalizedPreview !== null
          ? JSON.stringify(normalizedPreview).slice(0, 4000)
          : String(normalizedPreview).slice(0, 500),
    }),
  );
}

export const intakeExtractionOutputSchema = z
  .object({
    extracted_response_updates: extractedResponseUpdatesSchema.default({}),
    confidence_by_field: z.record(z.string(), z.number()).default({}),
    needs_follow_up: z.boolean().default(false),
    follow_up_question: z.union([z.string(), z.null()]).default(null),
    suggested_answer_chips: z.array(z.string()).default([]),
    answer_status: z.enum(ANSWER_STATUS_ENUM),
    target_response_paths: z.array(z.string()).default([]),
    internal_notes: z.string().default(""),
    interviewer_message: z.string().default(""),
    public_copy_allowed: z.boolean().default(false),
    user_intent: z.enum(USER_INTENT_ENUM).default("answer"),
  });
/** Not `.strict()`: models often add benign extra keys; Zod strips them. */

export type IntakeExtractionOutput = z.infer<typeof intakeExtractionOutputSchema>;

export function parseIntakeExtractionOutput(
  raw: unknown,
): { ok: true; data: IntakeExtractionOutput } | { ok: false; error: string } {
  const normalized = normalizeIntakeExtractionPayload(raw);
  const parsed = intakeExtractionOutputSchema.safeParse(normalized);
  if (!parsed.success) {
    logZodExtractionIssues(parsed.error, normalized);
    return {
      ok: false,
      error: parsed.error.flatten().toString(),
    };
  }
  return { ok: true, data: parsed.data };
}
