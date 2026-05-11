-- Ticket 2: Catálogo `question_definitions` (journey de marca). Lectura para usuarios autenticados; datos semilla del cuestionario (sin UI).

CREATE TABLE public.question_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_type text NOT NULL
    CHECK (journey_type IN ('brand')),
  section_key text NOT NULL,
  module_key text NOT NULL,
  question_key text NOT NULL,
  question_text text NOT NULL,
  help_text text,
  answer_type text NOT NULL
    CHECK (answer_type IN ('textarea', 'text', 'single_choice', 'url')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  applies_to jsonb,
  is_required boolean NOT NULL,
  is_sensitive boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  evaluation_weight integer NOT NULL,
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_definitions_journey_question_key UNIQUE (journey_type, question_key)
);

CREATE INDEX question_definitions_journey_active_order_idx
  ON public.question_definitions (journey_type, is_active, display_order);

CREATE TRIGGER question_definitions_set_updated_at
  BEFORE UPDATE ON public.question_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.question_definitions TO authenticated;
GRANT ALL ON public.question_definitions TO service_role;

ALTER TABLE public.question_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "question_definitions_select_authenticated"
  ON public.question_definitions FOR SELECT TO authenticated
  USING (true);

-- question_definitions seed (90 rows)
INSERT INTO public.question_definitions (
  journey_type, section_key, module_key, question_key, question_text, help_text,
  answer_type, options, applies_to, is_required, is_sensitive, evaluation_weight, display_order, is_active
) VALUES
('brand', 'identity', 'core', 'who_is_this_brand', 'Si tuvieran que presentar esta marca en una frase honesta, ¿qué dirían que es y qué no es?', 'No busquen la frase perfecta de agencia: piensen en cómo la explicarían a alguien que no conoce el sector.', 'textarea', '[]'::jsonb, NULL, true, false, 5, 10, true),
('brand', 'identity', 'core', 'brand_names_or_symbols', '¿Cómo se llama hoy la marca y hay nombres, siglas o símbolos que debamos respetar al escribir?', 'Incluyan cómo NO quieren que aparezca escrito, si aplica.', 'text', '[]'::jsonb, NULL, true, false, 3, 20, true),
('brand', 'description', 'core', 'what_you_do_plain', 'En lenguaje cotidiano: ¿qué hacen, para quién y en qué momento de su vida aparecen?', 'Eviten buzzwords. Si alguien lo lee en voz alta, ¿suena a persona o a folleto?', 'textarea', '[]'::jsonb, NULL, true, false, 5, 30, true),
('brand', 'purpose', 'core', 'why_exist', 'Más allá de vender: ¿por qué existe esta marca hoy? ¿Qué cambio pequeño o grande quiere aportar?', 'Puede ser ambicioso, pero que sea creíble con lo que ya hacen.', 'textarea', '[]'::jsonb, NULL, true, false, 4, 40, true),
('brand', 'value_proposition', 'core', 'promise_in_one_breath', 'Si alguien elige esta marca y no otra, ¿qué promesa concreta está comprando?', 'Piensen en beneficio más prueba o señal de credibilidad, aunque la prueba sea modesta.', 'textarea', '[]'::jsonb, NULL, true, false, 5, 50, true),
('brand', 'audiences', 'core', 'primary_people', '¿Quiénes son las personas o equipos que más les importa mover con esta marca?', 'Prioricen rol, contexto y qué les quita el sueño, no solo demografía.', 'textarea', '[]'::jsonb, NULL, true, false, 5, 60, true),
('brand', 'audiences', 'core', 'who_not_for', '¿Para quién NO es esta marca (aunque a veces se lo pidan)?', 'Decir “no” con claridad ayuda al tono y a la estrategia.', 'textarea', '[]'::jsonb, NULL, false, false, 3, 70, true),
('brand', 'differentiators', 'core', 'sharp_edges', '¿Qué pueden decir que es verdaderamente distinto en cómo lo hacen, no solo en lo que dicen?', 'Puede ser criterio, método, ritmo, calidad, cercanía, forma de elegir clientes…', 'textarea', '[]'::jsonb, NULL, true, false, 5, 80, true),
('brand', 'positioning', 'core', 'desired_perception', 'Cuando la gente correcta los menciona, ¿qué quieren que piensen o sientan en los primeros segundos?', 'Piensen en reputación deseada, no en eslogan.', 'textarea', '[]'::jsonb, NULL, true, false, 4, 90, true),
('brand', 'voice_tone', 'core', 'how_you_sound', '¿Cómo debería sonar esta marca al hablar: cercana, experta, directa, poética, provocadora…?', 'Pueden nombrar dos o tres adjetivos y un “nunca así”.', 'textarea', '[]'::jsonb, NULL, true, false, 4, 100, true),
('brand', 'voice_tone', 'core', 'reference_phrases', '¿Hay frases reales (suyas o de referentes que admiran) que capturen el ritmo que buscan?', 'Opcional: sirven como brújula, no para copiar.', 'textarea', '[]'::jsonb, NULL, false, false, 2, 110, true),
('brand', 'approved_messages', 'core', 'lines_we_can_say', '¿Qué mensajes, claims o formulaciones ya están aprobados y pueden usar con tranquilidad?', 'Una por línea o lista breve. Si no hay ninguno, díganlo en forma explícita.', 'textarea', '[]'::jsonb, NULL, false, false, 3, 120, true),
('brand', 'restrictions', 'core', 'topics_words_avoid', '¿Qué temas, comparaciones o palabras prefieren evitar en comunicación pública?', 'Legal, reputación, promesas fuertes sin respaldo, tabúes del sector…', 'textarea', '[]'::jsonb, NULL, false, true, 4, 130, true),
('brand', 'evidence', 'core', 'proof_we_have', '¿Qué evidencia real tienen hoy para sostener lo que cuentan? (datos, trayectoria, casos, testimonios, alianzas…)', 'No hace falta ser perfectos: mejor honestidad que inflar.', 'textarea', '[]'::jsonb, NULL, false, false, 5, 140, true),
('brand', 'evidence', 'core', 'proof_we_wish', '¿Qué prueba les gustaría tener en los próximos meses y aún no tienen?', 'Ayuda a marcar límites en lo que pueden prometer por ahora.', 'textarea', '[]'::jsonb, NULL, false, false, 2, 150, true),
('brand', 'brand_limbic_base', 'core', 'emotional_colors', '¿Qué colores sienten que representan mejor la energía de esta marca?', 'No piensen solo en colores del logo. Piensen en energía, temperatura, carácter y sensación.', 'textarea', '[]'::jsonb, NULL, false, false, 3, 155, true),
('brand', 'brand_limbic_base', 'core', 'atmospheres', '¿Qué atmósferas le quedan bien a esta marca?', 'Ejemplos: una sala elegante, una calle con movimiento, una conversación íntima, un escenario encendido, una mañana limpia, una ciudad en expansión.', 'textarea', '[]'::jsonb, NULL, false, false, 4, 158, true),
('brand', 'brand_limbic_base', 'core', 'symbolic_landscape', 'Si esta marca fuera un paisaje o lugar, ¿cuál sería y por qué?', 'La respuesta no se usará literalmente. Sirve para entender tono, amplitud, ritmo y personalidad.', 'textarea', '[]'::jsonb, NULL, false, false, 3, 161, true),
('brand', 'brand_limbic_base', 'core', 'movement_energy', '¿Cómo se mueve esta marca: rápido, pausado, elegante, disruptivo, constante, expansivo, preciso?', NULL, 'textarea', '[]'::jsonb, NULL, false, false, 3, 164, true),
('brand', 'brand_limbic_base', 'core', 'emotional_temperature', '¿Qué temperatura emocional tiene esta marca?', NULL, 'single_choice', '[{"value":"warm","label":"Cálida"},{"value":"fresh","label":"Fresca"},{"value":"intense","label":"Intensa"},{"value":"calm","label":"Serena"},{"value":"sober","label":"Sobria"},{"value":"luminous","label":"Luminosa"},{"value":"mixed","label":"Mezcla de varias"}]'::jsonb, NULL, false, false, 2, 167, true),
('brand', 'brand_limbic_base', 'core', 'sensory_associations', 'Si esta marca tuviera una sensación física, un sonido, un olor o una textura, ¿cómo sería?', 'No buscamos una respuesta literal. Buscamos señales para construir atmósfera, ritmo y lenguaje.', 'textarea', '[]'::jsonb, NULL, false, false, 3, 170, true),
('brand', 'brand_limbic_base', 'core', 'allowed_metaphors', '¿Qué metáforas, símbolos o imágenes sí podrían representar a esta marca?', NULL, 'textarea', '[]'::jsonb, NULL, false, false, 3, 173, true),
('brand', 'brand_limbic_base', 'core', 'forbidden_metaphors', '¿Qué metáforas, símbolos o imágenes definitivamente no le quedan a esta marca?', NULL, 'textarea', '[]'::jsonb, NULL, false, false, 3, 176, true),
('brand', 'brand_limbic_base', 'core', 'expressive_codes', '¿Qué códigos expresivos debería sostener la marca en el tiempo?', 'Ejemplos: claridad, humor fino, autoridad, cercanía, precisión, elegancia, energía, calma, irreverencia controlada.', 'textarea', '[]'::jsonb, NULL, false, false, 4, 179, true),
('brand', 'product', 'product', 'product_type', '¿Qué tipo de producto es y qué categoría mental ocupa para quien lo compra?', 'Piensen en cómo lo buscarían en una conversación, no solo en etiqueta de catálogo.', 'textarea', '[]'::jsonb, '{"offer_natures":["product"]}'::jsonb, true, false, 4, 200, true),
('brand', 'product', 'product', 'problem_solved', '¿Qué problema práctico o emocional deja de ser un problema cuando este producto funciona bien?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product"]}'::jsonb, true, false, 5, 210, true),
('brand', 'product', 'product', 'desire_activated', '¿Qué deseo o aspiración enciende a la persona justo antes de decidirse por algo como esto?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product"]}'::jsonb, false, false, 3, 220, true),
('brand', 'product', 'product', 'buyer_profile', '¿Quién suele tomar la decisión de compra y qué necesita ver para decir que sí?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product"]}'::jsonb, true, false, 4, 230, true),
('brand', 'product', 'product', 'end_user_profile', 'Si quien compra no es quien usa: ¿quién es el usuario final y qué le importa en el día a día?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product"]}'::jsonb, false, false, 3, 240, true),
('brand', 'product', 'product', 'usage_moment', '¿En qué momento del día, de la semana o de la vida se usa de verdad?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product"]}'::jsonb, false, false, 3, 250, true),
('brand', 'product', 'product', 'purchase_place', '¿Dónde se compra normalmente? (online, retail, distribuidor, mix…)', NULL, 'text', '[]'::jsonb, '{"offer_natures":["product"]}'::jsonb, false, false, 2, 260, true),
('brand', 'product', 'product', 'price_band', '¿Cómo se sitúa en precio frente a alternativas que el comprador compara en la cabeza?', 'No hace falta cifra exacta: sensación (premium, medio, accesible) ya ayuda.', 'single_choice', '[{"value":"premium","label":"Premium / alto"},{"value":"mid","label":"Medio"},{"value":"accessible","label":"Accesible"},{"value":"mixed","label":"Depende del canal o línea"},{"value":"unsure","label":"Aún no lo tienen claro"}]'::jsonb, '{"offer_natures":["product"]}'::jsonb, false, false, 2, 270, true),
('brand', 'product', 'product', 'competition_landscape', '¿Con qué alternativas compite en la práctica (marcas, sustitutos, “no hacer nada”)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product"]}'::jsonb, false, true, 3, 280, true),
('brand', 'product', 'product', 'product_specific_differentiators', '¿Qué hace distinto a ESTE producto frente a esas alternativas?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product"]}'::jsonb, true, false, 4, 290, true),
('brand', 'product', 'product', 'typical_objections', '¿Qué dudas o frenos escuchan una y otra vez antes de comprar?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product"]}'::jsonb, false, true, 3, 300, true),
('brand', 'service', 'service', 'service_type', '¿Qué tipo de servicio ofrecen y qué resultado tangible o intangible entrega?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["service"]}'::jsonb, true, false, 4, 400, true),
('brand', 'service', 'service', 'transformation_promise', 'Después de trabajar con ustedes, ¿qué cambia en la vida o en el negocio del cliente?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["service"]}'::jsonb, true, false, 5, 410, true),
('brand', 'service', 'service', 'pain_before', '¿Qué dolor, caos o tensión suele traer el cliente antes de contratar?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["service"]}'::jsonb, true, false, 4, 420, true),
('brand', 'service', 'service', 'expected_outcome', '¿Qué resultado espera el cliente al cerrar (aunque sea un primer hito, no el final absoluto)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["service"]}'::jsonb, true, false, 4, 430, true),
('brand', 'service', 'service', 'delivery_mode', '¿Cómo se entrega el servicio? (presencial, remoto, híbrido, equipos, ritmo de sesiones…)', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["service"]}'::jsonb, true, false, 3, 440, true),
('brand', 'service', 'service', 'trust_required', '¿Qué nivel de confianza hay que construir antes de que alguien diga sí (referencias, pruebas, tiempo, garantías)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["service"]}'::jsonb, false, false, 3, 450, true),
('brand', 'service', 'service', 'evidence_backing_service', '¿Qué respalda hoy su credibilidad en este servicio?', 'Casos, años, metodología, certificaciones, volumen… lo que sea verificable.', 'textarea', '[]'::jsonb, '{"offer_natures":["service"]}'::jsonb, false, false, 4, 460, true),
('brand', 'service', 'service', 'objections_service', '¿Qué objeciones o miedos aparecen al decidir contratarlos?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["service"]}'::jsonb, false, true, 3, 470, true),
('brand', 'service', 'service', 'recurrence', '¿Es un servicio puntual, recurrente o ambos según el cliente?', NULL, 'single_choice', '[{"value":"one_off","label":"Mayormente puntual"},{"value":"recurring","label":"Mayormente recurrente"},{"value":"both","label":"Mezcla según oferta"}]'::jsonb, '{"offer_natures":["service"]}'::jsonb, false, false, 2, 480, true),
('brand', 'service', 'service', 'client_experience_signature', '¿Qué debería sentir alguien en el proceso: orden, velocidad, calma, exigencia, juego…?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["service"]}'::jsonb, false, false, 3, 490, true),
('brand', 'product_service', 'product_service', 'how_product_and_service_split', 'En su oferta, ¿qué parte es producto tangible y qué parte es servicio o acompañamiento?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product_service"]}'::jsonb, true, false, 4, 500, true),
('brand', 'product_service', 'product_service', 'bundle_promise', '¿Qué promesa única queda cuando producto y servicio van juntos (no por separado)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product_service"]}'::jsonb, true, false, 5, 510, true),
('brand', 'product_service', 'product_service', 'onboarding_or_implementation', '¿Qué pasa después de la compra del producto: instalación, puesta en marcha, formación, soporte?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product_service"]}'::jsonb, true, false, 4, 520, true),
('brand', 'product_service', 'product_service', 'success_metric_combined', '¿Cómo saben que el conjunto producto más servicio funcionó para el cliente?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product_service"]}'::jsonb, false, false, 3, 530, true),
('brand', 'product_service', 'product_service', 'upsell_or_expand', '¿Dónde suele ampliarse la relación: más unidades, más módulos, más soporte, renovación?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product_service"]}'::jsonb, false, false, 2, 540, true),
('brand', 'product_service', 'product_service', 'friction_when_both', '¿Dónde suele romperse la experiencia cuando hay producto y servicio a la vez (logística, tiempos, expectativas)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["product_service"]}'::jsonb, false, true, 3, 550, true),
('brand', 'experience_event', 'experience_event', 'experience_type', '¿Qué tipo de experiencia o evento son: formato, duración y escala aproximada?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["experience_event"]}'::jsonb, true, false, 4, 600, true),
('brand', 'experience_event', 'experience_event', 'public_who_comes', '¿Quién viene y qué mezcla de perfiles buscan (edad, industria, curiosidad, nivel experto)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["experience_event"]}'::jsonb, true, false, 4, 610, true),
('brand', 'experience_event', 'experience_event', 'experiential_promise', '¿Qué promesa experiencial hacen: qué tiene que pasar para que la gente diga que valió la pena?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["experience_event"]}'::jsonb, true, false, 5, 620, true),
('brand', 'experience_event', 'experience_event', 'feelings_during', '¿Qué debería sentirse más durante la experiencia (energía, calma, pertenencia, desafío, lujo relajado…)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["experience_event"]}'::jsonb, false, false, 3, 630, true),
('brand', 'experience_event', 'experience_event', 'memory_after', '¿Qué recuerdo quieren que se lleve la gente a los días siguientes?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["experience_event"]}'::jsonb, false, false, 4, 640, true),
('brand', 'experience_event', 'experience_event', 'scale_typical', '¿Cómo es la escala habitual (intimidad pequeña, cientos, miles)?', NULL, 'text', '[]'::jsonb, '{"offer_natures":["experience_event"]}'::jsonb, false, false, 2, 650, true),
('brand', 'experience_event', 'experience_event', 'frequency', '¿Con qué frecuencia ocurre (único, temporada, serie, itinerante)?', NULL, 'single_choice', '[{"value":"one_off","label":"Puntual / edición única"},{"value":"seasonal","label":"Por temporadas"},{"value":"series","label":"Serie regular"},{"value":"touring","label":"Itinerante"},{"value":"mixed","label":"Mix"}]'::jsonb, '{"offer_natures":["experience_event"]}'::jsonb, false, false, 2, 660, true),
('brand', 'experience_event', 'experience_event', 'presence_format', '¿Presencial, digital o híbrido? ¿Qué formato define mejor la magia de lo que hacen?', NULL, 'single_choice', '[{"value":"in_person","label":"Presencial"},{"value":"digital","label":"Digital"},{"value":"hybrid","label":"Híbrido"}]'::jsonb, '{"offer_natures":["experience_event"]}'::jsonb, true, false, 3, 670, true),
('brand', 'experience_event', 'experience_event', 'allies_partners', '¿Qué aliados, espacios o marcas acompañan o potencian la experiencia?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["experience_event"]}'::jsonb, false, false, 2, 680, true),
('brand', 'experience_event', 'experience_event', 'experience_constraints', '¿Qué límites reales condicionan la experiencia (legal, seguridad, accesibilidad, venue, clima)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["experience_event"]}'::jsonb, false, true, 3, 690, true),
('brand', 'digital_platform', 'digital_platform_app_saas', 'problem_solved_platform', '¿Qué problema recurrente resuelve el producto digital para el usuario?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["digital_platform_app_saas"]}'::jsonb, true, false, 5, 700, true),
('brand', 'digital_platform', 'digital_platform_app_saas', 'primary_user', '¿Quién es el usuario principal y qué hace en la app o plataforma en una semana tipo?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["digital_platform_app_saas"]}'::jsonb, true, false, 4, 710, true),
('brand', 'digital_platform', 'digital_platform_app_saas', 'buyer_if_different', 'Si quien paga no es quien usa: ¿quién compra y qué criterio usa (precio, seguridad, integración, política interna)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["digital_platform_app_saas"]}'::jsonb, false, false, 3, 720, true),
('brand', 'digital_platform', 'digital_platform_app_saas', 'core_use_case', '¿Cuál es el caso de uso donde la herramienta más brilla de verdad?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["digital_platform_app_saas"]}'::jsonb, true, false, 4, 730, true),
('brand', 'digital_platform', 'digital_platform_app_saas', 'adoption_barriers', '¿Qué fricción frena la adopción (migración, TI, curva de aprendizaje, privacidad, precio)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["digital_platform_app_saas"]}'::jsonb, false, true, 3, 740, true),
('brand', 'digital_platform', 'digital_platform_app_saas', 'business_model', '¿Cómo se monetiza (suscripción, uso, freemium, licencias, marketplace)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["digital_platform_app_saas"]}'::jsonb, false, false, 3, 750, true),
('brand', 'digital_platform', 'digital_platform_app_saas', 'tech_differentiator', '¿Qué diferenciador tecnológico o de producto pueden defender sin humo?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["digital_platform_app_saas"]}'::jsonb, true, false, 4, 760, true),
('brand', 'digital_platform', 'digital_platform_app_saas', 'usage_moment_digital', '¿En qué momento del trabajo encaja: diario, semanal, solo en crisis, solo al cierre de mes…?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["digital_platform_app_saas"]}'::jsonb, false, false, 2, 770, true),
('brand', 'digital_platform', 'digital_platform_app_saas', 'learning_curve', '¿Cómo es la curva de aprendizaje honesta para un equipo nuevo?', NULL, 'single_choice', '[{"value":"low","label":"Baja — en horas"},{"value":"medium","label":"Media — días"},{"value":"high","label":"Alta — semanas con acompañamiento"}]'::jsonb, '{"offer_natures":["digital_platform_app_saas"]}'::jsonb, false, false, 2, 780, true),
('brand', 'digital_platform', 'digital_platform_app_saas', 'product_url', '¿URL principal del producto o demo pública (si existe)?', NULL, 'url', '[]'::jsonb, '{"offer_natures":["digital_platform_app_saas"]}'::jsonb, false, false, 1, 790, true),
('brand', 'organization', 'organization_institution_cause', 'organizational_purpose', '¿Cuál es el propósito rector que explica por qué existen como organización?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["organization_institution_cause"]}'::jsonb, true, false, 5, 800, true),
('brand', 'organization', 'organization_institution_cause', 'cause_or_mission', 'Si hay causa o misión explícita, ¿cómo la dirían en una frase que cualquier miembro pueda repetir?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["organization_institution_cause"]}'::jsonb, true, false, 5, 810, true),
('brand', 'organization', 'organization_institution_cause', 'publics_served', '¿A qué públicos sirven primero (beneficiarios, socios, ciudadanía, sector, equipo interno)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["organization_institution_cause"]}'::jsonb, true, false, 4, 820, true),
('brand', 'organization', 'organization_institution_cause', 'legitimacy_source', '¿De dónde sale su legitimidad (trayectoria, gobernanza, transparencia, resultados, alianzas)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["organization_institution_cause"]}'::jsonb, false, false, 4, 830, true),
('brand', 'organization', 'organization_institution_cause', 'impact_so_far', '¿Qué impacto medible o narrable pueden contar hoy sin inventar cifras?', 'Si aún es incipiente, describan señales tempranas creíbles.', 'textarea', '[]'::jsonb, '{"offer_natures":["organization_institution_cause"]}'::jsonb, false, false, 4, 840, true),
('brand', 'organization', 'organization_institution_cause', 'allies_ecosystem', '¿Qué aliados, instituciones o redes amplían su acción?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["organization_institution_cause"]}'::jsonb, false, false, 3, 850, true),
('brand', 'organization', 'organization_institution_cause', 'territories_action', '¿En qué territorios o ámbitos actúan (geográfico, sectorial, temático)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["organization_institution_cause"]}'::jsonb, false, false, 2, 860, true),
('brand', 'organization', 'organization_institution_cause', 'reputational_risks', '¿Qué riesgos reputacionales o políticos deben navegar con cuidado al comunicar?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["organization_institution_cause"]}'::jsonb, false, true, 4, 870, true),
('brand', 'organization', 'organization_institution_cause', 'language_to_avoid_org', '¿Hay lenguaje, estereotipos o metáforas que la organización evita por principio?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["organization_institution_cause"]}'::jsonb, false, true, 3, 880, true),
('brand', 'organization', 'organization_institution_cause', 'evidence_org', '¿Qué evidencia respalda sus afirmaciones (informes, auditorías, datos abiertos, casos)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["organization_institution_cause"]}'::jsonb, false, false, 3, 890, true),
('brand', 'personal_brand', 'personal_brand', 'authority_basis', '¿En qué se apoya su autoridad para hablar de esto (experiencia, resultados, trayectoria, práctica)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["personal_brand"]}'::jsonb, true, false, 5, 900, true),
('brand', 'personal_brand', 'personal_brand', 'experience_backbone', '¿Qué hitos o decisiones marcan su historia profesional de forma honesta?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["personal_brand"]}'::jsonb, true, false, 4, 910, true),
('brand', 'personal_brand', 'personal_brand', 'themes_you_lead', '¿Qué temas o debates puede liderar con criterio propio?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["personal_brand"]}'::jsonb, true, false, 4, 920, true),
('brand', 'personal_brand', 'personal_brand', 'audience_you_serve', '¿Quién se acerca a su voz y qué busca en usted (no solo “seguidores”)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["personal_brand"]}'::jsonb, true, false, 4, 930, true),
('brand', 'personal_brand', 'personal_brand', 'natural_tone', '¿Cómo es su tono natural cuando no está “presentando”: cercano, incisivo, pausado, humor fino…?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["personal_brand"]}'::jsonb, false, false, 3, 940, true),
('brand', 'personal_brand', 'personal_brand', 'story_behind_voice', '¿Qué historia personal (sin mitología) sostiene por qué hace esto hoy?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["personal_brand"]}'::jsonb, false, true, 3, 950, true),
('brand', 'personal_brand', 'personal_brand', 'boundaries', '¿Qué límites claros pone (temas que no toca, clientes que no acepta, estilo que no usará)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["personal_brand"]}'::jsonb, false, true, 3, 960, true),
('brand', 'personal_brand', 'personal_brand', 'positioning_aspiration', '¿Hacia dónde quiere que evolucione su posicionamiento en los próximos años?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["personal_brand"]}'::jsonb, false, false, 2, 970, true),
('brand', 'personal_brand', 'personal_brand', 'formats_where_you_show_up', '¿En qué formatos quiere aparecer (charla, newsletter, podcast, taller, consultoría, libro…)?', NULL, 'textarea', '[]'::jsonb, '{"offer_natures":["personal_brand"]}'::jsonb, false, false, 2, 980, true);
