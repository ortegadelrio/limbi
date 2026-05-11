-- Ticket 3A.1: Catálogo visual — multi_choice / single_choice con options enriquecidas.
-- Filas: journey_type = 'brand' y question_key único.

-- 1. brand_limbic_base — movement_energy → multi_choice
UPDATE public.question_definitions
SET
  answer_type = 'multi_choice',
  question_text = '¿Cómo se mueve esta marca?',
  help_text =
    'Puedes escoger varias señales. No es literal: sirve para entender ritmo, energía y personalidad.',
  options = $movement$[
    {"value":"fast","label":"Rápida","description":"Ágil, activa, con sensación de movimiento.","emoji":"⚡","visual_hint":"urban_energy"},
    {"value":"calm","label":"Pausada","description":"Ritmo tranquilo, reflexivo y cuidado.","emoji":"🌿","visual_hint":"soft_light"},
    {"value":"elegant","label":"Elegante","description":"Precisa, sobria, con control estético.","emoji":"◼️","visual_hint":"sober"},
    {"value":"disruptive","label":"Disruptiva","description":"Rompe patrones y busca incomodar un poco.","emoji":"💥","visual_hint":"intense"},
    {"value":"constant","label":"Constante","description":"Confiable, estable, de largo aliento.","emoji":"🔁","visual_hint":"calm"},
    {"value":"expansive","label":"Expansiva","description":"Crece, conecta y abre posibilidades.","emoji":"🌅","visual_hint":"luminous"},
    {"value":"precise","label":"Precisa","description":"Ordenada, directa, con foco.","emoji":"🎯","visual_hint":"clear"}
  ]$movement$::jsonb,
  updated_at = now()
WHERE journey_type = 'brand' AND question_key = 'movement_energy';

-- 2. brand_limbic_base — atmospheres → multi_choice
UPDATE public.question_definitions
SET
  answer_type = 'multi_choice',
  question_text = '¿Qué atmósferas le quedan bien a esta marca?',
  help_text =
    'Escoge las que mejor expresen el mundo sensible de la marca. Luego podrás complementar con texto en futuras versiones.',
  options = $atmos$[
    {"value":"elegant_room","label":"Sala elegante","description":"Cuidado, sobriedad, confianza.","emoji":"🛋️","visual_hint":"sober"},
    {"value":"urban_motion","label":"Ciudad en movimiento","description":"Energía, velocidad, actualidad.","emoji":"🏙️","visual_hint":"urban_energy"},
    {"value":"intimate_conversation","label":"Conversación íntima","description":"Cercanía, escucha, humanidad.","emoji":"☕","visual_hint":"warm"},
    {"value":"lit_stage","label":"Escenario encendido","description":"Presencia, potencia, inspiración.","emoji":"🎤","visual_hint":"intense"},
    {"value":"clean_morning","label":"Mañana limpia","description":"Claridad, frescura, comienzo.","emoji":"🌤️","visual_hint":"fresh"},
    {"value":"open_horizon","label":"Horizonte abierto","description":"Expansión, futuro, posibilidad.","emoji":"🌅","visual_hint":"luminous"},
    {"value":"creative_workshop","label":"Taller creativo","description":"Construcción, oficio, colaboración.","emoji":"🛠️","visual_hint":"creative"}
  ]$atmos$::jsonb,
  updated_at = now()
WHERE journey_type = 'brand' AND question_key = 'atmospheres';

-- 3. brand_limbic_base — expressive_codes → multi_choice
UPDATE public.question_definitions
SET
  answer_type = 'multi_choice',
  question_text = '¿Qué códigos expresivos debería sostener la marca en el tiempo?',
  help_text =
    'Son señales de estilo que deben repetirse para que la marca se sienta consistente.',
  options = $expr$[
    {"value":"clarity","label":"Claridad","description":"Que se entienda sin esfuerzo.","emoji":"💡","visual_hint":"clear"},
    {"value":"fine_humor","label":"Humor fino","description":"Inteligente, sutil, nunca payaso.","emoji":"😉","visual_hint":"warm"},
    {"value":"authority","label":"Autoridad","description":"Criterio, experiencia, peso.","emoji":"🏛️","visual_hint":"sober"},
    {"value":"closeness","label":"Cercanía","description":"Humana, accesible, conversacional.","emoji":"🤝","visual_hint":"warm"},
    {"value":"precision","label":"Precisión","description":"Foco, método, palabras justas.","emoji":"🎯","visual_hint":"clear"},
    {"value":"elegance","label":"Elegancia","description":"Sobriedad, cuidado, buen gusto.","emoji":"◼️","visual_hint":"sober"},
    {"value":"energy","label":"Energía","description":"Movimiento, impulso, vitalidad.","emoji":"⚡","visual_hint":"intense"},
    {"value":"controlled_irreverence","label":"Irreverencia controlada","description":"Atrevimiento con criterio.","emoji":"🔥","visual_hint":"intense"}
  ]$expr$::jsonb,
  updated_at = now()
