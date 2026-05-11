-- Ticket 1: Marca (brands) + perfil de oferta (brand_offer_profiles). RLS, índices, triggers.

CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  brand_status text NOT NULL DEFAULT 'new'
    CHECK (brand_status IN ('new', 'existing', 'in_progress')),
  website_url text,
  country_or_market text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brands_user_id_idx ON public.brands (user_id);
CREATE INDEX brands_user_updated_idx ON public.brands (user_id, updated_at DESC);

CREATE TRIGGER brands_set_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.brand_offer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  offer_nature text NOT NULL
    CHECK (
      offer_nature IN (
        'product',
        'service',
        'product_service',
        'experience_event',
        'digital_platform_app_saas',
        'organization_institution_cause',
        'personal_brand'
      )
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_offer_profiles_one_per_brand UNIQUE (brand_id)
);

CREATE INDEX brand_offer_profiles_brand_id_idx ON public.brand_offer_profiles (brand_id);

CREATE TRIGGER brand_offer_profiles_set_updated_at
  BEFORE UPDATE ON public.brand_offer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_offer_profiles TO authenticated;
GRANT ALL ON public.brands TO service_role;
GRANT ALL ON public.brand_offer_profiles TO service_role;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_offer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_select_own"
  ON public.brands FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "brands_insert_own"
  ON public.brands FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brands_update_own"
  ON public.brands FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brands_delete_own"
  ON public.brands FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "brand_offer_profiles_select_own"
  ON public.brand_offer_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_offer_profiles.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_offer_profiles_insert_own"
  ON public.brand_offer_profiles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_offer_profiles.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_offer_profiles_update_own"
  ON public.brand_offer_profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_offer_profiles.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_offer_profiles.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_offer_profiles_delete_own"
  ON public.brand_offer_profiles FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_offer_profiles.brand_id
        AND b.user_id = auth.uid()
    )
  );
