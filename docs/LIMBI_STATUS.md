# Limbi — Estado del proyecto (vivo)

Documento de estado para alinear equipo y agentes. **Actualizar al cierre de sesiones** que cambien arquitectura, flujos o riesgos.

**Última revisión:** 2026-05-13 — Ticket 3A: UX cuestionario de marca; migración CHECK ampliado en `question_definitions`; Ticket 3B planificado (documentos / fuentes).

## Qué funciona (alto nivel)

- **Auth:** Supabase (login, signup, callback, middleware de rutas protegidas).
- **Marcas (Ticket 1):** `brands`, `brand_offer_profiles`, APIs `/api/brands`, UI lista/detalle básica.
- **Catálogo de preguntas de marca (Ticket 2):** migración `question_definitions`, seed en español neutro (LA), Base Límbica de Marca (`section_key` `brand_limbic_base`), módulos condicionales por `offer_nature`.
- **Cuestionario de marca — persistencia y UI (Tickets 3 + 3A):** tabla `brand_responses`; APIs de respuestas; `/brands/[brandId]/questionnaire` con intro orientadora, avance automático al guardar sección, cierre al terminar la última, redirección post–crear marca al cuestionario; `single_choice` / `multi_choice` con opciones como tarjetas (metadatos opcionales en `options`: `description`, `emoji`, `visual_hint`, `image_url`). Migración `20260514120000_question_definitions_answer_type_expand.sql` alinea CHECK del catálogo con tipos extensibles. **No incluye:** diagnóstico, documentos de marca (Ticket 3B), bases activas.
- **Proyectos:** CRUD básico vía API (`projects`, `project_responses`).
- **Intake conversacional:** `intake-turn` con extracción OpenAI y persistencia en `project_responses`.
- **Evaluación de cuestionario:** `evaluate-questionnaire` + almacenamiento (`questionnaire_evaluations`, campos en `project_responses`).
- **Aclaraciones post-diagnóstico:** flujo UI + API (`questionnaire-clarifications`, `questionnaire-clarification-coach`).
- **Documento maestro:** generación y validación (`generate-master`, `master_documents`).
- **Marco visible:** generación y aprobación (`generate-framework`, `visible_frameworks`).
- **Contenidos:** generación y refinamiento (`generate-content`, `generated-content`, refine).
- **Tests:** Vitest en lógica de negocio; build Next.js.

## Qué está en construcción / desalineado vs V2

- **Journey de Marca completo:** **no** está implementado. Tickets 1–3 aportan marca, catálogo, `brand_responses` y primera UI de cuestionario. Aún faltan, entre otras: `brand_evaluations`, `brand_improvement_sessions`, `brand_knowledge_bases`, `brand_limbic_bases`, **diagnóstico** de marca y **consolidación** en bases activas.
- **Proyecto anclado a marca:** `projects` sin `brand_id` ni referencias a bases de marca.
- **Cuestionario puro como primera captura:** en **marca** ya hay cuestionario por secciones (`/brands/[brandId]/questionnaire`); el flujo principal de **proyecto** sigue siendo conversacional hasta alinear V2.
- **Generación solo desde fuentes curadas V2:** hoy se usa maestro + marco aprobado, pero aún hay **fallback** a `project_responses` en el contexto de generación.
- **Tablas V2 en proyecto** (`project_master_documents`, `strategic_frameworks`, etc.): en parte cubiertas por nombres legacy (`master_documents`, `visible_frameworks`). **Tablas V2 del journey de marca** (`brand_knowledge_bases`, `brand_limbic_bases`, …): pendientes; no confundir con el catálogo `question_definitions`.

## Obsoleto o deuda explícita (respecto a V2)

- Modelo **todo-en-proyecto** con capa de marca **incompleta**: hay `brands`, `brand_offer_profiles` y `brand_responses`, pero sin evaluación/diagnóstico de marca ni bases activas (`brand_knowledge_bases`, `brand_limbic_bases`) en DB.
- Evaluación/aclaraciones acopladas al mismo agregado `project_responses` (JSON grande) además de tablas dedicadas.
- Archivos duplicados con sufijo ` 2` en rutas/páginas (limpieza pendiente).
- Intake conversacional como **sustituto** del cuestionario puro V2 (a redefinir o relegar a fase posterior).

