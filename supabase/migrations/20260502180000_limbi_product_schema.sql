-- Limbi V1 — esquema de producto + RLS
-- No ejecutar hasta revisión; aplicar desde SQL Editor o Supabase CLI.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- updated_at ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- projects ----------
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name_or_descriptor text NOT NULL,
  name_status text NOT NULL DEFAULT 'provisional'
    CHECK (name_status IN ('definitive', 'provisional', 'unnamed')),
  challenge_type text,
  main_challenge text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'responses_completed',
        'master_created',
        'framework_created',
        'framework_approved'
      )
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_user_id_idx ON public.projects (user_id);
CREATE INDEX projects_user_status_idx ON public.projects (user_id, status);

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------- project_responses (una fila por proyecto) ----------
CREATE TABLE public.project_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_steps text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_responses_one_per_project UNIQUE (project_id)
);

CREATE INDEX project_responses_user_id_idx ON public.project_responses (user_id);

CREATE TRIGGER project_responses_set_updated_at
  BEFORE UPDATE ON public.project_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------- master_documents ----------
CREATE TABLE public.master_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  document jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX master_documents_project_id_idx ON public.master_documents (project_id);
CREATE INDEX master_documents_user_id_idx ON public.master_documents (user_id);

CREATE TRIGGER master_documents_set_updated_at
  BEFORE UPDATE ON public.master_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------- visible_frameworks ----------
CREATE TABLE public.visible_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  master_document_id uuid REFERENCES public.master_documents (id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  framework jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX visible_frameworks_project_id_idx ON public.visible_frameworks (project_id);
CREATE INDEX visible_frameworks_user_id_idx ON public.visible_frameworks (user_id);

CREATE TRIGGER visible_frameworks_set_updated_at
  BEFORE UPDATE ON public.visible_frameworks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------- generated_contents ----------
CREATE TABLE public.generated_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  master_document_id uuid REFERENCES public.master_documents (id) ON DELETE SET NULL,
  visible_framework_id uuid REFERENCES public.visible_frameworks (id) ON DELETE SET NULL,
  content_type text NOT NULL
    CHECK (
      content_type IN (
        'short_pitch',
        'captions',
        'content_ideas',
        'graphic_phrases'
      )
    ),
  request jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'generated'
    CHECK (
      status IN (
        'generated',
        'favorited',
        'rejected',
        'edited',
        'archived'
      )
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX generated_contents_project_id_idx ON public.generated_contents (project_id);
CREATE INDEX generated_contents_user_id_idx ON public.generated_contents (user_id);

CREATE TRIGGER generated_contents_set_updated_at
  BEFORE UPDATE ON public.generated_contents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------- project_events (append-only) ----------
CREATE TABLE public.project_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_events_project_id_idx ON public.project_events (project_id);
CREATE INDEX project_events_user_id_idx ON public.project_events (user_id);

-- ---------- grants (sesión JWT = rol authenticated) ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visible_frameworks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_contents TO authenticated;
GRANT SELECT, INSERT ON public.project_events TO authenticated;

GRANT ALL ON public.projects TO service_role;
GRANT ALL ON public.project_responses TO service_role;
GRANT ALL ON public.master_documents TO service_role;
GRANT ALL ON public.visible_frameworks TO service_role;
GRANT ALL ON public.generated_contents TO service_role;
GRANT ALL ON public.project_events TO service_role;

-- ---------- RLS ----------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visible_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_events ENABLE ROW LEVEL SECURITY;

-- projects
CREATE POLICY "projects_select_own"
  ON public.projects FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "projects_insert_own"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_update_own"
  ON public.projects FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_delete_own"
  ON public.projects FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- project_responses
CREATE POLICY "project_responses_select_own"
  ON public.project_responses FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "project_responses_insert_own"
  ON public.project_responses FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "project_responses_update_own"
  ON public.project_responses FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "project_responses_delete_own"
  ON public.project_responses FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- master_documents
CREATE POLICY "master_documents_select_own"
  ON public.master_documents FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "master_documents_insert_own"
  ON public.master_documents FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "master_documents_update_own"
  ON public.master_documents FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "master_documents_delete_own"
  ON public.master_documents FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- visible_frameworks
CREATE POLICY "visible_frameworks_select_own"
  ON public.visible_frameworks FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "visible_frameworks_insert_own"
  ON public.visible_frameworks FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "visible_frameworks_update_own"
  ON public.visible_frameworks FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "visible_frameworks_delete_own"
  ON public.visible_frameworks FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- generated_contents
CREATE POLICY "generated_contents_select_own"
  ON public.generated_contents FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "generated_contents_insert_own"
  ON public.generated_contents FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "generated_contents_update_own"
  ON public.generated_contents FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "generated_contents_delete_own"
  ON public.generated_contents FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- project_events: append-only (solo SELECT + INSERT)
CREATE POLICY "project_events_select_own"
  ON public.project_events FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "project_events_insert_own"
  ON public.project_events FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );
