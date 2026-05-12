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
  | "multi_choice"
  | "scale"
  | "url"
  | "number"
  | "boolean";

/** Opción de pregunta; campos extra soportan UI rica (sin nuevo `answer_type`). */
export type QuestionOption = {
  value: string;
  label: string;
  description?: string | null;
  visual_hint?: string | null;
  image_url?: string | null;
  emoji?: string | null;
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

/**
 * Tipos de respuesta persistidos en `brand_responses` (superconjunto del catálogo actual).
 * Evita migraciones cuando `question_definitions` incorpore nuevos `answer_type`.
 */
export type BrandResponseAnswerType =
  | "text"
  | "textarea"
  | "single_choice"
  | "multi_choice"
  | "scale"
  | "url"
  | "number"
  | "boolean";

/** Contrato de `answer_value` (jsonb) según `answer_type`. */
export type BrandAnswerValueJson =
  | { text: string }
  | { value: string }
  | { values: string[] }
  | { value: number }
  | { value: boolean };

/** Fila en `brand_responses`. */
export type BrandResponseRow = {
  id: string;
  brand_id: string;
  question_definition_id: string;
  section_key: string;
  module_key: string;
  question_key: string;
  answer_value: BrandAnswerValueJson;
  answer_text: string | null;
  answer_type: BrandResponseAnswerType;
  is_required: boolean;
  is_sensitive: boolean;
  source_type: "questionnaire";
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

export type BrandDocumentType =
  | "manual"
  | "brief"
  | "deck"
  | "portfolio"
  | "study"
  | "strategy"
  | "institutional"
  | "success_case"
  | "other";

export type BrandDocumentProcessingStatus =
  | "pending"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed";

/** Fila en `brand_documents` (Ticket 3B.1). */
export type BrandDocumentRow = {
  id: string;
  brand_id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  document_type: BrandDocumentType;
  storage_path: string;
  file_size_bytes: number | null;
  processing_status: BrandDocumentProcessingStatus;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
};

/** Estados de fila en `brand_document_extractions` (Ticket 3B.2). */
export type BrandDocumentExtractionStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "succeeded_empty"
  | "failed";

/** Fila en `brand_document_extractions` (Ticket 3B.2). */
export type BrandDocumentExtractionRow = {
  id: string;
  brand_document_id: string;
  brand_id: string;
  extraction_status: BrandDocumentExtractionStatus;
  extracted_text: string | null;
  page_count: number | null;
  character_count: number | null;
  extraction_metadata: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

/** Resumen devuelto en listados (sin `extracted_text`). */
export type BrandDocumentExtractionSummary = {
  extraction_status: BrandDocumentExtractionStatus;
  page_count: number | null;
  character_count: number | null;
  truncated: boolean;
  /** Mensaje corto (vacío / fallo extracción); no es el texto del PDF. */
  summary_message: string | null;
};

/** Documento de marca con resumen de extracción (`GET .../documents`). */
export type BrandDocumentListRow = BrandDocumentRow & {
  extraction_summary: BrandDocumentExtractionSummary | null;
};

/** Estados de `brand_document_analysis_batches` (Ticket 3B.3). */
export type BrandDocumentAnalysisBatchStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed";

export type BrandDocumentAnalysisBatchRow = {
  id: string;
  brand_id: string;
  status: BrandDocumentAnalysisBatchStatus;
  documents_count: number;
  analyzed_documents_count: number;
  skipped_documents_count: number;
  findings_count: number;
  useful_sections_count: number;
  model_used: string | null;
  prompt_version: string;
  input_hash: string | null;
  analysis_summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

/** Estados de `brand_document_analysis_runs` (Ticket 3B.3). */
export type BrandDocumentAnalysisRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "skipped"
  | "failed";

export type BrandDocumentAnalysisRunRow = {
  id: string;
  brand_id: string;
  batch_id: string | null;
  brand_document_id: string;
  brand_document_extraction_id: string;
  status: BrandDocumentAnalysisRunStatus;
  model_used: string | null;
  prompt_version: string;
  input_hash: string | null;
  findings_count: number;
  useful_sections_count: number;
  analysis_summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandSourceFactSourceType = "document" | "manual" | "system";

export type BrandSourceFactRelationshipType =
  | "new"
  | "complements"
  | "reinforces"
  | "contradicts";

export type BrandSourceFactType =
  | "identity"
  | "audience"
  | "value_proposition"
  | "differentiator"
  | "evidence"
  | "tone"
  | "restriction"
  | "limbic_signal"
  | "offer_detail"
  | "positioning"
  | "purpose"
  | "approved_message"
  | "other";

export type BrandSourceFactStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "superseded";

/** Fila en `brand_source_facts` (Ticket 3B.3). */
export type BrandSourceFactRow = {
  id: string;
  brand_id: string;
  source_type: BrandSourceFactSourceType;
  brand_document_id: string | null;
  brand_document_extraction_id: string | null;
  analysis_batch_id: string | null;
  analysis_run_id: string | null;
  section_key: string;
  module_key: string | null;
  question_key: string | null;
  relationship_type: BrandSourceFactRelationshipType;
  fact_type: BrandSourceFactType;
  source_excerpt: string | null;
  source_reference: string | null;
  source_document_name: string | null;
  supporting_documents: unknown[];
  extracted_fact: string;
  ai_interpretation: string | null;
  existing_response_summary: string | null;
  proposed_inclusion: string;
  user_edited_text: string | null;
  status: BrandSourceFactStatus;
  rejection_reason: string | null;
  confidence_score: number | null;
  dedupe_fingerprint: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

/** Estados de `brand_evaluations` (Ticket 4 — diagnóstico de marca). */
export type BrandEvaluationStatus = "running" | "succeeded" | "failed";

/** Nivel de calidad derivado del score (0–39 critical … 90–100 excellent). */
export type BrandDiagnosisQualityLevel =
  | "critical"
  | "weak"
  | "acceptable"
  | "strong"
  | "excellent";

/** Siguiente paso recomendado por el diagnóstico. */
export type BrandDiagnosisNextRecommendedAction =
  | "improve_required"
  | "improve_recommended"
  | "ready_for_consolidation";

/** Fila en `brand_evaluations` (Ticket 4). */
export type BrandEvaluationRow = {
  id: string;
  brand_id: string;
  evaluation_version: number;
  status: BrandEvaluationStatus;
  overall_score: number | null;
  quality_level: BrandDiagnosisQualityLevel | null;
  strategic_reading: string | null;
  diagnosis_payload: Record<string, unknown>;
  section_scores: unknown[];
  critical_gaps: unknown[];
  contradictions: unknown[];
  improvement_plan: unknown[];
  next_recommended_action: BrandDiagnosisNextRecommendedAction | null;
  source_snapshot: Record<string, unknown>;
  model_used: string | null;
  prompt_version: string;
  error_message: string | null;
  is_active: boolean;
  superseded_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Estados de `brand_improvement_sessions` (Ticket 5). */
export type BrandImprovementSessionStatus =
  | "open"
  | "draft_ready"
  | "approved"
  | "abandoned"
  | "failed";

/** Estados de `brand_section_improvements` (Ticket 5). */
export type BrandSectionImprovementStatus = "approved" | "superseded";

export type BrandImprovementSessionRow = {
  id: string;
  brand_id: string;
  section_key: string;
  status: BrandImprovementSessionStatus;
  brand_evaluation_id: string | null;
  max_user_turns: number;
  user_turn_count: number;
  draft_payload: Record<string, unknown>;
  closed_reason: string | null;
  summary_for_consolidation: string | null;
  model_used: string | null;
  prompt_version: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandImprovementMessageRole = "user" | "assistant" | "system";

export type BrandImprovementMessageRow = {
  id: string;
  session_id: string;
  role: BrandImprovementMessageRole;
  content: string;
  structured_payload: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type BrandSectionImprovementRow = {
  id: string;
  brand_id: string;
  section_key: string;
  session_id: string | null;
  status: BrandSectionImprovementStatus;
  is_active: boolean;
  payload: Record<string, unknown>;
  approved_at: string | null;
  superseded_at: string | null;
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
