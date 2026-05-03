import type { SupabaseClient } from "@supabase/supabase-js";

export type QuestionnaireEvaluationRow = {
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

export type QuestionnaireClarificationRow = {
  id: string;
  project_id: string;
  user_id: string;
  evaluation_id: string | null;
  answers: unknown;
  submitted_at: string;
  generated_master_document_id: string | null;
  created_at: string;
};

/**
 * Evaluación activa (no sustituida) para el proyecto.
 * Opcionalmente exige coincidencia con el hash actual de `responses`.
 */
export async function getActiveQuestionnaireEvaluation(
  supabase: SupabaseClient,
  projectId: string,
  options?: { sourceResponsesHash?: string },
): Promise<QuestionnaireEvaluationRow | null> {
  let q = supabase
    .from("questionnaire_evaluations")
    .select(
      "id, project_id, user_id, source_responses_hash, payload, model_used, prompt_version, is_active, superseded_at, created_at",
    )
    .eq("project_id", projectId)
    .eq("is_active", true)
    .is("superseded_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const hash = options?.sourceResponsesHash;
  if (hash !== undefined) {
    q = q.eq("source_responses_hash", hash);
  }

  const { data, error } = await q.maybeSingle();

  if (error) {
    console.error("[getActiveQuestionnaireEvaluation]", error.message);
    return null;
  }
  if (!data || typeof data.payload !== "object" || data.payload === null) {
    return null;
  }
  return data as QuestionnaireEvaluationRow;
}

/**
 * Marca evaluaciones previas del proyecto como inactivas (no borra filas).
 */
export async function supersedeQuestionnaireEvaluationsForProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("questionnaire_evaluations")
    .update({
      is_active: false,
      superseded_at: new Date().toISOString(),
    })
    .eq("project_id", projectId)
    .eq("is_active", true);

  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

export async function insertQuestionnaireEvaluation(
  supabase: SupabaseClient,
  row: {
    project_id: string;
    user_id: string;
    source_responses_hash: string;
    payload: Record<string, unknown>;
    model_used: string | null;
    prompt_version: string | null;
  },
): Promise<{ data: QuestionnaireEvaluationRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("questionnaire_evaluations")
    .insert({
      project_id: row.project_id,
      user_id: row.user_id,
      source_responses_hash: row.source_responses_hash,
      payload: row.payload,
      model_used: row.model_used,
      prompt_version: row.prompt_version,
      is_active: true,
      superseded_at: null,
    })
    .select(
      "id, project_id, user_id, source_responses_hash, payload, model_used, prompt_version, is_active, superseded_at, created_at",
    )
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  return { data: data as QuestionnaireEvaluationRow, error: null };
}

/**
 * Última fila de aclaraciones para un proyecto y evaluación (por `submitted_at`).
 */
export async function getLatestQuestionnaireClarifications(
  supabase: SupabaseClient,
  projectId: string,
  evaluationId: string,
): Promise<QuestionnaireClarificationRow | null> {
  const { data, error } = await supabase
    .from("questionnaire_clarifications")
    .select(
      "id, project_id, user_id, evaluation_id, answers, submitted_at, generated_master_document_id, created_at",
    )
    .eq("project_id", projectId)
    .eq("evaluation_id", evaluationId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getLatestQuestionnaireClarifications]", error.message);
    return null;
  }
  if (!data) return null;
  return data as QuestionnaireClarificationRow;
}

export async function insertQuestionnaireClarification(
  supabase: SupabaseClient,
  row: {
    project_id: string;
    user_id: string;
    evaluation_id: string | null;
    answers: unknown;
    submitted_at: string;
  },
): Promise<{ data: QuestionnaireClarificationRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("questionnaire_clarifications")
    .insert({
      project_id: row.project_id,
      user_id: row.user_id,
      evaluation_id: row.evaluation_id,
      answers: row.answers,
      submitted_at: row.submitted_at,
    })
    .select(
      "id, project_id, user_id, evaluation_id, answers, submitted_at, generated_master_document_id, created_at",
    )
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  return { data: data as QuestionnaireClarificationRow, error: null };
}

/**
 * Asocia la aclaración más reciente (sin maestro) a un documento maestro generado.
 */
export async function linkLatestPendingClarificationToMasterDocument(
  supabase: SupabaseClient,
  projectId: string,
  evaluationId: string,
  masterDocumentId: string,
): Promise<{ error: Error | null }> {
  const { data: row, error: fetchError } = await supabase
    .from("questionnaire_clarifications")
    .select("id")
    .eq("project_id", projectId)
    .eq("evaluation_id", evaluationId)
    .is("generated_master_document_id", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return { error: new Error(fetchError.message) };
  }
  if (!row?.id) {
    return { error: null };
  }

  const { error: updateError } = await supabase
    .from("questionnaire_clarifications")
    .update({ generated_master_document_id: masterDocumentId })
    .eq("id", row.id);

  if (updateError) {
    return { error: new Error(updateError.message) };
  }
  return { error: null };
}
