import type { MasterDocumentProjectPayload } from "@/lib/master-document/build-input";

export type ActiveMasterDocumentForFramework = {
  id: string;
  version: number;
  document: Record<string, unknown>;
};

export type VisibleFrameworkGenerationInstructions = {
  builder_version: string;
  deliverable: string;
  output_language: "Spanish";
  json_key_language: "English";
  prompt_language: "English";
};

/** Refinamiento secundario al regenerar desde un marco visible existente. */
export type VisibleFrameworkRevisionContext = {
  source_visible_framework_id: string;
  revision_note: string;
  prior_visible_framework: Record<string, unknown>;
  revision_note_event_id?: string;
  carried_forward?: boolean;
  instruction?: string;
};

export type VisibleFrameworkStructuredInput = {
  project_identity: Record<string, unknown>;
  master_document_reference: { id: string; version: number };
  /**
   * Wizard-origin fields preserved in the Master Document `raw_inputs` (challenge,
   * transformation, why now, desired action, etc.) so the Marco can anchor “para qué”.
   * Empty object when the active document has no usable `raw_inputs`.
   */
  wizard_stated_purpose_trace: Record<string, unknown>;
  strategic_base: Record<string, unknown>;
  audience_base: Record<string, unknown>;
  evidence_base: Record<string, unknown>;
  voice_base: Record<string, unknown>;
  semantic_base: Record<string, unknown>;
  production_rules: Record<string, unknown>;
  limbic_summary: {
    symbolic_interpretation: Record<string, unknown>;
    literal_usage_limits: unknown[];
  };
  revision_context?: VisibleFrameworkRevisionContext;
  generation_instructions: VisibleFrameworkGenerationInstructions;
};

export type BuildVisibleFrameworkInputParams = {
  project: MasterDocumentProjectPayload;
  masterDocument: ActiveMasterDocumentForFramework;
  revisionContext?: VisibleFrameworkRevisionContext;
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

function readLiteralUsageLimits(doc: Record<string, unknown>): unknown[] {
  const limbic = readSubRecord(doc, "limbic_base");
  const raw = limbic.literal_usage_limits;
  return Array.isArray(raw) ? raw : [];
}

/** Subset of wizard answers embedded in Master Document `raw_inputs` for “para qué” traceability. */
function readWizardStatedPurposeTraceFromMaster(
  doc: Record<string, unknown>,
): Record<string, unknown> {
  const raw = doc.raw_inputs;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const r = raw as Record<string, unknown>;
  return {
    challenge_context: readSubRecord(r, "challenge_context"),
    strategic_base: readSubRecord(r, "strategic_base"),
    audience_base: readSubRecord(r, "audience_base"),
  };
}

/**
 * Input para el Marco visible. **No** incluye `raw_inputs` del maestro ni
 * respuestas crudas del wizard — solo síntesis ya presentes en el documento activo.
 */
export function buildVisibleFrameworkInput({
  project,
  masterDocument,
  revisionContext,
}: BuildVisibleFrameworkInputParams): VisibleFrameworkStructuredInput {
  const doc = masterDocument.document;

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
  };

  const limbic = readSubRecord(doc, "limbic_base");
  const symbolic_interpretation = readSubRecord(
    limbic,
    "symbolic_interpretation",
  );

  const base: VisibleFrameworkStructuredInput = {
    project_identity,
    master_document_reference: {
      id: masterDocument.id,
      version: masterDocument.version,
    },
    wizard_stated_purpose_trace: readWizardStatedPurposeTraceFromMaster(doc),
    strategic_base: readSubRecord(doc, "strategic_base"),
    audience_base: readSubRecord(doc, "audience_base"),
    evidence_base: readSubRecord(doc, "evidence_base"),
    voice_base: readSubRecord(doc, "voice_base"),
    semantic_base: readSubRecord(doc, "semantic_base"),
    production_rules: readSubRecord(doc, "production_rules"),
    limbic_summary: {
      symbolic_interpretation,
      literal_usage_limits: readLiteralUsageLimits(doc),
    },
    generation_instructions: {
      builder_version: "6-v3",
      deliverable: "visible_strategic_narrative_framework",
      output_language: "Spanish",
      json_key_language: "English",
      prompt_language: "English",
    },
  };

  if (revisionContext) {
    const revision_context: VisibleFrameworkRevisionContext = {
      source_visible_framework_id:
        revisionContext.source_visible_framework_id,
      revision_note: revisionContext.revision_note,
      prior_visible_framework: revisionContext.prior_visible_framework,
    };
    if (revisionContext.revision_note_event_id) {
      revision_context.revision_note_event_id =
        revisionContext.revision_note_event_id;
    }
    if (revisionContext.carried_forward === true) {
      revision_context.carried_forward = true;
    }
    if (revisionContext.instruction) {
      revision_context.instruction = revisionContext.instruction;
    }
    return {
      ...base,
      revision_context,
    };
  }

  return base;
}
