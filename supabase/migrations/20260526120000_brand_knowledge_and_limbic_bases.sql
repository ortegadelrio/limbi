-- Ticket H: Bases curadas de marca (conocimiento + límbica). RLS, una fila activa por marca en cada tabla.

CREATE TABLE public.brand_knowledge_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  consolidation_run_id uuid NOT NULL,
  status text NOT NULL
    CHECK (status IN ('running', 'succeeded', 'failed')),
  consolidated_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_version text NOT NULL,
  model_used text,
  error_message text,
  is_active boolean NOT NULL DEFAULT false,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_limbic_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  consolidation_run_id uuid NOT NULL,
  status text NOT NULL
    CHECK (status IN ('running', 'succeeded', 'failed')),
  consolidated_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_version text NOT NULL,
  model_used text,
  error_message text,
  is_active boolean NOT NULL DEFAULT false,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brand_knowledge_bases_brand_id_created_at_idx
  ON public.brand_knowledge_bases (brand_id, created_at DESC);

CREATE INDEX brand_knowledge_bases_brand_id_status_idx
  ON public.brand_knowledge_bases (brand_id, status);

CREATE UNIQUE INDEX brand_knowledge_bases_one_active_per_brand_idx
  ON public.brand_knowledge_bases (brand_id)
  WHERE is_active = true;

CREATE INDEX brand_limbic_bases_brand_id_created_at_idx
  ON public.brand_limbic_bases (brand_id, created_at DESC);

CREATE INDEX brand_limbic_bases_brand_id_status_idx
  ON public.brand_limbic_bases (brand_id, status);

CREATE UNIQUE INDEX brand_limbic_bases_one_active_per_brand_idx
  ON public.brand_limbic_bases (brand_id)
  WHERE is_active = true;

CREATE TRIGGER brand_knowledge_bases_set_updated_at
  BEFORE UPDATE ON public.brand_knowledge_bases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER brand_limbic_bases_set_updated_at
  BEFORE UPDATE ON public.brand_limbic_bases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_knowledge_bases TO authenticated;
GRANT ALL ON public.brand_knowledge_bases TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_limbic_bases TO authenticated;
GRANT ALL ON public.brand_limbic_bases TO service_role;

ALTER TABLE public.brand_knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_limbic_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_knowledge_bases_select_own"
  ON public.brand_knowledge_bases FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_knowledge_bases.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_knowledge_bases_insert_own"
  ON public.brand_knowledge_bases FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_knowledge_bases.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_knowledge_bases_update_own"
  ON public.brand_knowledge_bases FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_knowledge_bases.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_knowledge_bases.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_knowledge_bases_delete_own"
  ON public.brand_knowledge_bases FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_knowledge_bases.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_limbic_bases_select_own"
  ON public.brand_limbic_bases FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_limbic_bases.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_limbic_bases_insert_own"
  ON public.brand_limbic_bases FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_limbic_bases.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_limbic_bases_update_own"
  ON public.brand_limbic_bases FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_limbic_bases.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_limbic_bases.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_limbic_bases_delete_own"
  ON public.brand_limbic_bases FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_limbic_bases.brand_id
        AND b.user_id = auth.uid()
    )
  );
