-- Ticket H.2: web-explore sube texto como .txt (text/plain); subidas DOCX requieren MIME Office.
-- Ampliar allowed_mime_types del bucket brand-documents (sin quitar PDF ni octet-stream ya usados por clientes).

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/x-pdf',
    'application/octet-stream',
    'binary/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]::text[]
WHERE id = 'brand-documents';