## Riesgos conocidos

- **Regresión de auth/RLS** si se alteran políticas sin revisión.
- **Contrato de prompts** si se renombran campos del maestro/marco sin actualizar prompts y validadores JSON.
- **Expectativa de usuario:** mezcla “marca en proyecto” en copy/UI vs separación V2.

## Qué sigue (recomendado, sin ejecutar aquí)

1. Congelar documentación V2 (`/docs`) como referencia.
2. **Ticket 3B** (documentos de marca y `brand_source_facts`) antes del diagnóstico completo; luego evaluaciones, sesiones de mejora, `brand_knowledge_bases`, `brand_limbic_bases`, diagnóstico y expertos por sección; anclar `projects` con `brand_id` cuando corresponda.
3. Normalizar `project_responses` hacia filas o JSON con `section_key` / `module_key` / `question_key`.
4. Reducir y eliminar `responses_fallback` en generación cuando el maestro + bases marca sean completos.
5. Renombrar o mapear `master_documents` → `project_master_documents` y `visible_frameworks` → `strategic_frameworks` con plan de compatibilidad.

## Decisiones recientes

- **Ticket 1:** migraciones `brands` y `brand_offer_profiles` (RLS, APIs, UI básica de marcas).
- **Ticket 2:** `GET /api/question-definitions?journey_type=brand&offer_nature=…` devuelve solo filas `is_active = true`, ordenadas por `display_order`; el filtro `offer_nature` aplica núcleo (`applies_to` nulo) + módulos cuyo JSON incluye esa naturaleza. Agrupación por sección: `lib/questions/get-brand-question-definitions.ts`.
- **Ticket 3:** `PATCH /api/brands/[brandId]/responses` hace upsert por `(brand_id, question_key)`; el servidor rellena metadatos desde `question_definitions` y solo acepta preguntas activas aplicables al `offer_nature` de la marca. Contrato de `answer_value`: texto/url/textarea `{ "text" }`, `single_choice` `{ "value" }`, `multi_choice` `{ "values" }`, etc. (`lib/brand-answers/*`).
- **Ticket 3A:** UX del journey de marca (sin IA): redirección `/brands/new` → `/brands/[id]/questionnaire`; guardar sección → siguiente sección o pantalla de cierre; opciones visuales; intro al inicio.
- **Propuesta de seed (no aplicada aún):** en módulo **service**, `client_experience_signature` (hoy textarea: “¿Qué debería sentir alguien en el proceso…?”) encaja como **`single_choice` o `multi_choice`** con opciones etiquetadas (orden, rapidez, calma, exigencia, cercanía, rigor, juego, etc.) y metadatos `description` / `visual_hint` para tarjetas; valorar un campo libre corto solo si hace falta “otro”. Otras candidatas a revisar con calma (no cambiadas): `delivery_mode` (presencial/remoto/híbrido) como multi + texto corto; límbicas ya en `textarea` salvo `emotional_temperature` (ya `single_choice`). **No** tocar el seed en bloque sin revisar copy y pesos por pregunta.

## Ticket 3B planificado (documentos de marca / material de contexto)

**Orden:** después de Ticket 3A y **antes** del diagnóstico completo de marca.

**Objetivo:** bloque “Material de contexto” en el journey de marca: subida de PDF (y otros tipos acordados), análisis con IA, extracción clasificada por `section_key`, revisión humana (aprobar / editar / rechazar), persistencia solo de hechos aprobados para uso posterior en diagnóstico y bases — **sin** mezclar PDF crudo en generación ni usar datos sin aprobación.

**Tablas sugeridas:** `brand_documents` (archivo, `storage_path`, `processing_status`, …), `brand_source_facts` (`section_key`, `fact_text`, `ai_interpretation`, `status`: pending_review / approved / rejected / superseded, …).

**Criterios de aceptación (resumen):** subir al menos PDF por marca; IA extrae y clasifica; UI por sección con acciones Incluir / Editar / Descartar; solo aprobados alimentan diagnóstico y bases; no tocar generación de contenidos de proyecto ni intake conversacional.

---

*Mantener este archivo breve y accionable; el detalle vive en ADRs y en `LIMBI_DATA_ARCHITECTURE_V2.md`.*
