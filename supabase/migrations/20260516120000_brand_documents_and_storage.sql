-- Ticket 3B.1: Documentos de marca (metadata + bucket privado). Sin IA ni brand_source_facts.

-- --- Tabla brand_documents ---
CREATE TABLE public.brand_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  document_type text NOT NULL
    CHECK (
      document_type IN (
        'manual',
        'brief',
        'deck',
        'portfolio',
        'study',
        'strategy',
        'institutional',
        'success_case',
        'other'
      )
    ),
  storage_path text NOT NULL,
  file_size_bytes bigint,
  processing_status text NOT NULL DEFAULT 'pending'
    CHECK (
      processing_status IN (
        'pending',
        'uploaded',
        'processing',
        'ready',
        'failed'
      )
    ),
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_documents_storage_path_key UNIQUE (storage_path)
);

CREATE INDEX brand_documents_brand_id_idx ON public.brand_documents (brand_id);
CREATE INDEX brand_documents_brand_created_idx ON public.brand_documents (brand_id, created_at DESC);

CREATE TRIGGER brand_documents_set_updated_at
  BEFORE UPDATE ON public.brand_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_documents TO authenticated;
GRANT ALL ON public.brand_documents TO service_role;

ALTER TABLE public.brand_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_documents_select_own"
  ON public.brand_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_documents.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_documents_insert_own"
  ON public.brand_documents FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_documents.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_documents_update_own"
  ON public.brand_documents FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_documents.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_documents.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_documents_delete_own"
  ON public.brand_documents FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_documents.brand_id
        AND b.user_id = auth.uid()
    )
  );

-- --- Bucket privado (Supabase Storage) ---
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-documents',
  'brand-documents',
  false,
  26214400,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas: ruta {user_id}/{brand_id}/{document_id}.pdf — primer segmento = auth.uid()
DROP POLICY IF EXISTS "brand_documents_storage_select_own" ON storage.objects;
DROP POLICY IF EXISTS "brand_documents_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "brand_documents_storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "brand_documents_storage_delete_own" ON storage.objects;

CREATE POLICY "brand_documents_storage_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'brand-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "brand_documents_storage_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "brand_documents_storage_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'brand-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "brand_documents_storage_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'brand-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
