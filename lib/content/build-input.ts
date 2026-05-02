import { GLOBAL_AI_RULES } from "@/lib/ai/global-rules";
import type { MasterDocumentProjectPayload } from "@/lib/master-document/build-input";

export const CONTENT_GENERATION_PROMPT_VERSION = "content-generation-v1.9";

export type ContentGenerationType =
  | "short_pitch"
  | "captions"
  | "content_ideas"
  | "graphic_phrases";

export const CONTENT_TYPE_DEFAULT_QUANTITY: Record<
  ContentGenerationType,
  number
> = {
  short_pitch: 3,
  captions: 5,
  content_ideas: 5,
  graphic_phrases: 8,
};

export const CONTENT_GENERATION_MAX_QUANTITY = 10;

/** Máximo de caracteres para `user_note` (orientación secundaria). */
export const CONTENT_GENERATION_USER_NOTE_MAX = 600;

/** Contexto curado enviado al modelo: maestro + marco aprobado + guía editorial. */
export type ContentGenerationContextBundle = {
  from_master_document: Record<string, unknown>;
  from_approved_visible_framework: Record<string, unknown>;
  persistent_editorial_guidance: string | null;
  /**
   * Respuestas del wizard relevantes al “para qué”: reto declarado, transformación
   * prometida, por qué ahora, tensión, acción/emoción deseada (no son evidencia).
   */
  wizard_purpose_trace: {
    challenge_context: Record<string, unknown>;
    strategic_base: Record<string, unknown>;
    audience_base: Record<string, unknown>;
  };
};

export type ContentGenerationStructuredInput = {
  prompt_version: string;
  content_type: ContentGenerationType;
  quantity: number;
  user_note: string | null;
  master_document: { id: string; version: number };
  visible_framework: { id: string; version: number };
  content_generation_context: ContentGenerationContextBundle;
  global_ai_rules: string;
  generation_instructions: {
    output_language: "Spanish";
    prompt_language: "English";
    json_key_language: "English";
    deliverable: string;
  };
};

export type BuildContentGenerationInputParams = {
  project: MasterDocumentProjectPayload;
  responses: Record<string, unknown>;
  masterDocument: {
    id: string;
    version: number;
    document: Record<string, unknown>;
  };
  visibleFramework: {
    id: string;
    version: number;
    framework: Record<string, unknown>;
  };
  contentType: ContentGenerationType;
  quantity: number;
  userNote: string | null;
  /** Última nota de revisión del Marco guardada en eventos (opcional). */
  persistentEditorialGuidance?: string | null;
};

export type BuildContentGenerationInputResult = {
  structured: ContentGenerationStructuredInput;
  input_payload_summary: Record<string, unknown>;
};

function readSubRecord(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const v = source[key];
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  return {};
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const el of value) {
    if (typeof el === "string") {
      const t = el.trim();
      if (t.length > 0) out.push(t);
    }
  }
  return out;
}

/**
 * Mensajes a evitar: raíz legacy `what_to_avoid` o `message_architecture.messages_to_avoid` en el marco actual.
 */
function readWhatToAvoid(framework: Record<string, unknown>): string[] {
  if (Array.isArray(framework.what_to_avoid)) {
    return normalizeStringArray(framework.what_to_avoid);
  }
  const ma = readSubRecord(framework, "message_architecture");
  if (Array.isArray(ma.messages_to_avoid)) {
    return normalizeStringArray(ma.messages_to_avoid);
  }
  return [];
}

function shallowKeyPresence(
  obj: Record<string, unknown>,
  keys: readonly string[],
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const k of keys) {
    out[k] = k in obj && obj[k] !== null && obj[k] !== undefined;
  }
  return out;
}

function approxJsonSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

function recordHasContent(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length > 0;
}

function readMasterSlice(
  doc: Record<string, unknown>,
  key: string,
): unknown {
  const v = doc[key];
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (v !== null && v !== undefined) {
    return v;
  }
  return null;
}

/**
 * Recorte amplio del Marco aprobado para derivar piezas de contenido.
 */
function buildApprovedFrameworkForContent(
  fw: Record<string, unknown>,
): Record<string, unknown> {
  const exec =
    typeof fw.executive_summary === "string" ? fw.executive_summary.trim() : "";
  const strategic_recommendations = Array.isArray(fw.strategic_recommendations)
    ? normalizeStringArray(fw.strategic_recommendations)
    : [];

  return {
    executive_summary: exec,
    strategic_diagnosis: readSubRecord(fw, "strategic_diagnosis"),
    audience: readSubRecord(fw, "audience"),
    conflict_map: readSubRecord(fw, "conflict_map"),
    risk_map: readSubRecord(fw, "risk_map"),
    narrative_strategy: readSubRecord(fw, "narrative_strategy"),
    message_architecture: readSubRecord(fw, "message_architecture"),
    content_strategy_opportunities: readSubRecord(
      fw,
      "content_strategy_opportunities",
    ),
    success_signals: readSubRecord(fw, "success_signals"),
    strategic_recommendations,
    guardrails: Array.isArray(fw.guardrails)
      ? normalizeStringArray(fw.guardrails)
      : [],
    what_to_avoid: readWhatToAvoid(fw),
  };
}

