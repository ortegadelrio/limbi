-- Ticket 3: Respuestas del cuestionario de marca (una fila por marca + question_key).

CREATE TABLE public.brand_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  question_definition_id uuid NOT NULL REFERENCES public.question_definitions (id) ON DELETE RESTRICT,
  section_key text NOT NULL,
  module_key text NOT NULL,
  question_key text NOT NULL,
  answer_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  answer_text text,
  answer_type text NOT NULL
    CHECK (
      answer_type IN (
        'text',
        'textarea',
        'single_choice',
        'multi_choice',
        'scale',
        'url',
        'number',
        'boolean'
      )
    ),
  is_required boolean NOT NULL,
  is_sensitive boolean NOT NULL DEFAULT false,
  source_type text NOT NULL DEFAULT 'questionnaire'
    CHECK (source_type IN ('questionnaire')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_responses_brand_question_key UNIQUE (brand_id, question_key)
);

CREATE INDEX brand_responses_brand_id_idx ON public.brand_responses (brand_id);
CREATE INDEX brand_responses_brand_section_idx ON public.brand_responses (brand_id, section_key);

CREATE TRIGGER brand_responses_set_updated_at
  BEFORE UPDATE ON public.brand_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_responses TO authenticated;
GRANT ALL ON public.brand_responses TO service_role;

ALTER TABLE public.brand_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_responses_select_own"
  ON public.brand_responses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_responses.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_responses_insert_own"
  ON public.brand_responses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_responses.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_responses_update_own"
  ON public.brand_responses FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_responses.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_responses.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_responses_delete_own"
  ON public.brand_responses FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_responses.brand_id
        AND b.user_id = auth.uid()
    )
  );
