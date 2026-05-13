-- Ticket H.2.1: diagnóstico interno de website_crawl (sin exponer en UI).

ALTER TABLE public.brand_documents
  ADD COLUMN IF NOT EXISTS source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.brand_documents.source_metadata IS 'Metadatos internos (p. ej. resumen técnico de exploración web); no es copy de usuario.';
