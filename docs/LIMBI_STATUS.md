# Limbi — Estado del proyecto (vivo)

Documento de estado para alinear equipo y agentes. **Actualizar al cierre de sesiones** que cambien arquitectura, flujos o riesgos.

**Última revisión:** 2026-05-20 — **Ticket 4:** diagnóstico de marca (`brand_evaluations`), `GET`/`POST /api/brands/[brandId]/diagnosis`, UI `/brands/[brandId]/diagnosis`. Fuentes: `brands`, `brand_offer_profiles`, `question_definitions` aplicables, `brand_responses`, **solo** `brand_source_facts.status = approved`; sin `extracted_text`, sin runs/extracciones como contenido, sin proyectos. `pending_review` **bloquea** POST (409 `pending_review_blocking`). Salida IA con **Structured Outputs** (`json_schema` strict) + Zod + recalculo servidor de `quality_level` desde scores. Una fila activa por marca (`is_active` + `superseded_at`). **No:** `brand_knowledge_bases`, `brand_limbic_bases`, chat de mejora, regenerar/historial en v1.

## Qué funciona (alto nivel)

- **Auth:** Supabase (login, signup, callback, middleware de rutas protegidas).
- **Marcas (Ticket 1):** `brands`, `brand_offer_profiles`, APIs `/api/brands`, UI lista/detalle básica.
- **Catálogo de preguntas de marca (Ticket 2):** migración `question_definitions`, seed en español neutro (LA), Base Límbica de Marca (`section_key` `brand_limbic_base`), módulos condicionales por `offer_nature`.
- **Cuestionario de marca — persistencia y UI (Tickets 3 + 3A):** tabla `brand_responses`; APIs de respuestas; `/brands/[brandId]/questionnaire` con intro orientadora, avance automático al guardar sección, cierre al terminar la última, redirección post–crear marca al cuestionario; `single_choice` / `multi_choice` con opciones como tarjetas (metadatos opcionales en `options`: `description`, `emoji`, `visual_hint`, `image_url`). Migración `20260514120000_question_definitions_answer_type_expand.sql` alinea CHECK del catálogo con tipos extensibles.
- **Documentos de marca (Tickets 3B.1–3B.3):** tabla `brand_documents`, bucket **`brand-documents`**, extracción (`brand_document_extractions`, `pdf-parse`), análisis consolidado `POST /api/brands/[brandId]/documents/analyze` (síncrono, `maxDuration` 120s, runtime Node), tablas `brand_document_analysis_batches`, `brand_document_analysis_runs`, **`brand_source_facts`** con revisión (`GET`/`PATCH /api/brands/[brandId]/source-facts`), UI “Analizar documentos” + bandeja `/brands/[brandId]/source-facts` agrupada por `section_key`. Si hay `pending_review`, no se lanza un nuevo análisis (409 / CTA a revisar). **No** se modifica `brand_responses`; **no** se muestra `extracted_text` completo en UI. **Aún no:** consolidación en `brand_knowledge_bases` / `brand_limbic_bases`, `force` / reanálisis explícito, cola async de análisis.
- **Diagnóstico de marca (Ticket 4):** tabla **`brand_evaluations`** (migración `20260520120000_brand_evaluations.sql`); contexto `evaluation_context` vía `lib/brands/build-brand-diagnosis-context.ts` (sin `material_context` en secciones evaluadas); `source_snapshot` solo metadatos/conteos/hash, sin duplicar respuestas sensibles. UI y API arriba.
- **Proyectos:** CRUD básico vía API (`projects`, `project_responses`).
- **Intake conversacional:** `intake-turn` con extracción OpenAI y persistencia en `project_responses`.
- **Evaluación de cuestionario:** `evaluate-questionnaire` + almacenamiento (`questionnaire_evaluations`, campos en `project_responses`).
- **Aclaraciones post-diagnóstico:** flujo UI + API (`questionnaire-clarifications`, `questionnaire-clarification-coach`).
- **Documento maestro:** generación y validación (`generate-master`, `master_documents`).
- **Marco visible:** generación y aprobación (`generate-framework`, `visible_frameworks`).
- **Contenidos:** generación y refinamiento (`generate-content`, `generated-content`, refine).
- **Tests:** Vitest en lógica de negocio; build Next.js.

## Qué está en construcción / desalineado vs V2

- **Journey de Marca completo:** parcial. Tickets 1–4 cubren marca, catálogo, `brand_responses`, documentos + `brand_source_facts` y **`brand_evaluations` (diagnóstico)**. Aún faltan, entre otras: `brand_improvement_sessions`, `brand_knowledge_bases`, `brand_limbic_bases`, **consolidación** en bases activas, mejora por sección con experto.
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
- **Ticket 3A.1:** migración `20260515120000_ticket_3a1_question_definitions_visual_seed.sql` — `movement_energy`, `atmospheres`, `expressive_codes` y `client_experience_signature` pasan a `multi_choice` con opciones ricas; `recurrence`, `presence_format`, `frequency`, `price_band` mantienen `single_choice` con opciones enriquecidas para tarjetas.
- **Ticket 3B.1:** migración `20260516120000_brand_documents_and_storage.sql`; políticas Storage por prefijo `auth.uid()` en la ruta del objeto.
- **Ticket 3B.2:** migración `20260518120000_brand_document_extractions.sql`; `pdf-parse` (runtime Node en la ruta de extracción); `serverExternalPackages` para el bundler.
- **Ticket 3B.3:** migración `20260519100000_brand_document_analysis_and_source_facts.sql`; `OPENAI_BRAND_DOCUMENT_ANALYSIS_MODEL` opcional; prompt `brand-document-analysis-v1.1` (incluye `analysis_result` / `no_useful_findings`).

## Ticket 3B planificado (documentos de marca / material de contexto)

**Hecho (3B.1):** `brand_documents` + bucket `brand-documents` + upload/listado/eliminar.

**Hecho (3B.2):** extracción técnica con `pdf-parse` → `brand_document_extractions`; sincronía de `processing_status`; UI solo estado/resumen (no texto completo).

**Hecho (3B.3):** análisis IA por documento dentro de un batch consolidado; contrato JSON `analysis_result`: `findings_found` | `no_useful_findings` (v1.1); si `no_useful_findings`, `findings` vacío y **no** se insertan filas en `brand_source_facts`; batch puede quedar `succeeded` con `findings_count = 0` (resultado válido, no error). Hallazgos en `brand_source_facts` solo cuando hay contenido útil; límites 5 por `section_key` y 25 total **sin forzar** el máximo; dedupe servidor + facts `approved`; bloqueo si existe `pending_review`; documentos con facts `approved` o `pending_review` omitidos; riesgos/tensiones como `restriction` / `other`. **No:** cola externa, `force`, chat ni preguntas automáticas desde el análisis.

**Pendiente (3B.4+):** consolidación en bases activas, diagnóstico de marca consumiendo solo `approved` + `brand_responses`, reanálisis explícito, async / polling si hace falta.

**Criterios futuros (resumen):** diagnóstico marca; no tocar generación de proyecto ni intake conversacional hasta alinear fuentes curadas.

---

*Mantener este archivo breve y accionable; el detalle vive en ADRs y en `LIMBI_DATA_ARCHITECTURE_V2.md`.*
