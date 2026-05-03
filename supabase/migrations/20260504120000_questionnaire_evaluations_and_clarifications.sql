-- Additive: evaluaciones y aclaraciones post-cuestionario en tablas dedicadas.
-- No elimina ni renombra columnas legacy en project_responses.

CREATE TABLE public.questionnaire_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source_responses_hash text NOT NULL,
  payload jsonb NOT NULL,
  model_used text,
  prompt_version text,
  is_active boolean NOT NULL DEFAULT true,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX questionnaire_evaluations_project_id_idx
  ON public.questionnaire_evaluations (project_id);
CREATE INDEX questionnaire_evaluations_project_active_idx
  ON public.questionnaire_evaluations (project_id)
  WHERE is_active = true AND superseded_at IS NULL;

CREATE TABLE public.questionnaire_clarifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  evaluation_id uuid REFERENCES public.questionnaire_evaluations (id) ON DELETE SET NULL,
  answers jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  generated_master_document_id uuid REFERENCES public.master_documents (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX questionnaire_clarifications_project_id_idx
  ON public.questionnaire_clarifications (project_id);
CREATE INDEX questionnaire_clarifications_eval_submitted_idx
  ON public.questionnaire_clarifications (project_id, evaluation_id, submitted_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionnaire_evaluations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionnaire_clarifications TO authenticated;
GRANT ALL ON public.questionnaire_evaluations TO service_role;
GRANT ALL ON public.questionnaire_clarifications TO service_role;

ALTER TABLE public.questionnaire_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_clarifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questionnaire_evaluations_select_own"
  ON public.questionnaire_evaluations FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "questionnaire_evaluations_insert_own"
  ON public.questionnaire_evaluations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "questionnaire_evaluations_update_own"
  ON public.questionnaire_evaluations FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "questionnaire_evaluations_delete_own"
  ON public.questionnaire_evaluations FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "questionnaire_clarifications_select_own"
  ON public.questionnaire_clarifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "questionnaire_clarifications_insert_own"
  ON public.questionnaire_clarifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "questionnaire_clarifications_update_own"
  ON public.questionnaire_clarifications FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "questionnaire_clarifications_delete_own"
  ON public.questionnaire_clarifications FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );
