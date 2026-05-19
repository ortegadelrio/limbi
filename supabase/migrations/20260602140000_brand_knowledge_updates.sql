-- BRAND-U1: Actualizaciones manuales de conocimiento de marca (revisión → aprobación → consolidación futura).

CREATE TABLE public.brand_knowledge_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  interpreted_summary text,
  source_type text NOT NULL DEFAULT 'manual_addition'
    CHECK (source_type IN (
      'manual_addition',
      'correction',
      'replacement',
      'brainstormer_suggestion',
      'document_finding',
      'other'
    )),
  section_key text,
  importance_level text NOT NULL DEFAULT 'medium'
    CHECK (importance_level IN ('critical', 'high', 'medium', 'low')),
  must_include boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'discarded', 'incorporated')),
  user_decision text,
  reason_for_exclusion text,
  approved_at timestamptz,
  discarded_at timestamptz,
  incorporated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_knowledge_updates_raw_text_nonempty CHECK (length(trim(raw_text)) > 0)
);

CREATE INDEX brand_knowledge_updates_brand_id_idx
  ON public.brand_knowledge_updates (brand_id);

CREATE INDEX brand_knowledge_updates_status_idx
  ON public.brand_knowledge_updates (status);

CREATE INDEX brand_knowledge_updates_created_at_idx
  ON public.brand_knowledge_updates (created_at DESC);

CREATE INDEX brand_knowledge_updates_brand_id_status_idx
  ON public.brand_knowledge_updates (brand_id, status);

CREATE TRIGGER brand_knowledge_updates_set_updated_at
  BEFORE UPDATE ON public.brand_knowledge_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_knowledge_updates TO authenticated;
GRANT ALL ON public.brand_knowledge_updates TO service_role;

ALTER TABLE public.brand_knowledge_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_knowledge_updates_select_own"
  ON public.brand_knowledge_updates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_knowledge_updates.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_knowledge_updates_insert_own"
  ON public.brand_knowledge_updates FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_knowledge_updates.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_knowledge_updates_update_own"
  ON public.brand_knowledge_updates FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_knowledge_updates.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_knowledge_updates.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_knowledge_updates_delete_own"
  ON public.brand_knowledge_updates FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_knowledge_updates.brand_id
        AND b.user_id = auth.uid()
    )
  );
