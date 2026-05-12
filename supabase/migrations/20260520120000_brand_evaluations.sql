-- Ticket 4: Diagnóstico de marca (brand_evaluations). RLS, índices, una fila activa por marca.

CREATE TABLE public.brand_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  evaluation_version integer NOT NULL DEFAULT 1,
  status text NOT NULL
    CHECK (status IN ('running', 'succeeded', 'failed')),
  overall_score integer
    CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)),
  quality_level text
    CHECK (
      quality_level IS NULL
      OR quality_level IN ('critical', 'weak', 'acceptable', 'strong', 'excellent')
    ),
  strategic_reading text,
  diagnosis_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  section_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  critical_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  contradictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvement_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_recommended_action text
    CHECK (
      next_recommended_action IS NULL
      OR next_recommended_action IN (
        'improve_required',
        'improve_recommended',
        'ready_for_consolidation'
      )
    ),
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_used text,
  prompt_version text NOT NULL,
  error_message text,
  is_active boolean NOT NULL DEFAULT false,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brand_evaluations_brand_id_created_at_idx
  ON public.brand_evaluations (brand_id, created_at DESC);

CREATE INDEX brand_evaluations_brand_id_status_idx
  ON public.brand_evaluations (brand_id, status);

CREATE UNIQUE INDEX brand_evaluations_one_active_per_brand_idx
  ON public.brand_evaluations (brand_id)
  WHERE is_active = true;

CREATE TRIGGER brand_evaluations_set_updated_at
  BEFORE UPDATE ON public.brand_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_evaluations TO authenticated;
GRANT ALL ON public.brand_evaluations TO service_role;

ALTER TABLE public.brand_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_evaluations_select_own"
  ON public.brand_evaluations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_evaluations.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_evaluations_insert_own"
  ON public.brand_evaluations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_evaluations.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_evaluations_update_own"
  ON public.brand_evaluations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_evaluations.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_evaluations.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_evaluations_delete_own"
  ON public.brand_evaluations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_evaluations.brand_id
        AND b.user_id = auth.uid()
    )
  );
