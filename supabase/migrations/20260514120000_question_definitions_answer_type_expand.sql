-- Alinear `question_definitions.answer_type` con el superconjunto de `brand_responses` (p. ej. multi_choice) sin nuevos tipos “visuales”.

ALTER TABLE public.question_definitions
  DROP CONSTRAINT IF EXISTS question_definitions_answer_type_check;

ALTER TABLE public.question_definitions
  ADD CONSTRAINT question_definitions_answer_type_check
  CHECK (
    answer_type IN (
      'text',
      'textarea',
      'single_choice',
      'multi_choice',
      'scale',
      'url',
      'number',
      'boolean'
    )
  );
