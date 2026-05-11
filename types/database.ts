/** Alineado con migraciones en `supabase/migrations/`. */

export type BrandStatus = "new" | "existing" | "in_progress";

export type BrandOfferNature =
  | "product"
  | "service"
  | "product_service"
  | "experience_event"
  | "digital_platform_app_saas"
  | "organization_institution_cause"
  | "personal_brand";

/** Journey del catálogo en `question_definitions` (extensible). */
export type QuestionJourneyType = "brand";

export type QuestionAnswerType =
  | "textarea"
  | "text"
  | "single_choice"
  | "url";

export type QuestionOption = {
  value: string;
  label: string;
};

/** `null`: núcleo común para todas las ofertas. */
export type QuestionDefinitionAppliesTo = {
  offer_natures: BrandOfferNature[];
} | null;

/** Fila en `question_definitions` (catálogo; no respuestas de usuario). */
export type QuestionDefinitionRow = {
  id: string;
  journey_type: QuestionJourneyType;
  section_key: string;
  module_key: string;
  question_key: string;
  question_text: string;
  help_text: string | null;
  answer_type: QuestionAnswerType;
  options: QuestionOption[];
  applies_to: QuestionDefinitionAppliesTo;
  is_required: boolean;
  is_sensitive: boolean;
  is_active: boolean;
  evaluation_weight: number;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type BrandRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  brand_status: BrandStatus;
  website_url: string | null;
  country_or_market: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandOfferProfileRow = {
  id: string;
  brand_id: string;
  offer_nature: BrandOfferNature;
  created_at: string;
  updated_at: string;
};

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
