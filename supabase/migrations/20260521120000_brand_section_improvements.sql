-- Ticket 5: Mejora por sección con experto (sesiones, mensajes, mejoras aprobadas). RLS.

CREATE TABLE public.brand_improvement_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  section_key text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('open', 'draft_ready', 'approved', 'abandoned', 'failed')),
  brand_evaluation_id uuid REFERENCES public.brand_evaluations (id) ON DELETE SET NULL,
  max_user_turns integer NOT NULL DEFAULT 8,
  user_turn_count integer NOT NULL DEFAULT 0,
  draft_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_reason text,
  summary_for_consolidation text,
  model_used text,
  prompt_version text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_improvement_sessions_user_turns_nonneg CHECK (user_turn_count >= 0),
  CONSTRAINT brand_improvement_sessions_max_turns_pos CHECK (max_user_turns > 0)
);

CREATE INDEX brand_improvement_sessions_brand_section_created_idx
  ON public.brand_improvement_sessions (brand_id, section_key, created_at DESC);

CREATE INDEX brand_improvement_sessions_brand_id_idx
  ON public.brand_improvement_sessions (brand_id);

CREATE UNIQUE INDEX brand_improvement_sessions_one_active_work_idx
  ON public.brand_improvement_sessions (brand_id, section_key)
  WHERE status IN ('open', 'draft_ready');

CREATE TRIGGER brand_improvement_sessions_set_updated_at
  BEFORE UPDATE ON public.brand_improvement_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.brand_improvement_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.brand_improvement_sessions (id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  structured_payload jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brand_improvement_messages_session_created_idx
  ON public.brand_improvement_messages (session_id, created_at ASC);

CREATE TABLE public.brand_section_improvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  section_key text NOT NULL,
  session_id uuid REFERENCES public.brand_improvement_sessions (id) ON DELETE SET NULL,
  status text NOT NULL
    CHECK (status IN ('approved', 'superseded')),
  is_active boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brand_section_improvements_brand_section_idx
  ON public.brand_section_improvements (brand_id, section_key, created_at DESC);

CREATE UNIQUE INDEX brand_section_improvements_one_active_per_section_idx
  ON public.brand_section_improvements (brand_id, section_key)
  WHERE is_active = true AND status = 'approved';

CREATE TRIGGER brand_section_improvements_set_updated_at
  BEFORE UPDATE ON public.brand_section_improvements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_improvement_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_improvement_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_section_improvements TO authenticated;
GRANT ALL ON public.brand_improvement_sessions TO service_role;
GRANT ALL ON public.brand_improvement_messages TO service_role;
GRANT ALL ON public.brand_section_improvements TO service_role;

ALTER TABLE public.brand_improvement_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_improvement_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_section_improvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_improvement_sessions_select_own"
  ON public.brand_improvement_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_improvement_sessions.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_improvement_sessions_insert_own"
  ON public.brand_improvement_sessions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_improvement_sessions.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_improvement_sessions_update_own"
  ON public.brand_improvement_sessions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_improvement_sessions.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_improvement_sessions.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_improvement_sessions_delete_own"
  ON public.brand_improvement_sessions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_improvement_sessions.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_improvement_messages_select_own"
  ON public.brand_improvement_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_improvement_sessions s
      JOIN public.brands b ON b.id = s.brand_id
      WHERE s.id = brand_improvement_messages.session_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_improvement_messages_insert_own"
  ON public.brand_improvement_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brand_improvement_sessions s
      JOIN public.brands b ON b.id = s.brand_id
      WHERE s.id = brand_improvement_messages.session_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_improvement_messages_update_own"
  ON public.brand_improvement_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_improvement_sessions s
      JOIN public.brands b ON b.id = s.brand_id
      WHERE s.id = brand_improvement_messages.session_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brand_improvement_sessions s
      JOIN public.brands b ON b.id = s.brand_id
      WHERE s.id = brand_improvement_messages.session_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_improvement_messages_delete_own"
  ON public.brand_improvement_messages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_improvement_sessions s
      JOIN public.brands b ON b.id = s.brand_id
      WHERE s.id = brand_improvement_messages.session_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_section_improvements_select_own"
  ON public.brand_section_improvements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_section_improvements.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_section_improvements_insert_own"
  ON public.brand_section_improvements FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_section_improvements.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_section_improvements_update_own"
  ON public.brand_section_improvements FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_section_improvements.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_section_improvements.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_section_improvements_delete_own"
  ON public.brand_section_improvements FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_section_improvements.brand_id
        AND b.user_id = auth.uid()
    )
  );
