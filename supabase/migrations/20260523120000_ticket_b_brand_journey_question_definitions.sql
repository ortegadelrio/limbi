-- Ticket B — Nuevo catálogo question_definitions (Journey de Marca).
-- Desactiva el seed anterior (is_active = false, sin borrar filas).
-- UPSERT por (journey_type, question_key) por unique constraint; sin borrar filas.
-- Inserta el catálogo aprobado: sin brand_type, sin offer ni territorios en catálogo,
-- sin context_sources_note; Base Límbica con 5 señales; temperatura = single_choice;
-- metadata exclusive en opciones indicadas; español neutro/latinoamericano.

BEGIN;

UPDATE public.question_definitions
SET is_active = false,
    updated_at = now()
WHERE journey_type = 'brand';

INSERT INTO public.question_definitions (
  journey_type,
  section_key,
  module_key,
  question_key,
  question_text,
  help_text,
  answer_type,
  options,
  applies_to,
  is_required,
  is_sensitive,
  evaluation_weight,
  display_order,
  is_active
) VALUES

-- identity (núcleo: applies_to NULL)
(
  'brand',
  'identity',
  'core',
  'brand_essence_one_sentence',
  'Si tuvieras que presentar esta marca en una frase honesta, ¿qué dirías que es?',
  'Aquí no estamos preguntando todavía por servicios, productos o características. Eso corresponde al inventario de oferta. Piensa en la esencia: qué representa, desde dónde habla y qué lugar quiere ocupar.',
  'textarea',
  '[]'::jsonb,
  NULL,
  true,
  false,
  5,
  10,
  true
),
(
  'brand',
  'identity',
  'core',
  'brand_transformation',
  '¿Qué busca transformar esta marca?',
  NULL,
  'textarea',
  '[]'::jsonb,
  NULL,
  true,
  false,
  4,
  20,
  true
),
(
  'brand',
  'identity',
  'core',
  'desired_perception',
  '¿Qué quieres que las personas piensen o sientan cuando escuchen el nombre de esta marca?',
  'Piensa en reputación deseada, no en eslogan.',
  'textarea',
  '[]'::jsonb,
  NULL,
  true,
  false,
  4,
  30,
  true
),
(
  'brand',
  'identity',
  'core',
  'perception_to_avoid',
  'No quiero que las personas piensen que esta marca es…',
  'Esto es una percepción a evitar: debe usarse como restricción, alerta o límite estratégico. No es un atributo positivo ni un claim.',
  'textarea',
  '[]'::jsonb,
  NULL,
  false,
  true,
  3,
  40,
  true
),

-- value_proposition
(
  'brand',
  'value_proposition',
  'core',
  'overall_value_result',
  'Mirando toda la oferta de la marca, ¿qué cambio, beneficio o resultado promete entregar?',
  'Aquí va el valor en conjunto, no la descripción de cada ítem de oferta.',
  'textarea',
  '[]'::jsonb,
  NULL,
  true,
  false,
  5,
  110,
  true
),
(
  'brand',
  'value_proposition',
  'core',
  'why_offer_matters',
  '¿Por qué esa oferta es importante para el cliente, usuario o audiencia?',
  NULL,
  'textarea',
  '[]'::jsonb,
  NULL,
  true,
  false,
  4,
  120,
  true
),

