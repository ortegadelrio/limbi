import { WIZARD_STEP_ORDER } from "@/lib/constants/wizard";
import { normalizeMasterDocumentBeforeValidation } from "@/lib/master-document/normalize-master-document";
import { MASTER_DOCUMENT_QUALITY_NOTE } from "@/lib/master-document/quality-note";

const WIZARD_STEP_ID_SET = new Set<string>(WIZARD_STEP_ORDER);

function isWizardStepIdString(s: string): boolean {
  return WIZARD_STEP_ID_SET.has(s);
}

function isQualityScore0to100(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isFinite(v) &&
    Number.isInteger(v) &&
    v >= 0 &&
    v <= 100
  );
}

/** Top-level keys required by `buildMasterDocumentPrompt` schema outline. */
export const MASTER_DOCUMENT_REQUIRED_TOP_LEVEL_KEYS = [
  "project_identity",
  "raw_inputs",
  "strategic_base",
  "audience_base",
  "evidence_base",
  "limbic_base",
  "voice_base",
  "semantic_base",
  "production_rules",
  "input_quality_assessment",
  "memory",
] as const;

const MEMORY_ARRAY_KEYS = [
  "approved_outputs",
  "rejected_outputs",
  "favorite_outputs",
  "user_edits",
  "tone_adjustments",
  "version_history",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Strips optional ```json fences from model output. */
export function stripJsonFence(raw: string): string {
  const t = raw.trim();
  const m = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(t);
  return m ? m[1].trim() : t;
}

function validateLimbicBase(value: unknown): string | null {
  if (!isPlainObject(value)) {
    return 'La clave "limbic_base" debe ser un objeto.';
  }
  for (const key of ["raw_inputs", "symbolic_interpretation", "literal_usage_limits"] as const) {
    if (!(key in value)) {
      return `Falta "limbic_base.${key}".`;
    }
  }
  if (!isPlainObject(value.raw_inputs)) {
    return '"limbic_base.raw_inputs" debe ser un objeto.';
  }
  if (!isPlainObject(value.symbolic_interpretation)) {
    return '"limbic_base.symbolic_interpretation" debe ser un objeto.';
  }
  if (!Array.isArray(value.literal_usage_limits)) {
    return '"limbic_base.literal_usage_limits" debe ser un array.';
  }
  if (value.literal_usage_limits.length === 0) {
    return '"limbic_base.literal_usage_limits" no puede ser un array vacío; debe incluir al menos una cadena no vacía en español.';
  }
  const limitsErr = validateStringArrayField(
    value.literal_usage_limits,
    "limbic_base.literal_usage_limits",
  );
  if (limitsErr) {
    return limitsErr;
  }
  return null;
}

/** Mensaje fijo para 422 de validación del maestro (no exponer detalle técnico al usuario). */
export const MASTER_DOCUMENT_VALIDATION_USER_ERROR_ES =
  "No pudimos actualizar la Lectura Límbica porque la respuesta de IA llegó incompleta. Intenta actualizar nuevamente.";

/** Clasificación del mensaje técnico de validación (solo para logs / debug). */
export type MasterDocumentValidationFailureKind =
  | "literal_usage_limits"
  | "limbic_base_other"
  | "other";

export function getMasterDocumentValidationFailureKind(
  message: string,
): MasterDocumentValidationFailureKind {
  if (message.includes("literal_usage_limits")) {
    return "literal_usage_limits";
  }
  if (
    message.includes("limbic_base") ||
    message.includes('"limbic_base')
  ) {
    return "limbic_base_other";
  }
  return "other";
}

function validateMemory(value: unknown): string | null {
  if (!isPlainObject(value)) {
    return 'La clave "memory" debe ser un objeto.';
  }
  for (const key of MEMORY_ARRAY_KEYS) {
    if (!(key in value)) {
      return `Falta "memory.${key}".`;
    }
    if (!Array.isArray(value[key])) {
      return `"memory.${key}" debe ser un array.`;
    }
  }
  return null;
}

function validateStringArrayField(value: unknown, path: string): string | null {
  if (!Array.isArray(value)) {
    return `"${path}" debe ser un array.`;
  }
  for (let i = 0; i < value.length; i++) {
    const el = value[i];
    if (typeof el !== "string") {
      return `"${path}[${String(i)}]" debe ser un string.`;
    }
    if (el.trim().length === 0) {
      return `"${path}[${String(i)}]" no puede estar vacío.`;
    }
  }
  return null;
}

function validateInputQualityAssessment(value: unknown): string | null {
  if (!isPlainObject(value)) {
    return '"input_quality_assessment" debe ser un objeto.';
  }
  const r = value.overall_readiness;
  if (r !== "low" && r !== "medium" && r !== "high") {
    return '"input_quality_assessment.overall_readiness" debe ser "low", "medium" o "high".';
  }
  const arrErr = validateStringArrayField(
    value.strengths,
    "input_quality_assessment.strengths",
  );
  if (arrErr) return arrErr;
  const wErr = validateStringArrayField(
    value.weaknesses,
    "input_quality_assessment.weaknesses",
  );
  if (wErr) return wErr;
  const mErr = validateStringArrayField(
    value.missing_information,
    "input_quality_assessment.missing_information",
  );
  if (mErr) return mErr;
  const qErr = validateStringArrayField(
    value.recommended_questions_to_improve,
    "input_quality_assessment.recommended_questions_to_improve",
  );
  if (qErr) return qErr;
  const risk = value.risk_if_generating_framework_now;
  if (typeof risk !== "string" || risk.trim().length === 0) {
    return '"input_quality_assessment.risk_if_generating_framework_now" debe ser un string no vacío (en español).';
  }
  const can = value.can_generate_framework;
  if (typeof can !== "boolean") {
    return '"input_quality_assessment.can_generate_framework" debe ser un booleano.';
  }

  if (!isQualityScore0to100(value.overall_quality_score)) {
    return '"input_quality_assessment.overall_quality_score" debe ser un entero entre 0 y 100.';
  }
  if (value.quality_note !== MASTER_DOCUMENT_QUALITY_NOTE) {
    return `"input_quality_assessment.quality_note" debe ser exactamente: ${MASTER_DOCUMENT_QUALITY_NOTE}`;
  }
  const sections = value.section_scores;
  if (!Array.isArray(sections) || sections.length === 0) {
    return '"input_quality_assessment.section_scores" debe ser un array no vacío.';
  }
  for (let i = 0; i < sections.length; i++) {
    const path = `input_quality_assessment.section_scores[${String(i)}]`;
    const row = sections[i];
    if (!isPlainObject(row)) {
      return `"${path}" debe ser un objeto.`;
    }
    const sid = row.section_id;
    if (typeof sid !== "string" || sid.trim().length === 0) {
      return `"${path}.section_id" debe ser un string no vacío.`;
    }
    const slab = row.section_label;
    if (typeof slab !== "string" || slab.trim().length === 0) {
      return `"${path}.section_label" debe ser un string no vacío.`;
    }
    const rel = row.related_wizard_steps;
    if (!Array.isArray(rel) || rel.length === 0) {
      return `"${path}.related_wizard_steps" debe ser un array no vacío de ids de paso.`;
    }
    for (let j = 0; j < rel.length; j++) {
      const stepId = rel[j];
      if (typeof stepId !== "string" || !isWizardStepIdString(stepId)) {
        return `"${path}.related_wizard_steps[${String(j)}]" debe ser un id válido de WIZARD_STEP_ORDER.`;
      }
    }
    if (!isQualityScore0to100(row.quality_score)) {
      return `"${path}.quality_score" debe ser un entero entre 0 y 100.`;
    }
    const st = row.status;
    if (st !== "low" && st !== "medium" && st !== "high") {
      return `"${path}.status" debe ser "low", "medium" o "high".`;
    }
    for (const k of [
      "diagnosis",
      "why_it_matters",
      "recommended_improvement",
    ] as const) {
      const t = row[k];
      if (typeof t !== "string" || t.trim().length === 0) {
        return `"${path}.${k}" debe ser un string no vacío (en español).`;
      }
    }
    const ets = row.edit_target_step;
    if (typeof ets !== "string" || !isWizardStepIdString(ets)) {
      return `"${path}.edit_target_step" debe ser un id válido de WIZARD_STEP_ORDER.`;
    }
  }

  return null;
}

export type ValidateMasterDocumentJsonResult =
  | { ok: true; document: Record<string, unknown> }
  | { ok: false; message: string };

/**
 * Parsea la salida del modelo (con fence opcional) hasta un objeto raíz.
 * No aplica normalización ni validación de negocio.
 */
export function parseMasterDocumentJson(
  rawText: string,
): ValidateMasterDocumentJsonResult {
  const trimmed = stripJsonFence(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      ok: false,
      message:
        "El modelo no devolvió JSON válido (error de sintaxis al interpretar la respuesta).",
    };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, message: "El JSON raíz debe ser un objeto." };
  }

  return { ok: true, document: parsed };
}

/**
 * Valida el documento ya parseado (y opcionalmente normalizado en el route).
 * Mantiene el mismo contrato estricto que antes.
 */
export function validateMasterDocumentRecord(
  parsed: Record<string, unknown>,
): ValidateMasterDocumentJsonResult {
  for (const key of MASTER_DOCUMENT_REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in parsed)) {
      return { ok: false, message: `Falta la clave obligatoria "${key}".` };
    }
  }

  for (const key of [
    "project_identity",
    "raw_inputs",
    "strategic_base",
    "audience_base",
    "evidence_base",
    "voice_base",
    "semantic_base",
    "production_rules",
  ] as const) {
    if (!isPlainObject(parsed[key])) {
      return { ok: false, message: `La clave "${key}" debe ser un objeto.` };
    }
  }

  const limbicErr = validateLimbicBase(parsed.limbic_base);
  if (limbicErr) {
    return { ok: false, message: limbicErr };
  }

  const iqaErr = validateInputQualityAssessment(parsed.input_quality_assessment);
  if (iqaErr) {
    return { ok: false, message: iqaErr };
  }

  const memoryErr = validateMemory(parsed.memory);
  if (memoryErr) {
    return { ok: false, message: memoryErr };
  }

  return { ok: true, document: parsed };
}

/**
 * Parsea, aplica normalización segura del sistema (`limbic_base.literal_usage_limits`)
 * y valida. Para logging fino entre pasos, usar `parseMasterDocumentJson` +
 * `normalizeMasterDocumentBeforeValidation` + `validateMasterDocumentRecord` en el route.
 */
export function validateMasterDocumentOpenAiJson(
  rawText: string,
): ValidateMasterDocumentJsonResult {
  const parsed = parseMasterDocumentJson(rawText);
  if (!parsed.ok) {
    return parsed;
  }
  normalizeMasterDocumentBeforeValidation(parsed.document);
  return validateMasterDocumentRecord(parsed.document);
}
