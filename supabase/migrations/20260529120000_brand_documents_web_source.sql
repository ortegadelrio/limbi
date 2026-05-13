-- Ticket H.2: distinguir subida de archivo vs exploración web controlada (sin tocar proyectos).

ALTER TABLE public.brand_documents
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'file_upload'
  CHECK (source_kind IN ('file_upload', 'website_crawl'));

ALTER TABLE public.brand_documents
  ADD COLUMN IF NOT EXISTS web_entry_url text;

COMMENT ON COLUMN public.brand_documents.source_kind IS 'file_upload: usuario sube binario; website_crawl: texto agregado desde URL pública revisable.';
COMMENT ON COLUMN public.brand_documents.web_entry_url IS 'URL de entrada cuando source_kind = website_crawl; null en subidas normales.';