-- audiences (territorios = brand_audience_territories, no catálogo)
(
  'brand',
  'audiences',
  'core',
  'primary_audience',
  '¿Quiénes son las personas, equipos, clientes o públicos más importantes para esta marca?',
  'Prioriza roles y contexto. La segmentación demográfica siguiente es opcional y no debe estereotipar.',
  'textarea',
  '[]'::jsonb,
  NULL,
  true,
  false,
  5,
  200,
  true
),
(
  'brand',
  'audiences',
  'demographics',
  'audience_age_ranges',
  'Rango de edades',
  'Opcional. Selecciona solo lo que aplique. Si no segmentas por edad, puedes dejarlo vacío: no debe penalizar el diagnóstico por sí solo.',
  'multi_choice',
  $age$
  [
    {"value":"under_13","label":"Menores de 13","description":"Solo si aplica a tu caso.","visual_hint":"age","image_key":"age_under_13"},
    {"value":"13_17","label":"13–17","description":"Adolescentes.","visual_hint":"age","image_key":"age_13_17"},
    {"value":"18_24","label":"18–24","description":"Jóvenes adultos.","visual_hint":"age","image_key":"age_18_24"},
    {"value":"25_34","label":"25–34","description":"Adultos jóvenes.","visual_hint":"age","image_key":"age_25_34"},
    {"value":"35_44","label":"35–44","description":"Adultos.","visual_hint":"age","image_key":"age_35_44"},
    {"value":"45_54","label":"45–54","description":"Adultos.","visual_hint":"age","image_key":"age_45_54"},
    {"value":"55_64","label":"55–64","description":"Adultos.","visual_hint":"age","image_key":"age_55_64"},
    {"value":"65_plus","label":"65+","description":"Personas mayores.","visual_hint":"age","image_key":"age_65_plus"},
    {"value":"all_ages","label":"Todas las edades","description":"No hay rango prioritario.","visual_hint":"broad","image_key":"all_ages","exclusive":true},
    {"value":"not_clear","label":"No aplica / no lo tengo claro","description":"Aún no está definido.","visual_hint":"neutral","image_key":"not_clear","exclusive":true}
  ]
  $age$::jsonb,
  NULL,
  false,
  true,
  2,
  210,
  true
),
(
  'brand',
  'audiences',
  'demographics',
  'audience_genders',
  'Géneros',
  'Opcional. Activa esta pregunta solo si la comunicación debe considerar el género con claridad.',
  'multi_choice',
  $gen$
  [
    {"value":"women","label":"Mujeres","description":"","visual_hint":"people","image_key":"gender_women"},
    {"value":"men","label":"Hombres","description":"","visual_hint":"people","image_key":"gender_men"},
    {"value":"non_binary","label":"Personas no binarias","description":"","visual_hint":"people","image_key":"gender_non_binary"},
    {"value":"all_genders","label":"Todos los géneros","description":"No segmentas por género.","visual_hint":"inclusive","image_key":"all_genders","exclusive":true},
    {"value":"not_segmented","label":"No aplica / no segmenta por género","description":"","visual_hint":"neutral","image_key":"not_segmented","exclusive":true}
  ]
  $gen$::jsonb,
  NULL,
  false,
  true,
  2,
  220,
  true
),
(
  'brand',
  'audiences',
  'communities',
  'audience_communities',
  'Comunidades o grupos específicos',
  'Opcional. Sirve para sensibilidad cultural y contexto. No asume comportamientos por pertenencia.',
  'multi_choice',
  $com$
  [
    {"value":"afro","label":"Comunidades afro","description":"","visual_hint":"community","image_key":"community_afro"},
    {"value":"indigenous","label":"Comunidades indígenas","description":"","visual_hint":"community","image_key":"community_indigenous"},
    {"value":"migrants","label":"Migrantes","description":"","visual_hint":"community","image_key":"community_migrants"},
    {"value":"latinos_us","label":"Latinos en Estados Unidos","description":"","visual_hint":"community","image_key":"community_latinos_us"},
    {"value":"lgbtq","label":"Comunidad LGBTQ+","description":"","visual_hint":"community","image_key":"community_lgbtq"},
    {"value":"disability","label":"Personas con discapacidad","description":"","visual_hint":"community","image_key":"community_disability"},
    {"value":"older_adults","label":"Adultos mayores","description":"","visual_hint":"community","image_key":"community_older_adults"},
    {"value":"youth","label":"Jóvenes","description":"","visual_hint":"community","image_key":"community_youth"},
    {"value":"entrepreneurs","label":"Emprendedores","description":"","visual_hint":"community","image_key":"community_entrepreneurs"},
    {"value":"parents_families","label":"Madres / padres / familias","description":"","visual_hint":"community","image_key":"community_parents"},
    {"value":"students","label":"Estudiantes","description":"","visual_hint":"community","image_key":"community_students"},
    {"value":"professionals","label":"Profesionales","description":"","visual_hint":"community","image_key":"community_professionals"},
    {"value":"none_specific","label":"Ninguna comunidad específica","description":"","visual_hint":"neutral","image_key":"community_none","exclusive":true},
    {"value":"other","label":"Otro","description":"Ticket C: si eliges esto, la UI debe ofrecer un campo para especificar.","visual_hint":"neutral","image_key":"community_other"}
  ]
  $com$::jsonb,
  NULL,
  false,
  true,
  2,
  230,
  true
),
(
  'brand',
  'audiences',
  'constraints',
  'adults_only',
  '¿Esta marca, producto o servicio está dirigido solo a mayores de edad?',
  'Opcional. Si aplica, Limbi lo tratará como restricción o límite de comunicación.',
  'single_choice',
  $adult$
  [
    {"value":"yes","label":"Sí","description":"Comunicación sujeta a restricciones de mayoría de edad.","visual_hint":"restriction","image_key":"adults_yes"},
    {"value":"no","label":"No","description":"","visual_hint":"open","image_key":"adults_no"},
    {"value":"not_applicable","label":"No aplica","description":"","visual_hint":"neutral","image_key":"adults_na"}
  ]
  $adult$::jsonb,
  NULL,
  false,
  true,
  2,
  240,
  true
),
(
  'brand',
  'audiences',
  'constraints',
  'has_access_or_regulatory_limits',
  '¿La oferta tiene alguna limitante de consumo, acceso o comunicación?',
  'Opcional.',
  'single_choice',
  $lim$
  [
    {"value":"yes","label":"Sí","description":"Hay límites que deben cuidarse.","visual_hint":"restriction","image_key":"limit_yes"},
    {"value":"no","label":"No","description":"No hay límites relevantes conocidos.","visual_hint":"clear","image_key":"limit_no"}
  ]
  $lim$::jsonb,
  NULL,
  false,
  true,
  2,
  250,
  true
),
(
  'brand',
  'audiences',
  'constraints',
  'access_or_regulatory_limits',
  '¿Cuál?',
  'Solo si seleccionaste Sí arriba. Es insumo de restricción o alerta, no un mensaje público.',
  'textarea',
  '[]'::jsonb,
  NULL,
  false,
  true,
  3,
  260,
  true
),
(
  'brand',
  'audiences',
  'decision',
  'decision_maker_and_influencer',
  '¿Quién toma la decisión y quién influye en esa decisión?',
  'Opcional.',
  'textarea',
  '[]'::jsonb,
  NULL,
  false,
  false,
  3,
  270,
  true
),
(
  'brand',
  'audiences',
  'tension',
  'audience_need_desire_tension',
  '¿Qué les preocupa, desean o necesitan resolver cuando se acercan a una marca como esta?',
  'Es insumo estratégico (tensión o necesidad). No debe convertirse automáticamente en claim ni pieza creativa.',
  'textarea',
  '[]'::jsonb,
  NULL,
  true,
  true,
  5,
  280,
  true
),

