-- Ticket 3B.2: extracción técnica de texto PDF (sin IA, sin brand_source_facts).

CREATE TABLE public.brand_document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_document_id uuid NOT NULL REFERENCES public.brand_documents (id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  extraction_status text NOT NULL
    CHECK (
      extraction_status IN (
        'pending',
        'running',
        'succeeded',
        'succeeded_empty',
        'failed'
      )
    ),
  extracted_text text,
  page_count integer,
  character_count integer,
  extraction_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_document_extractions_brand_document_id_key UNIQUE (brand_document_id)
);

CREATE INDEX brand_document_extractions_brand_id_idx
  ON public.brand_document_extractions (brand_id);

CREATE INDEX brand_document_extractions_document_id_idx
  ON public.brand_document_extractions (brand_document_id);

CREATE TRIGGER brand_document_extractions_set_updated_at
  BEFORE UPDATE ON public.brand_document_extractions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_document_extractions TO authenticated;
GRANT ALL ON public.brand_document_extractions TO service_role;

ALTER TABLE public.brand_document_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_document_extractions_select_own"
  ON public.brand_document_extractions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_extractions.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_document_extractions_insert_own"
  ON public.brand_document_extractions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_extractions.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_document_extractions_update_own"
  ON public.brand_document_extractions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_extractions.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_extractions.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_document_extractions_delete_own"
  ON public.brand_document_extractions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_document_extractions.brand_id
        AND b.user_id = auth.uid()
    )
  );