export function buildContentGenerationInput(
  params: BuildContentGenerationInputParams,
): BuildContentGenerationInputResult {
  const { project, responses, masterDocument, visibleFramework, contentType } =
    params;
  const doc = masterDocument.document;
  const fw = visibleFramework.framework;

  const fromWizardIdentity = readSubRecord(responses, "project_identity");

  const project_identity: Record<string, unknown> = {
    id: project.id,
    user_id: project.user_id,
    name_or_descriptor: project.name_or_descriptor,
    name_status: project.name_status,
    challenge_type: project.challenge_type,
    main_challenge: project.main_challenge,
    status: project.status,
    ...(project.created_at !== undefined
      ? { created_at: project.created_at }
      : {}),
    ...(project.updated_at !== undefined
      ? { updated_at: project.updated_at }
      : {}),
    ...fromWizardIdentity,
  };

  const persistent_editorial_guidance =
    params.persistentEditorialGuidance &&
    params.persistentEditorialGuidance.trim().length > 0
      ? params.persistentEditorialGuidance.trim()
      : null;

  const from_master_document: Record<string, unknown> = {
    project_identity,
    strategic_base: readSubRecord(doc, "strategic_base"),
    audience_base: readSubRecord(doc, "audience_base"),
    evidence_base: readSubRecord(doc, "evidence_base"),
    limbic_base: readSubRecord(doc, "limbic_base"),
    voice_base: readSubRecord(doc, "voice_base"),
    semantic_base: readSubRecord(doc, "semantic_base"),
    production_rules: readSubRecord(doc, "production_rules"),
    input_quality_assessment: readMasterSlice(doc, "input_quality_assessment"),
    memory: readMasterSlice(doc, "memory"),
  };

  const from_approved_visible_framework = buildApprovedFrameworkForContent(fw);

  const wizard_purpose_trace = {
    challenge_context: readSubRecord(responses, "challenge_context"),
    strategic_base: readSubRecord(responses, "strategic_base"),
    audience_base: readSubRecord(responses, "audience_base"),
  };

  const content_generation_context: ContentGenerationContextBundle = {
    from_master_document,
    from_approved_visible_framework,
    persistent_editorial_guidance,
    wizard_purpose_trace,
  };

  const structured: ContentGenerationStructuredInput = {
    prompt_version: CONTENT_GENERATION_PROMPT_VERSION,
    content_type: contentType,
    quantity: params.quantity,
    user_note: params.userNote,
    master_document: {
      id: masterDocument.id,
      version: masterDocument.version,
    },
    visible_framework: {
      id: visibleFramework.id,
      version: visibleFramework.version,
    },
    content_generation_context,
    global_ai_rules: GLOBAL_AI_RULES,
    generation_instructions: {
      output_language: "Spanish",
      prompt_language: "English",
      json_key_language: "English",
      deliverable: `generated_content_${contentType}`,
    },
  };

  const masterKeys = shallowKeyPresence(doc, [
    "evidence_base",
    "production_rules",
    "semantic_base",
    "voice_base",
    "project_identity",
    "strategic_base",
    "audience_base",
    "limbic_base",
    "input_quality_assessment",
    "memory",
  ]);
  const fwKeys = shallowKeyPresence(fw, [
    "guardrails",
    "content_strategy_opportunities",
    "message_architecture",
    "executive_summary",
    "success_signals",
    "strategic_recommendations",
  ]);

  const m = from_master_document;
  const f = from_approved_visible_framework;

  const input_payload_summary: Record<string, unknown> = {
    summary_version: 2,
    master_document_id: masterDocument.id,
    master_document_version: masterDocument.version,
    visible_framework_id: visibleFramework.id,
    visible_framework_version: visibleFramework.version,
    content_type: contentType,
    quantity: params.quantity,
    user_note_char_count: params.userNote ? params.userNote.length : 0,
    master_key_presence: masterKeys,
    framework_key_presence: fwKeys,
    has_persistent_editorial_guidance: persistent_editorial_guidance !== null,
    has_wizard_purpose_trace:
      recordHasContent(wizard_purpose_trace.challenge_context) ||
      recordHasContent(wizard_purpose_trace.strategic_base) ||
      recordHasContent(wizard_purpose_trace.audience_base),
    has_limbic_base: recordHasContent(m.limbic_base as Record<string, unknown>),
    has_semantic_base: recordHasContent(
      m.semantic_base as Record<string, unknown>,
    ),
    has_voice_base: recordHasContent(m.voice_base as Record<string, unknown>),
    has_production_rules: recordHasContent(
      m.production_rules as Record<string, unknown>,
    ),
    has_strategic_base: recordHasContent(
      m.strategic_base as Record<string, unknown>,
    ),
    has_audience_base: recordHasContent(
      m.audience_base as Record<string, unknown>,
    ),
    has_input_quality_assessment:
      m.input_quality_assessment !== null &&
      m.input_quality_assessment !== undefined,
    has_memory: m.memory !== null && m.memory !== undefined,
    has_approved_framework_snapshot: recordHasContent(f),
    approx_evidence_base_chars: approxJsonSize(m.evidence_base),
    approx_semantic_base_chars: approxJsonSize(m.semantic_base),
    approx_limbic_base_chars: approxJsonSize(m.limbic_base),
    approx_content_strategy_chars: approxJsonSize(
      f.content_strategy_opportunities,
    ),
    approx_approved_framework_chars: approxJsonSize(f),
    approx_content_generation_context_chars: approxJsonSize(
      content_generation_context,
    ),
    guardrails_count: Array.isArray(f.guardrails) ? f.guardrails.length : 0,
    what_to_avoid_count: Array.isArray(f.what_to_avoid)
      ? f.what_to_avoid.length
      : 0,
  };

  return { structured, input_payload_summary };
}
