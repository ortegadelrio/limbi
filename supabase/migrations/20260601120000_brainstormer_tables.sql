-- BRAIN-1: Brainstormer — sesiones, mensajes, snapshots y bases preliminares.
-- RLS por user_id; sin motor conversacional ni UI en esta migración.

-- ---------- brainstorm_sessions ----------
CREATE TABLE public.brainstorm_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  source_brand_knowledge_base_id uuid REFERENCES public.brand_knowledge_bases (id) ON DELETE SET NULL,
  source_brand_limbic_base_id uuid REFERENCES public.brand_limbic_bases (id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'paused', 'closed', 'converted_to_project_base')),
  summary text,
  recommended_route text,
  maturity_level text
    CHECK (maturity_level IS NULL OR maturity_level IN ('low', 'medium', 'high')),
  suggested_project_type jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_brand_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  converted_at timestamptz,
  CONSTRAINT brainstorm_sessions_title_nonempty CHECK (length(btrim(title)) > 0)
);

CREATE INDEX brainstorm_sessions_user_id_updated_at_idx
  ON public.brainstorm_sessions (user_id, updated_at DESC);

CREATE INDEX brainstorm_sessions_brand_id_status_idx
  ON public.brainstorm_sessions (brand_id, status);

CREATE INDEX brainstorm_sessions_user_id_status_idx
  ON public.brainstorm_sessions (user_id, status);

CREATE TRIGGER brainstorm_sessions_set_updated_at
  BEFORE UPDATE ON public.brainstorm_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------- brainstorm_messages ----------
CREATE TABLE public.brainstorm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.brainstorm_sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  structured_extraction jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brainstorm_messages_session_id_created_at_idx
  ON public.brainstorm_messages (session_id, created_at ASC);

CREATE INDEX brainstorm_messages_user_id_idx
  ON public.brainstorm_messages (user_id);

-- ---------- brainstorm_session_snapshots ----------
CREATE TABLE public.brainstorm_session_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.brainstorm_sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  snapshot_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_kind text NOT NULL DEFAULT 'live_map'
    CHECK (snapshot_kind IN ('live_map', 'strategic_summary', 'conversion_candidate')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brainstorm_session_snapshots_session_id_created_at_idx
  ON public.brainstorm_session_snapshots (session_id, created_at ASC);

CREATE INDEX brainstorm_session_snapshots_user_id_idx
  ON public.brainstorm_session_snapshots (user_id);

-- ---------- brainstorm_project_bases ----------
CREATE TABLE public.brainstorm_project_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.brainstorm_sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  source_brand_knowledge_base_id uuid REFERENCES public.brand_knowledge_bases (id) ON DELETE SET NULL,
  source_brand_limbic_base_id uuid REFERENCES public.brand_limbic_bases (id) ON DELETE SET NULL,
  common_base jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested_project_type jsonb NOT NULL DEFAULT '{}'::jsonb,
  specific_module jsonb NOT NULL DEFAULT '{}'::jsonb,
  pending_information jsonb NOT NULL DEFAULT '[]'::jsonb,
  conversion_readiness jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent_to_project', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brainstorm_project_bases_session_id_idx
  ON public.brainstorm_project_bases (session_id);

CREATE INDEX brainstorm_project_bases_brand_id_status_idx
  ON public.brainstorm_project_bases (brand_id, status);

CREATE INDEX brainstorm_project_bases_user_id_updated_at_idx
  ON public.brainstorm_project_bases (user_id, updated_at DESC);

CREATE TRIGGER brainstorm_project_bases_set_updated_at
  BEFORE UPDATE ON public.brainstorm_project_bases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------- grants ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brainstorm_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brainstorm_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brainstorm_session_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brainstorm_project_bases TO authenticated;

GRANT ALL ON public.brainstorm_sessions TO service_role;
GRANT ALL ON public.brainstorm_messages TO service_role;
GRANT ALL ON public.brainstorm_session_snapshots TO service_role;
GRANT ALL ON public.brainstorm_project_bases TO service_role;

-- ---------- RLS ----------
ALTER TABLE public.brainstorm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainstorm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainstorm_session_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainstorm_project_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brainstorm_sessions_select_own"
  ON public.brainstorm_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "brainstorm_sessions_insert_own"
  ON public.brainstorm_sessions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brainstorm_sessions.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brainstorm_sessions_update_own"
  ON public.brainstorm_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brainstorm_sessions_delete_own"
  ON public.brainstorm_sessions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "brainstorm_messages_select_own_session"
  ON public.brainstorm_messages FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brainstorm_sessions s
      WHERE s.id = brainstorm_messages.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "brainstorm_messages_insert_own_session"
  ON public.brainstorm_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brainstorm_sessions s
      WHERE s.id = brainstorm_messages.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "brainstorm_messages_update_own_session"
  ON public.brainstorm_messages FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brainstorm_sessions s
      WHERE s.id = brainstorm_messages.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brainstorm_sessions s
      WHERE s.id = brainstorm_messages.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "brainstorm_messages_delete_own_session"
  ON public.brainstorm_messages FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brainstorm_sessions s
      WHERE s.id = brainstorm_messages.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "brainstorm_session_snapshots_select_own"
  ON public.brainstorm_session_snapshots FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brainstorm_sessions s
      WHERE s.id = brainstorm_session_snapshots.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "brainstorm_session_snapshots_insert_own"
  ON public.brainstorm_session_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brainstorm_sessions s
      WHERE s.id = brainstorm_session_snapshots.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "brainstorm_session_snapshots_update_own"
  ON public.brainstorm_session_snapshots FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brainstorm_sessions s
      WHERE s.id = brainstorm_session_snapshots.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brainstorm_sessions s
      WHERE s.id = brainstorm_session_snapshots.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "brainstorm_session_snapshots_delete_own"
  ON public.brainstorm_session_snapshots FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brainstorm_sessions s
      WHERE s.id = brainstorm_session_snapshots.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "brainstorm_project_bases_select_own"
  ON public.brainstorm_project_bases FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "brainstorm_project_bases_insert_own"
  ON public.brainstorm_project_bases FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.brainstorm_sessions s
      WHERE s.id = brainstorm_project_bases.session_id
        AND s.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brainstorm_project_bases.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brainstorm_project_bases_update_own"
  ON public.brainstorm_project_bases FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brainstorm_project_bases_delete_own"
  ON public.brainstorm_project_bases FOR DELETE TO authenticated
  USING (user_id = auth.uid());