WHERE journey_type = 'brand' AND question_key = 'expressive_codes';

-- 4. service — client_experience_signature → multi_choice
UPDATE public.question_definitions
SET
  answer_type = 'multi_choice',
  question_text = '¿Qué debería sentir alguien durante el proceso de servicio?',
  help_text =
    'Escoge las sensaciones más importantes. Esta información ayuda a definir experiencia, tono y promesa.',
  options = $cx$[
    {"value":"order","label":"Orden","description":"Proceso claro, sin improvisación.","emoji":"🧭","visual_hint":"clear"},
    {"value":"speed","label":"Velocidad","description":"Respuesta ágil y sensación de avance.","emoji":"⚡","visual_hint":"urban_energy"},
    {"value":"calm","label":"Calma","description":"Confianza, control, tranquilidad.","emoji":"🌿","visual_hint":"soft_light"},
    {"value":"challenge","label":"Exigencia","description":"Reto, rigor, mejora constante.","emoji":"🏔️","visual_hint":"intense"},
    {"value":"play","label":"Juego","description":"Exploración, creatividad, disfrute.","emoji":"🎲","visual_hint":"creative"},
    {"value":"care","label":"Cuidado","description":"Acompañamiento atento y humano.","emoji":"🤲","visual_hint":"warm"},
    {"value":"confidence","label":"Confianza","description":"Seguridad de estar en buenas manos.","emoji":"🛡️","visual_hint":"sober"}
  ]$cx$::jsonb,
  updated_at = now()
WHERE journey_type = 'brand' AND question_key = 'client_experience_signature';

-- 5. service — recurrence (single_choice): enriquecer options para tarjetas
UPDATE public.question_definitions
SET
  options = $rec$[
    {"value":"one_off","label":"Mayormente puntual","description":"Proyectos o entregas aisladas, sin cadencia fija.","emoji":"📍","visual_hint":"clear"},
    {"value":"recurring","label":"Mayormente recurrente","description":"Relación o servicio que se renueva en el tiempo.","emoji":"🔁","visual_hint":"calm"},
    {"value":"both","label":"Mezcla según oferta","description":"Depende del cliente o del paquete contratado.","emoji":"⚖️","visual_hint":"urban_energy"}
  ]$rec$::jsonb,
  updated_at = now()
WHERE journey_type = 'brand' AND question_key = 'recurrence';

-- 6. experience_event — presence_format (single_choice)
UPDATE public.question_definitions
SET
  options = $pf$[
    {"value":"in_person","label":"Presencial","description":"La magia ocurre en espacio físico compartido.","emoji":"🎭","visual_hint":"warm"},
    {"value":"digital","label":"Digital","description":"Formato online, remoto o en plataforma.","emoji":"💻","visual_hint":"cool_clarity"},
    {"value":"hybrid","label":"Híbrido","description":"Combina momentos presenciales y digitales.","emoji":"🔗","visual_hint":"urban_energy"}
  ]$pf$::jsonb,
  updated_at = now()
WHERE journey_type = 'brand' AND question_key = 'presence_format';

-- 7. experience_event — frequency (single_choice)
UPDATE public.question_definitions
SET
  options = $freq$[
    {"value":"one_off","label":"Puntual / edición única","description":"Una vez o edición especial.","emoji":"✨","visual_hint":"luminous"},
    {"value":"seasonal","label":"Por temporadas","description":"Ciclos o ventanas al año.","emoji":"🗓️","visual_hint":"fresh"},
    {"value":"series","label":"Serie regular","description":"Se repite con ritmo predecible.","emoji":"📆","visual_hint":"clear"},
    {"value":"touring","label":"Itinerante","description":"Se mueve entre lugares o ciudades.","emoji":"🚐","visual_hint":"urban_energy"},
    {"value":"mixed","label":"Mix","description":"Combinación de formatos o cadencias.","emoji":"🔀","visual_hint":"creative"}
  ]$freq$::jsonb,
  updated_at = now()
WHERE journey_type = 'brand' AND question_key = 'frequency';

-- 8. product — price_band (single_choice)
UPDATE public.question_definitions
SET
  options = $price$[
    {"value":"premium","label":"Premium / alto","description":"Percibido como alto valor o inversión mayor.","emoji":"💎","visual_hint":"deep_focus"},
    {"value":"mid","label":"Medio","description":"En la franja intermedia frente a alternativas.","emoji":"⚖️","visual_hint":"cool_clarity"},
    {"value":"accessible","label":"Accesible","description":"Precio contenido o acceso amplio.","emoji":"🌱","visual_hint":"soft_light"},
    {"value":"mixed","label":"Depende del canal o línea","description":"Varía según producto, canal o segmento.","emoji":"🔀","visual_hint":"urban_energy"},
    {"value":"unsure","label":"Aún no lo tienen claro","description":"Están definiendo posicionamiento de precio.","emoji":"❔","visual_hint":"calm"}
  ]$price$::jsonb,
  updated_at = now()
WHERE journey_type = 'brand' AND question_key = 'price_band';
