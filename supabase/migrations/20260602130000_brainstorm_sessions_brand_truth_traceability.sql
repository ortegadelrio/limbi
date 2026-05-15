-- Trazabilidad explícita de fuente de verdad de marca para sesiones Brainstormer.
-- La IA consume `consolidated_payload` de las bases activas; estos campos auditan qué filas se usaron y el estado del contexto al iniciar.

ALTER TABLE public.brainstorm_sessions
  ADD COLUMN brand_knowledge_base_id_used uuid REFERENCES public.brand_knowledge_bases (id) ON DELETE SET NULL,
  ADD COLUMN brand_limbic_base_id_used uuid REFERENCES public.brand_limbic_bases (id) ON DELETE SET NULL,
  ADD COLUMN brand_context_generated_at timestamptz,
  ADD COLUMN brand_context_status text NOT NULL DEFAULT 'blocked'
    CHECK (brand_context_status IN ('ready', 'advisory', 'blocked')),
  ADD COLUMN brand_context_blocking_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN brand_context_has_pending_updates boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.brainstorm_sessions.brand_knowledge_base_id_used IS
  'ID de brand_knowledge_bases activa usada como fuente profunda al iniciar la sesión (no el resumen de UI).';
COMMENT ON COLUMN public.brainstorm_sessions.brand_limbic_base_id_used IS
  'ID de brand_limbic_bases activa usada como fuente profunda al iniciar la sesión.';
COMMENT ON COLUMN public.brainstorm_sessions.brand_context_generated_at IS
  'Momento en que se fijó el contexto de marca para la sesión (típicamente al crear la sesión).';
COMMENT ON COLUMN public.brainstorm_sessions.brand_context_status IS
  'ready = bases activas y sin bloqueos duros; advisory = se permite iniciar con advertencias; blocked = no hay contexto IA suficiente sin consolidar/actualizar antes.';
COMMENT ON COLUMN public.brainstorm_sessions.brand_context_blocking_reasons IS
  'Lista JSON de códigos alineados a loadActiveBrandContextForProject (p. ej. diagnosis_stale, no_active_knowledge_base).';
COMMENT ON COLUMN public.brainstorm_sessions.brand_context_has_pending_updates IS
  'True si había staleness, hallazgos pendientes u otros avisos de desalineación respecto a la base activa al iniciar.';

UPDATE public.brainstorm_sessions
SET
  brand_knowledge_base_id_used = source_brand_knowledge_base_id,
  brand_limbic_base_id_used = source_brand_limbic_base_id,
  brand_context_generated_at = created_at,
  brand_context_status = CASE
    WHEN source_brand_knowledge_base_id IS NOT NULL
      AND source_brand_limbic_base_id IS NOT NULL
    THEN 'ready'::text
    ELSE 'blocked'::text
  END,
  brand_context_blocking_reasons = '[]'::jsonb,
  brand_context_has_pending_updates = false;

CREATE INDEX brainstorm_sessions_brand_context_status_idx
  ON public.brainstorm_sessions (brand_context_status);