-- differentiation
(
  'brand',
  'differentiation',
  'core',
  'main_differentiator',
  '¿Qué hace diferente a esta marca frente a otras alternativas?',
  'No repitas el inventario de oferta. Piensa en enfoque, método, criterio, experiencia, forma de trabajar o manera de resolver.',
  'textarea',
  '[]'::jsonb,
  NULL,
  true,
  false,
  5,
  300,
  true
),
(
  'brand',
  'differentiation',
  'market',
  'real_alternatives',
  '¿Contra qué alternativas compite realmente esta marca?',
  'Opcional. Puede incluir sustitutos o “no hacer nada”. Trata la competencia con sobriedad.',
  'textarea',
  '[]'::jsonb,
  NULL,
  false,
  true,
  3,
  310,
  true
),
(
  'brand',
  'differentiation',
  'signature',
  'signature_way',
  '¿Hay algo en la forma de trabajar, pensar o entregar valor que sea muy propio de esta marca?',
  'Opcional.',
  'textarea',
  '[]'::jsonb,
  NULL,
  false,
  false,
  2,
  320,
  true
),

-- voice_tone_messages
(
  'brand',
  'voice_tone_messages',
  'tone',
  'tone_should_sound',
  '¿Cómo debe sonar?',
  'Elige las señales que mejor definan el tono. Puedes combinar varias.',
  'multi_choice',
  $tone_pos$
  [
    {"value":"close","label":"Cercana","description":"Humana y accesible.","visual_hint":"warm","image_key":"tone_close","emoji":"🤝"},
    {"value":"expert","label":"Experta","description":"Con criterio y dominio.","visual_hint":"authority","image_key":"tone_expert","emoji":"🎓"},
    {"value":"direct","label":"Directa","description":"Sin rodeos.","visual_hint":"precise","image_key":"tone_direct","emoji":"➡️"},
    {"value":"inspiring","label":"Inspiradora","description":"Eleva y moviliza.","visual_hint":"luminous","image_key":"tone_inspiring","emoji":"✨"},
    {"value":"sober","label":"Sobria","description":"Controlada y seria.","visual_hint":"sober","image_key":"tone_sober","emoji":"⬛"},
    {"value":"provocative","label":"Provocadora","description":"Desafía con intención.","visual_hint":"intense","image_key":"tone_provocative","emoji":"⚡"},
    {"value":"elegant","label":"Elegante","description":"Refinada y cuidada.","visual_hint":"elegant","image_key":"tone_elegant","emoji":"✨"},
    {"value":"young","label":"Joven","description":"Actual y dinámica.","visual_hint":"fresh","image_key":"tone_young","emoji":"🌱"},
    {"value":"institutional","label":"Institucional","description":"Formal y confiable.","visual_hint":"institutional","image_key":"tone_institutional","emoji":"🏛️"},
    {"value":"human","label":"Humana","description":"Cercana a la vida real.","visual_hint":"human","image_key":"tone_human","emoji":"🙂"},
    {"value":"technical","label":"Técnica","description":"Precisa y especializada.","visual_hint":"technical","image_key":"tone_technical","emoji":"🧪"},
    {"value":"controlled_irreverence","label":"Irreverente controlada","description":"Atrevida sin perder criterio.","visual_hint":"edge","image_key":"tone_irreverent","emoji":"🔥"},
    {"value":"optimistic","label":"Optimista","description":"Orientada al avance.","visual_hint":"luminous","image_key":"tone_optimistic","emoji":"☀️"},
    {"value":"warm","label":"Cálida","description":"Acogedora y amable.","visual_hint":"warm","image_key":"tone_warm","emoji":"🫶"},
    {"value":"precise","label":"Precisa","description":"Clara y exacta.","visual_hint":"precise","image_key":"tone_precise","emoji":"🎯"}
  ]
  $tone_pos$::jsonb,
  NULL,
  true,
  false,
  4,
  400,
  true
),
(
  'brand',
  'voice_tone_messages',
  'tone',
  'tone_should_not_sound',
  '¿Cómo NO debe sonar?',
  'Opcional. Estas señales son límites de tono, no “lo que la marca es”.',
  'multi_choice',
  $tone_neg$
  [
    {"value":"cold","label":"Fría","description":"","visual_hint":"cool","image_key":"tone_not_cold","emoji":"🧊"},
    {"value":"arrogant","label":"Arrogante","description":"","visual_hint":"risk","image_key":"tone_not_arrogant","emoji":"🚫"},
    {"value":"generic","label":"Genérica","description":"","visual_hint":"risk","image_key":"tone_not_generic","emoji":"📄"},
    {"value":"exaggerated","label":"Exagerada","description":"","visual_hint":"risk","image_key":"tone_not_exaggerated","emoji":"📣"},
    {"value":"childish","label":"Infantil","description":"","visual_hint":"risk","image_key":"tone_not_childish","emoji":"🧸"},
    {"value":"aggressive","label":"Agresiva","description":"","visual_hint":"risk","image_key":"tone_not_aggressive","emoji":"⚔️"},
    {"value":"over_technical","label":"Técnica en exceso","description":"","visual_hint":"risk","image_key":"tone_not_over_technical","emoji":"🧮"},
    {"value":"too_informal","label":"Demasiado informal","description":"","visual_hint":"risk","image_key":"tone_not_too_informal","emoji":"👟"},
    {"value":"over_institutional","label":"Institucional de más","description":"","visual_hint":"risk","image_key":"tone_not_over_institutional","emoji":"🏢"},
    {"value":"unsubstantiated_promises","label":"Prometedora sin respaldo","description":"","visual_hint":"risk","image_key":"tone_not_hype","emoji":"🎈"},
    {"value":"distant","label":"Lejana","description":"","visual_hint":"risk","image_key":"tone_not_distant","emoji":"🛰️"},
    {"value":"complicated","label":"Complicada","description":"","visual_hint":"risk","image_key":"tone_not_complicated","emoji":"🧩"}
  ]
  $tone_neg$::jsonb,
  NULL,
  false,
  true,
  3,
  410,
  true
),
(
  'brand',
  'voice_tone_messages',
  'messages',
  'approved_messages',
  '¿Hay frases, claims o mensajes que ya estén aprobados y debamos respetar?',
  'Opcional. Una por línea o lista breve.',
  'textarea',
  '[]'::jsonb,
  NULL,
  false,
  false,
  3,
  420,
  true
),

