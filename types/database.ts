/** Alineado con `supabase/migrations/20260502180000_limbi_product_schema.sql` */

export type ProjectNameStatus = "definitive" | "provisional" | "unnamed";

export type ProjectStatus =
  | "draft"
  | "responses_completed"
  | "master_created"
  | "framework_created"
  | "framework_approved";

export type MasterDocumentStatus = "active" | "archived";

export type VisibleFrameworkStatus = "draft" | "approved" | "archived";

export type GeneratedContentType =
  | "short_pitch"
  | "captions"
  | "content_ideas"
  | "graphic_phrases";

export type GeneratedContentStatus =
  | "generated"
  | "favorited"
  | "rejected"
  | "edited"
  | "archived";

export type ProjectRow = {
  id: string;
  user_id: string;
  name_or_descriptor: string;
  name_status: ProjectNameStatus;
  challenge_type: string | null;
  main_challenge: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

export type ProjectResponsesRow = {
  id: string;
  project_id: string;
  user_id: string;
  responses: Record<string, unknown>;
  completed_steps: string[];
  questionnaire_pre_master_evaluation?: Record<string, unknown> | null;
  questionnaire_pre_master_evaluation_source_hash?: string | null;
  questionnaire_clarifications?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

/** Fila en `questionnaire_evaluations` (evaluación IA pre–maestro, versionada). */
export type QuestionnaireEvaluationDbRow = {
  id: string;
  project_id: string;
  user_id: string;
  source_responses_hash: string;
  payload: Record<string, unknown>;
  model_used: string | null;
  prompt_version: string | null;
  is_active: boolean;
  superseded_at: string | null;
  created_at: string;
};

/** Fila en `questionnaire_clarifications` (respuestas de aclaración post-cuestionario). */
export type QuestionnaireClarificationDbRow = {
  id: string;
  project_id: string;
  user_id: string;
  evaluation_id: string | null;
  answers: unknown;
  submitted_at: string;
  generated_master_document_id: string | null;
  created_at: string;
};

export type MasterDocumentRow = {
  id: string;
  project_id: string;
  user_id: string;
  version: number;
  document: Record<string, unknown>;
  status: MasterDocumentStatus;
  created_at: string;
  updated_at: string;
};

export type VisibleFrameworkRow = {
  id: string;
  project_id: string;
  user_id: string;
  master_document_id: string | null;
  version: number;
  framework: Record<string, unknown>;
  status: VisibleFrameworkStatus;
  created_at: string;
  updated_at: string;
};

export type GeneratedContentRow = {
  id: string;
  project_id: string;
  user_id: string;
  master_document_id: string | null;
  visible_framework_id: string | null;
  content_type: GeneratedContentType;
  request: Record<string, unknown>;
  output: Record<string, unknown>;
  status: GeneratedContentStatus;
  created_at: string;
  updated_at: string;
};

export type ProjectEventRow = {
  id: string;
  project_id: string;
  user_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};
