-- Ticket A: estructura para nuevo Journey de Marca.
-- Solo agrega inventario estructurado de oferta y territorios de audiencia.
-- No modifica question_definitions, UI, análisis documental, diagnóstico ni mejoras por sección.

CREATE TABLE public.brand_offer_items (
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
  item_type text NOT NULL
    CHECK (
      item_type IN (
        'service',
        'solution',
        'product',
        'feature',
        'offer',
        'module',
        'function',
        'use_case',
        'moment',
        'component',
        'program',
        'line_of_action',
        'theme',
        'format',
        'other'
      )
    ),
  title text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_offer_items_title_nonempty CHECK (length(trim(title)) > 0),
  CONSTRAINT brand_offer_items_title_max_len CHECK (char_length(title) <= 200),
  CONSTRAINT brand_offer_items_description_max_len CHECK (
    description IS NULL OR char_length(description) <= 3000
  ),
  CONSTRAINT brand_offer_items_display_order_nonnegative CHECK (display_order >= 0)
);

CREATE INDEX brand_offer_items_brand_order_idx
  ON public.brand_offer_items (brand_id, display_order, created_at);

CREATE TRIGGER brand_offer_items_set_updated_at
  BEFORE UPDATE ON public.brand_offer_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_offer_items TO authenticated;
GRANT ALL ON public.brand_offer_items TO service_role;

ALTER TABLE public.brand_offer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_offer_items_select_own"
  ON public.brand_offer_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_offer_items.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_offer_items_insert_own"
  ON public.brand_offer_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_offer_items.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_offer_items_update_own"
  ON public.brand_offer_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_offer_items.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_offer_items.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_offer_items_delete_own"
  ON public.brand_offer_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_offer_items.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE TABLE public.brand_audience_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  territory_type text NOT NULL
    CHECK (
      territory_type IN (
        'city',
        'state_department',
        'region',
        'country',
        'continent',
        'cultural_community',
        'global_market'
      )
    ),
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_audience_territories_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT brand_audience_territories_name_max_len CHECK (char_length(name) <= 200),
  CONSTRAINT brand_audience_territories_display_order_nonnegative CHECK (display_order >= 0)
);

CREATE INDEX brand_audience_territories_brand_order_idx
  ON public.brand_audience_territories (brand_id, display_order, created_at);

CREATE TRIGGER brand_audience_territories_set_updated_at
  BEFORE UPDATE ON public.brand_audience_territories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_audience_territories TO authenticated;
GRANT ALL ON public.brand_audience_territories TO service_role;

ALTER TABLE public.brand_audience_territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_audience_territories_select_own"
  ON public.brand_audience_territories FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_audience_territories.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_audience_territories_insert_own"
  ON public.brand_audience_territories FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_audience_territories.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_audience_territories_update_own"
  ON public.brand_audience_territories FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_audience_territories.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_audience_territories.brand_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_audience_territories_delete_own"
  ON public.brand_audience_territories FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_audience_territories.brand_id
        AND b.user_id = auth.uid()
    )
  );