-- evidence
(
  'brand',
  'evidence',
  'core',
  'current_evidence',
  '¿Qué pruebas reales tiene la marca para respaldar lo que promete?',
  'Opcional. Honestidad por encima de inflar. Los documentos y la web son fuentes externas: solo lo aprobado cuenta como evidencia curada.',
  'textarea',
  '[]'::jsonb,
  NULL,
  false,
  false,
  4,
  500,
  true
),
(
  'brand',
  'evidence',
  'core',
  'most_important_evidence',
  'De todo lo anterior, ¿qué evidencia te parece más importante comunicar?',
  'Opcional.',
  'textarea',
  '[]'::jsonb,
  NULL,
  false,
  false,
  3,
  510,
  true
),

-- restrictions
(
  'brand',
  'restrictions',
  'core',
  'communication_restrictions',
  '¿Qué temas, palabras, promesas o comparaciones debe evitar esta marca?',
  'Esto es prevención y límite estratégico. No es copy público ni claim.',
  'textarea',
  '[]'::jsonb,
  NULL,
  false,
  true,
  4,
  600,
  true
),

-- brand_limbic_base (5 señales; temperatura = single_choice)
(
  'brand',
  'brand_limbic_base',
  'signals',
  'limbic_emotional_temperature',
  'Temperatura emocional',
  'Elige la predominante. Si sientes una mezcla clara, usa Mixta. Es una señal simbólica: no es copy literal ni instrucción visual directa.',
  'single_choice',
  $limbic_temp$
  [
    {"value":"warm","label":"Cálida","description":"Abrigo emocional, cercanía.","visual_hint":"warm","image_key":"limbic_temp_warm","emoji":"🌤️"},
    {"value":"fresh","label":"Fresca","description":"Ligereza, aire, claridad.","visual_hint":"fresh","image_key":"limbic_temp_fresh","emoji":"💨"},
    {"value":"intense","label":"Intensa","description":"Carga, fuerza, presencia.","visual_hint":"intense","image_key":"limbic_temp_intense","emoji":"🔥"},
    {"value":"serene","label":"Serena","description":"Calma, control, pausa.","visual_hint":"calm","image_key":"limbic_temp_serene","emoji":"🌿"},
    {"value":"sober","label":"Sobria","description":"Contención, rigor, elegancia contenida.","visual_hint":"sober","image_key":"limbic_temp_sober","emoji":"⬛"},
    {"value":"luminous","label":"Luminosa","description":"Claridad, apertura, optimismo.","visual_hint":"luminous","image_key":"limbic_temp_luminous","emoji":"✨"},
    {"value":"mixed","label":"Mixta","description":"Conviven varias temperaturas.","visual_hint":"creative","image_key":"limbic_temp_mixed","emoji":"🔀"}
  ]
  $limbic_temp$::jsonb,
  NULL,
  false,
  false,
  2,
  700,
  true
),
(
  'brand',
  'brand_limbic_base',
  'signals',
  'limbic_energy_movement',
  'Energía y movimiento',
  'Señal simbólica: describe ritmo y energía, no acciones literales.',
  'multi_choice',
  $limbic_en$
  [
    {"value":"fast","label":"Rápida","description":"Ágil, activa.","visual_hint":"urban_energy","image_key":"limbic_en_fast","emoji":"⚡"},
    {"value":"paused","label":"Pausada","description":"Reflexiva, pausada.","visual_hint":"calm","image_key":"limbic_en_paused","emoji":"⏸️"},
    {"value":"elegant","label":"Elegante","description":"Control, precisión estética.","visual_hint":"sober","image_key":"limbic_en_elegant","emoji":"✨"},
    {"value":"disruptive","label":"Disruptiva","description":"Rompe patrones con intención.","visual_hint":"intense","image_key":"limbic_en_disruptive","emoji":"💥"},
    {"value":"constant","label":"Constante","description":"Estable, confiable.","visual_hint":"calm","image_key":"limbic_en_constant","emoji":"🔁"},
    {"value":"expansive","label":"Expansiva","description":"Abre posibilidades.","visual_hint":"luminous","image_key":"limbic_en_expansive","emoji":"🌅"},
    {"value":"precise","label":"Precisa","description":"Foco, orden, exactitud.","visual_hint":"clear","image_key":"limbic_en_precise","emoji":"🎯"}
  ]
  $limbic_en$::jsonb,
  NULL,
  false,
  false,
  2,
  710,
  true
),
(
  'brand',
  'brand_limbic_base',
  'signals',
  'limbic_visual_atmosphere',
  'Atmósfera visual',
  'Metáfora de ambiente: no pedimos logos ni imágenes literales de marca.',
  'multi_choice',
  $limbic_atm$
  [
    {"value":"elegant_space","label":"Espacio elegante","description":"Sobriedad, cuidado, confianza.","visual_hint":"sober","image_key":"limbic_atm_elegant_space","emoji":"🛋️"},
    {"value":"city_in_motion","label":"Ciudad en movimiento","description":"Energía, actualidad.","visual_hint":"urban_energy","image_key":"limbic_atm_city","emoji":"🏙️"},
    {"value":"close_conversation","label":"Conversación cercana","description":"Escucha, humanidad.","visual_hint":"warm","image_key":"limbic_atm_conversation","emoji":"☕"},
    {"value":"lit_stage","label":"Escenario encendido","description":"Presencia, inspiración.","visual_hint":"intense","image_key":"limbic_atm_stage","emoji":"🎤"},
    {"value":"clean_morning","label":"Mañana limpia","description":"Claridad, comienzo.","visual_hint":"fresh","image_key":"limbic_atm_morning","emoji":"🌤️"},
    {"value":"creative_lab","label":"Laboratorio creativo","description":"Exploración, prueba, ideas.","visual_hint":"creative","image_key":"limbic_atm_lab","emoji":"🧪"},
    {"value":"artisan_workshop","label":"Taller artesanal","description":"Oficio, detalle, manos.","visual_hint":"warm","image_key":"limbic_atm_workshop","emoji":"🛠️"},
    {"value":"tech_space","label":"Espacio tecnológico","description":"Precisión, futuro, sistemas.","visual_hint":"technical","image_key":"limbic_atm_tech","emoji":"💻"},
    {"value":"open_landscape","label":"Paisaje abierto","description":"Amplitud, horizonte (no literal).","visual_hint":"luminous","image_key":"limbic_atm_landscape","emoji":"🌄"},
    {"value":"living_community","label":"Comunidad viva","description":"Pertenencia, vínculo.","visual_hint":"human","image_key":"limbic_atm_community","emoji":"🫂"}
  ]
  $limbic_atm$::jsonb,
  NULL,
  false,
  false,
  3,
  720,
  true
),
(
  'brand',
  'brand_limbic_base',
  'signals',
  'limbic_emotional_colors',
  'Colores emocionales',
  'Paleta simbólica: no es guía rígida de diseño gráfico.',
  'multi_choice',
  $limbic_col$
  [
    {"value":"deep_blue","label":"Azul profundo","description":"Profundidad, foco, serenidad fuerte.","visual_hint":"deep","image_key":"limbic_col_deep_blue","emoji":"🔵"},
    {"value":"natural_green","label":"Verde natural","description":"Vida, equilibrio, crecimiento.","visual_hint":"fresh","image_key":"limbic_col_green","emoji":"🟢"},
    {"value":"aqua_turquoise","label":"Aqua / turquesa","description":"Frescura, modernidad luminosa.","visual_hint":"fresh","image_key":"limbic_col_aqua","emoji":"🩵"},
    {"value":"bright_yellow","label":"Amarillo luminoso","description":"Optimismo, energía clara.","visual_hint":"luminous","image_key":"limbic_col_yellow","emoji":"🟡"},
    {"value":"energetic_orange","label":"Naranja energético","description":"Impulso, calor activo.","visual_hint":"intense","image_key":"limbic_col_orange","emoji":"🟠"},
    {"value":"intense_red","label":"Rojo intenso","description":"Pasión, urgencia, fuerza.","visual_hint":"intense","image_key":"limbic_col_red","emoji":"🔴"},
    {"value":"warm_pink","label":"Rosa cálido","description":"Cercanía suave, humanidad.","visual_hint":"warm","image_key":"limbic_col_pink","emoji":"🩷"},
    {"value":"creative_purple","label":"Morado creativo","description":"Imaginación, misterio creativo.","visual_hint":"creative","image_key":"limbic_col_purple","emoji":"🟣"},
    {"value":"sober_black","label":"Negro sobrio","description":"Contención, autoridad silenciosa.","visual_hint":"sober","image_key":"limbic_col_black","emoji":"⬛"},
    {"value":"clean_white","label":"Blanco limpio","description":"Claridad, espacio, orden.","visual_hint":"clear","image_key":"limbic_col_white","emoji":"⬜"},
    {"value":"technical_gray","label":"Gris técnico","description":"Neutralidad, precisión.","visual_hint":"technical","image_key":"limbic_col_gray","emoji":"🔘"},
    {"value":"earth_sand","label":"Tierra / arena","description":"Raíz, calidez terrosa.","visual_hint":"warm","image_key":"limbic_col_earth","emoji":"🟤"},
    {"value":"other","label":"Otro","description":"Ticket C: la UI debe permitir especificar el color emocional.","visual_hint":"neutral","image_key":"limbic_col_other","emoji":"✳️"}
  ]
  $limbic_col$::jsonb,
  NULL,
  false,
  false,
  2,
  730,
  true
),
(
  'brand',
  'brand_limbic_base',
  'signals',
  'limbic_expressive_codes',
  'Códigos expresivos',
  'Señales de estilo recurrente: no son claims.',
  'multi_choice',
  $limbic_ex$
  [
    {"value":"clarity","label":"Claridad","description":"Que se entienda sin esfuerzo.","visual_hint":"clear","image_key":"limbic_ex_clarity","emoji":"💡"},
    {"value":"authority","label":"Autoridad","description":"Criterio y peso.","visual_hint":"authority","image_key":"limbic_ex_authority","emoji":"🏛️"},
    {"value":"closeness","label":"Cercanía","description":"Conversación y empatía.","visual_hint":"warm","image_key":"limbic_ex_closeness","emoji":"🤝"},
    {"value":"elegance","label":"Elegancia","description":"Sobriedad y buen gusto.","visual_hint":"elegant","image_key":"limbic_ex_elegance","emoji":"✨"},
    {"value":"energy","label":"Energía","description":"Impulso y vitalidad.","visual_hint":"intense","image_key":"limbic_ex_energy","emoji":"⚡"},
    {"value":"calm","label":"Calma","description":"Contención y pausa.","visual_hint":"calm","image_key":"limbic_ex_calm","emoji":"🌿"},
    {"value":"fine_humor","label":"Humor fino","description":"Inteligente, sutil.","visual_hint":"warm","image_key":"limbic_ex_humor","emoji":"😉"},
    {"value":"controlled_irreverence","label":"Irreverencia controlada","description":"Atrevimiento con criterio.","visual_hint":"edge","image_key":"limbic_ex_irreverence","emoji":"🔥"},
    {"value":"human_sensitivity","label":"Sensibilidad humana","description":"Cuidado y mirada humana.","visual_hint":"human","image_key":"limbic_ex_sensitivity","emoji":"🫶"},
    {"value":"strategic_vision","label":"Visión estratégica","description":"Dirección, sentido, horizonte.","visual_hint":"clear","image_key":"limbic_ex_vision","emoji":"🧭"}
  ]
  $limbic_ex$::jsonb,
  NULL,
  false,
  false,
  3,
  740,
  true
)
ON CONFLICT (journey_type, question_key)
DO UPDATE SET
  section_key = EXCLUDED.section_key,
  module_key = EXCLUDED.module_key,
  question_text = EXCLUDED.question_text,
  help_text = EXCLUDED.help_text,
  answer_type = EXCLUDED.answer_type,
  options = EXCLUDED.options,
  applies_to = EXCLUDED.applies_to,
  is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive,
  evaluation_weight = EXCLUDED.evaluation_weight,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = now();

COMMIT;
