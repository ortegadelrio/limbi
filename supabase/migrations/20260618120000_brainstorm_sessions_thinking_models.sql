-- Modelos de pensamiento Brainstormer (trazabilidad por sesión).

ALTER TABLE public.brainstorm_sessions
  ADD COLUMN thinking_model_key text NOT NULL DEFAULT 'limbi',
  ADD COLUMN thinking_model_label text,
  ADD COLUMN thinking_model_version text DEFAULT 'v1',
  ADD COLUMN thinking_model_intensity text,
  ADD COLUMN resolved_primary_model_key text,
  ADD COLUMN resolved_secondary_model_key text,
  ADD COLUMN creative_orientation_summary text;

ALTER TABLE public.brainstorm_sessions
  ADD CONSTRAINT brainstorm_sessions_thinking_model_key_check
    CHECK (
      thinking_model_key IN ('limbi', 'explorer', 'architect', 'empathic', 'symbolic', 'commercial')
    );

ALTER TABLE public.brainstorm_sessions
  ADD CONSTRAINT brainstorm_sessions_resolved_primary_model_key_check
    CHECK (
      resolved_primary_model_key IS NULL
      OR resolved_primary_model_key IN ('limbi', 'explorer', 'architect', 'empathic', 'symbolic', 'commercial')
    );

ALTER TABLE public.brainstorm_sessions
  ADD CONSTRAINT brainstorm_sessions_resolved_secondary_model_key_check
    CHECK (
      resolved_secondary_model_key IS NULL
      OR resolved_secondary_model_key IN ('limbi', 'explorer', 'architect', 'empathic', 'symbolic', 'commercial')
    );

COMMENT ON COLUMN public.brainstorm_sessions.thinking_model_key IS
  'Modelo elegido al crear la sesión (limbi = orquestador automático).';
COMMENT ON COLUMN public.brainstorm_sessions.resolved_primary_model_key IS
  'Modelo canónico principal aplicado en el turno (resuelto por Limbi o fijado por elección directa).';
COMMENT ON COLUMN public.brainstorm_sessions.resolved_secondary_model_key IS
  'Modelo de apoyo cuando Limbi combina dos lentes.';
COMMENT ON COLUMN public.brainstorm_sessions.creative_orientation_summary IS
  'Breve explicación de la orientación creativa cuando Limbi elige automáticamente.';
