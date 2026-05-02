import { GLOBAL_AI_RULES } from "@/lib/ai/global-rules";
import { buildLimbicInterpretation } from "@/lib/interpretation";
import type { LimbicInterpretationResult } from "@/lib/interpretation/types";

/** Fila `projects` mínima compatible con GET /api/projects/:id */
export type MasterDocumentProjectPayload = {
  id: string;
  user_id: string;
  name_or_descriptor: string;
  name_status: string;
  challenge_type: string | null;
  main_challenge: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type MasterDocumentGenerationInstructions = {
  builder_version: string;
  deliverable: string;
  output_language: "Spanish";
  json_key_language: "English";
  prompt_language: "English";
};

export type MasterDocumentStructuredInput = {
  project_identity: Record<string, unknown>;
  raw_responses: Record<string, unknown>;
  strategic_context: Record<string, unknown>;
  audience_context: Record<string, unknown>;
  evidence_context: Record<string, unknown>;
  limbic_interpretation: LimbicInterpretationResult;
  voice_context: Record<string, unknown>;
  global_ai_rules: string;
  generation_instructions: MasterDocumentGenerationInstructions;
};

export type BuildMasterDocumentInputParams = {
  project: MasterDocumentProjectPayload;
  responses: Record<string, unknown>;
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

/**
 * Prepara el input estructurado para el futuro generador del Documento Maestro.
 * Sin OpenAI, sin persistencia, sin inferir datos fuera de project/responses.
 */
export function buildMasterDocumentInput({
  project,
  responses,
}: BuildMasterDocumentInputParams): MasterDocumentStructuredInput {
  const raw_responses: Record<string, unknown> = {
    ...responses,
  };

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

  const strategic_base = readSubRecord(responses, "strategic_base");
  const challenge_context = readSubRecord(responses, "challenge_context");
  const strategic_context: Record<string, unknown> = {
    strategic_base,
    challenge_context,
    from_project: {
      challenge_type: project.challenge_type,
      main_challenge: project.main_challenge,
    },
  };

  const audience_context = readSubRecord(responses, "audience_base");

  const evidence_context = readSubRecord(responses, "evidence_base");

  const voice_context: Record<string, unknown> = {
    voice_base: readSubRecord(responses, "voice_base"),
    review: readSubRecord(responses, "review"),
  };

  const limbic_interpretation = buildLimbicInterpretation(responses);

  const generation_instructions: MasterDocumentGenerationInstructions = {
    builder_version: "5b-v1",
    deliverable: "narrative_knowledge_master_json",
    output_language: "Spanish",
    json_key_language: "English",
    prompt_language: "English",
  };

  return {
    project_identity,
    raw_responses,
    strategic_context,
    audience_context,
    evidence_context,
    limbic_interpretation,
    voice_context,
    global_ai_rules: GLOBAL_AI_RULES,
    generation_instructions,
  };
}
