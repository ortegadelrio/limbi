/**
 * Resolución de contexto para **generación de contenido de proyecto** desde maestro + wizard.
 * Hoy prioriza `masterDocument` y cae a `project_responses` como fallback; **no** es el camino de
 * marca anclada a `brand_knowledge_bases`. Cuando la generación consuma marca explícitamente, debe
 * usar `loadActiveBrandContextForProject` (payload profundo), **no** el resumen visible de `/bases`.
 */
import type { MasterDocumentProjectPayload } from "@/lib/master-document/build-input";

export type StrategicGenerationSource = "master_document" | "responses_fallback";

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

function recordHasContent(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length > 0;
}

export type ResolveStrategicContextForGenerationParams = {
  project: MasterDocumentProjectPayload;
  responses: Record<string, unknown>;
  masterDocument: Record<string, unknown>;
};

export type ResolvedStrategicContextForGeneration = {
  generation_trace_source: StrategicGenerationSource;
  responses_fallback_fields: string[];
  project_identity_for_generation: Record<string, unknown>;
  /** Declared challenge / “why now” / transformation framing from master `raw_inputs` when present. */
  purpose_trace_for_generation: Record<string, unknown>;
  strategic_trace_for_generation: Record<string, unknown>;
  audience_trace_for_generation: Record<string, unknown>;
  wizard_purpose_trace: {
    challenge_context: Record<string, unknown>;
    strategic_base: Record<string, unknown>;
    audience_base: Record<string, unknown>;
  };
  /** Root keys of live `project_responses.responses` only — no values (staleness / coverage fingerprint). */
  project_responses_staleness_trace: { response_root_keys: string[] } | null;
};

function challengeContextFromMaster(
  masterDocument: Record<string, unknown>,
): Record<string, unknown> {
  const raw = readSubRecord(masterDocument, "raw_inputs");
  const fromRaw = readSubRecord(raw, "challenge_context");
  if (recordHasContent(fromRaw)) return fromRaw;
  return {};
}

/**
 * Resolves project identity and wizard-aligned purpose traces for content generation:
 * primary slices from `masterDocument`; per-field fallback to `responses` when a slice is empty.
 */
export function resolveStrategicContextForGeneration(
  params: ResolveStrategicContextForGenerationParams,
): ResolvedStrategicContextForGeneration {
  const { project, responses, masterDocument } = params;
  const responses_fallback_fields: string[] = [];

  const baseIdentity: Record<string, unknown> = {
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
  };

  const fromMasterIdentity = readSubRecord(masterDocument, "project_identity");
  const fromResponsesIdentity = readSubRecord(responses, "project_identity");

  let project_identity_for_generation: Record<string, unknown>;
  if (!recordHasContent(fromMasterIdentity)) {
    project_identity_for_generation = {
      ...baseIdentity,
      ...fromResponsesIdentity,
    };
    responses_fallback_fields.push("project_identity");
  } else {
    project_identity_for_generation = { ...baseIdentity, ...fromMasterIdentity };
    for (const [k, v] of Object.entries(fromResponsesIdentity)) {
      const cur = project_identity_for_generation[k];
      const emptyString = typeof cur === "string" && cur.trim().length === 0;
      const missing =
        cur === undefined || cur === null || emptyString;
      if (
        missing &&
        v !== undefined &&
        v !== null &&
        !(typeof v === "string" && v.trim().length === 0)
      ) {
        project_identity_for_generation[k] = v;
        responses_fallback_fields.push(`project_identity.${k}`);
      }
    }
  }

  const purpose_trace_for_generation = (() => {
    const m = challengeContextFromMaster(masterDocument);
    if (recordHasContent(m)) return m;
    const r = readSubRecord(responses, "challenge_context");
    if (recordHasContent(r)) {
      responses_fallback_fields.push("wizard_purpose_trace.challenge_context");
    }
    return r;
  })();

  const strategic_trace_for_generation = (() => {
    const m = readSubRecord(masterDocument, "strategic_base");
    if (recordHasContent(m)) return m;
    const r = readSubRecord(responses, "strategic_base");
    if (recordHasContent(r)) {
      responses_fallback_fields.push("wizard_purpose_trace.strategic_base");
    }
    return r;
  })();

  const audience_trace_for_generation = (() => {
    const m = readSubRecord(masterDocument, "audience_base");
    if (recordHasContent(m)) return m;
    const r = readSubRecord(responses, "audience_base");
    if (recordHasContent(r)) {
      responses_fallback_fields.push("wizard_purpose_trace.audience_base");
    }
    return r;
  })();

  const wizard_purpose_trace = {
    challenge_context: purpose_trace_for_generation,
    strategic_base: strategic_trace_for_generation,
    audience_base: audience_trace_for_generation,
  };

  const response_root_keys = Object.keys(responses).sort();
  const project_responses_staleness_trace =
    response_root_keys.length > 0
      ? { response_root_keys }
      : null;

  const generation_trace_source: StrategicGenerationSource =
    responses_fallback_fields.length > 0
      ? "responses_fallback"
      : "master_document";

  return {
    generation_trace_source,
    responses_fallback_fields,
    project_identity_for_generation,
    purpose_trace_for_generation,
    strategic_trace_for_generation,
    audience_trace_for_generation,
    wizard_purpose_trace,
    project_responses_staleness_trace,
  };
}
