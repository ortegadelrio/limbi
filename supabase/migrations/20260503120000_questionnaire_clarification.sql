-- Post-cuestionario: evaluación previa al maestro y respuestas de aclaración (no sustituyen `responses`).

ALTER TABLE public.project_responses
  ADD COLUMN IF NOT EXISTS questionnaire_pre_master_evaluation jsonb,
  ADD COLUMN IF NOT EXISTS questionnaire_pre_master_evaluation_source_hash text,
  ADD COLUMN IF NOT EXISTS questionnaire_clarifications jsonb;

COMMENT ON COLUMN public.project_responses.questionnaire_pre_master_evaluation IS
  'Evaluación IA estructurada tras completar el cuestionario (calidad, brechas, preguntas de aclaración).';
COMMENT ON COLUMN public.project_responses.questionnaire_pre_master_evaluation_source_hash IS
  'Hash canónico de `responses` en el momento de la evaluación (invalidación / caché).';
COMMENT ON COLUMN public.project_responses.questionnaire_clarifications IS
  'Respuestas del usuario al flujo de aclaración: refinamientos estratégicos, sin sobrescribir el cuestionario.';
