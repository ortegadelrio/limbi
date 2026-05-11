-- Ampliar MIME permitidos en el bucket (navegadores suelen enviar octet-stream / x-pdf).
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/x-pdf',
    'application/octet-stream',
    'binary/octet-stream'
  ]::text[]
WHERE id = 'brand-documents';
