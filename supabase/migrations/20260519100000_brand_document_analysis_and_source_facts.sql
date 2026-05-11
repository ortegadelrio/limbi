-- Ticket 3B.3: análisis IA de documentos de marca, batches/runs y hallazgos (brand_source_facts).

CREATE TABLE public.brand_document_analysis_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  status text NOT NULL
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  documents_count integer NOT NULL DEFAULT 0,
  analyzed_documents_count integer NOT NULL DEFAULT 0,
  skipped_documents_count integer NOT NULL DEFAULT 0,
  findings_count integer NOT NULL DEFAULT 0,
  useful_sections_count integer NOT NULL DEFAULT 0,
  model_used text,
  prompt_version text NOT NULL,
  input_hash text,
  analysis_summary text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brand_document_analysis_batches_brand_id_created_at_idx
  ON public.brand_document_analysis_batches (brand_id, created_at DESC);

CREATE TRIGGER brand_document_analysis_batches_set_updated_at
  BEFORE UPDATE ON public.brand_document_analysis_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.brand_document_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.brand_document_analysis_batches (id) ON DELETE CASCADE,
  brand_document_id uuid NOT NULL REFERENCES public.brand_documents (id) ON DELETE CASCADE,
  brand_document_extraction_id uuid NOT NULL REFERENCES public.brand_document_extractions (id) ON DELETE CASCADE,
  status text NOT NULL
    CHECK (status IN ('pending', 'running', 'succeeded', 'skipped', 'failed')),
  model_used text,
  prompt_version text NOT NULL,
  input_hash text,
  findings_count integer NOT NULL DEFAULT 0,
  useful_sections_count integer NOT NULL DEFAULT 0,
  analysis_summary text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_document_analysis_runs_batch_document_key UNIQUE (batch_id, brand_document_id)
);

CREATE INDEX brand_document_analysis_runs_batch_id_idx
  ON public.brand_document_analysis_runs (batch_id);

CREATE INDEX brand_document_analysis_runs_brand_document_id_idx
  ON public.brand_document_analysis_runs (brand_document_id);

CREATE INDEX brand_document_analysis_runs_brand_id_created_at_idx
  ON public.brand_document_analysis_runs (brand_id, created_at DESC);

CREATE TRIGGER brand_document_analysis_runs_set_updated_at
  BEFORE UPDATE ON public.brand_document_analysis_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.brand_source_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'document'
    CHECK (source_type IN ('document', 'manual', 'system')),
  brand_document_id uuid REFERENCES public.brand_documents (id) ON DELETE SET NULL,
  brand_document_extraction_id uuid REFERENCES public.brand_document_extractions (id) ON DELETE SET NULL,
  analysis_batch_id uuid REFERENCES public.brand_document_analysis_batches (id) ON DELETE SET NULL,
  analysis_run_id uuid REFERENCES public.brand_document_analysis_runs (id) ON DELETE SET NULL,
  section_key text NOT NULL,
  module_key text,
  question_key text,
  relationship_type text NOT NULL
    CHECK (relationship_type IN ('new', 'complements', 'reinforces', 'contradicts')),
  fact_type text NOT NULL
    CHECK (
      fact_type IN (
        'identity',
        'audience',
        'value_proposition',
        'differentiator',
        'evidence',
        'tone',
        'restriction',
        'limbic_signal',
        'offer_detail',
        'positioning',
        'purpose',
        'approved_message',
        'other'
      )
    ),
  source_excerpt text,
  source_reference text,
  source_document_name text,
  supporting_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted_fact text NOT NULL,
  ai_interpretation text,
  existing_response_summary text,
  proposed_inclusion text NOT NULL,
  user_edited_text text,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'superseded')),
  rejection_reason text,
  confidence_score integer CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)),
  dedupe_fingerprint text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT brand_source_facts_proposed_inclusion_nonempty CHECK (length(trim(proposed_inclusion)) > 0),
  CONSTRAINT brand_source_facts_extracted_fact_nonempty CHECK (length(trim(extracted_fact)) > 0)
);

CREATE INDEX brand_source_facts_brand_id_status_idx
  ON public.brand_source_facts (brand_id, status);

CREATE INDEX brand_source_facts_brand_id_section_key_idx
  ON public.brand_source_facts (brand_id, section_key);

CREATE INDEX brand_source_facts_analysis_batch_id_idx
  ON public.brand_source_facts (analysis_batch_id);

CREATE INDEX brand_source_facts_brand_document_id_idx
  ON public.brand_source_facts (brand_document_id);

CREATE INDEX brand_source_facts_dedupe_fingerprint_idx
  ON public.brand_source_facts (brand_id, dedupe_fingerprint);

CREATE TRIGGER brand_source_facts_set_updated_at
  BEFORE UPDATE ON public.brand_source_facts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_document_analysis_batches TO authenticated;
GRANT ALL ON public.brand_document_analysis_batches TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_document_analysis_runs TO authenticated;
GRANT ALL ON public.brand_document_analysis_runs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_source_facts TO authenticated;
GRANT ALL ON public.brand_source_facts TO service_role;

ALTER TABLE public.brand_document_analysis_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_document_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_source_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_document_analysis_batches_select_own"
  ON public.brand_document_analysis_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_analysis_batches.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_document_analysis_batches_insert_own"
  ON public.brand_document_analysis_batches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_analysis_batches.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_document_analysis_batches_update_own"
  ON public.brand_document_analysis_batches FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_analysis_batches.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_analysis_batches.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_document_analysis_batches_delete_own"
  ON public.brand_document_analysis_batches FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_analysis_batches.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_document_analysis_runs_select_own"
  ON public.brand_document_analysis_runs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_analysis_runs.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_document_analysis_runs_insert_own"
  ON public.brand_document_analysis_runs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_analysis_runs.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_document_analysis_runs_update_own"
  ON public.brand_document_analysis_runs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_analysis_runs.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_analysis_runs.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_document_analysis_runs_delete_own"
  ON public.brand_document_analysis_runs FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_analysis_runs.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_source_facts_select_own"
  ON public.brand_source_facts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_source_facts.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_source_facts_insert_own"
  ON public.brand_source_facts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_source_facts.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_source_facts_update_own"
  ON public.brand_source_facts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_source_facts.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_source_facts.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_source_facts_delete_own"
  ON public.brand_source_facts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_source_facts.brand_id
        AND b.user_id = auth.uid()
    )
  );
