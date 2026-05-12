# Limbi — Estado del proyecto (vivo)

Documento de estado para alinear equipo y agentes. **Actualizar al cierre de sesiones** que cambien arquitectura, flujos o riesgos.

**Última revisión:** 2026-05-12 — **Journey de marca:** **Tickets 4+F** (diagnóstico v2), **5+G** (mejora por sección v2) y **Ticket H** (consolidación en **`brand_knowledge_bases`** y **`brand_limbic_bases`**) están en código. Otros pendientes transversales: `force` / reanálisis explícito, cola async de análisis, ejecución del reset, website crawling, proyectos/generación alineados a bases marca. **Ticket E:** análisis documental `brand-document-analysis-v2.0` (`lib/schemas/brand-document-analysis.ts`, `lib/prompts/brand-document-analysis.ts`); hallazgos solo como `brand_source_facts` pendientes de revisión; sin escritura desde PDFs en `brand_responses`, `brand_offer_items` ni `brand_audience_territories`; dedupe frente a inventario/territorios; negativos/restricciones y Base Límbica simbólica en prompt. **Ticket B:** migración `20260523120000_ticket_b_brand_journey_question_definitions.sql` (catálogo `question_definitions` activo nuevo; filas viejas `is_active = false`); sin `brand_type` en respuestas; oferta/territorios fuera del catálogo (tablas estructuradas); sin `context_sources_note`; Base Límbica 5 señales; `exclusive` donde aplica. **Tickets C / C.1:** UI cuestionario, oferta/territorios en tablas, “Otro” en `answer_value`, pulido UX. **Ticket A:** `brand_offer_items`, `brand_audience_territories`, script `scripts/reset-brand-captured-data.mjs` (no ejecutar reset salvo decisión explícita).

## Qué funciona (alto nivel)

- **Auth:** Supabase (login, signup, callback, middleware de rutas protegidas).
- **Marcas (Ticket 1):** `brands`, `brand_offer_profiles`, APIs `/api/brands`, UI lista/detalle básica.
- **Catálogo de preguntas de marca (Ticket 2 + Ticket B):** migración `question_definitions`; **Ticket B** renueva el seed de marca (filas viejas `is_active = false`). Español neutro (LA); Base Límbica con 5 señales; sin `brand_type` en respuestas del catálogo; oferta y territorios fuera del catálogo (tablas estructuradas).
- **Cuestionario de marca — persistencia y UI (Tickets 3 + 3A):** tabla `brand_responses`; APIs de respuestas; `/brands/[brandId]/questionnaire` con intro orientadora, avance automático al guardar sección, cierre al terminar la última, redirección post–crear marca al cuestionario; `single_choice` / `multi_choice` con opciones como tarjetas (metadatos opcionales en `options`: `description`, `emoji`, `visual_hint`, `image_url`, `image_key`, `exclusive`). Migración `20260514120000_question_definitions_answer_type_expand.sql` alinea CHECK del catálogo con tipos extensibles.
- **Documentos de marca (Tickets 3B.1–3B.3 + Ticket E):** tabla `brand_documents`, bucket **`brand-documents`**, extracción (`brand_document_extractions`, `pdf-parse`), análisis consolidado `POST /api/brands/[brandId]/documents/analyze` (síncrono, `maxDuration` 120s, runtime Node), tablas `brand_document_analysis_batches`, `brand_document_analysis_runs`, **`brand_source_facts`** con revisión (`GET`/`PATCH /api/brands/[brandId]/source-facts`), UI “Analizar documentos” + bandeja `/brands/[brandId]/source-facts` agrupada por `section_key` con etiquetas humanas (`questionnaire-section-labels`). **Ticket E:** prompt `brand-document-analysis-v2.0` alineado al catálogo activo de `question_definitions`; contexto de usuario incluye `brand_offer_items` y `brand_audience_territories` para dedupe; negativos como restricciones; Base Límbica como señal simbólica; sin inserts automáticos en tablas estructuradas desde PDFs. Si hay `pending_review`, no se lanza un nuevo análisis (409 / CTA a revisar). **No** se modifica `brand_responses`; **no** se muestra `extracted_text` completo en UI. Solo `brand_source_facts.status = 'approved'` alimenta el diagnóstico y la consolidación de bases (**Ticket H**).
- **Diagnóstico de marca (Tickets 4 + F):** tabla **`brand_evaluations`** (migración `20260520120000_brand_evaluations.sql`); `lib/brands/build-brand-diagnosis-context.ts` arma `evaluation_context` **`brand-diagnosis-context-v2.0`** con `brand_offer_profiles.offer_nature`, `structured_offer_items`, `structured_audience_territories`, `scoring_policy`; `brand_responses` solo del catálogo activo; `brand_source_facts` solo `approved`; `brand_section_improvements` aprobadas+activas con prioridad en contexto; prompt **`brand-diagnosis-v2.0`**; scoring según obligatorias + datos estructurados esenciales; `applyOptionalEmptinessSectionScoreFloors` para no castigar duro por opcionales vacías; UI con vacíos esenciales vs `depth_opportunities`, riesgos como restricciones, etiquetas humanas (sin mostrar `section_key` al usuario); `source_snapshot` con metadatos; staleness ante cambios en respuestas, oferta/territorios, `offer_nature`, `brands.updated_at`, cualquier `updated_at` en `brand_source_facts` y mejoras aprobadas. API `GET`/`POST /api/brands/[brandId]/diagnosis` y UI `/brands/[brandId]/diagnosis`.
- **Mejora por sección (Tickets 5 + G):** migración `20260521120000_brand_section_improvements.sql`; tablas `brand_improvement_sessions`, `brand_improvement_messages`, `brand_section_improvements`; sesión con IA (OpenAI strict + Zod), borrador y aprobación (**Ticket 5:** una mejora activa por `section_key`, anteriores `superseded`). **Ticket G:** contexto **`brand-section-improve-context-v2.0`**, prompt **`brand-section-improvement-v2.0`**, mismas reglas de fuentes limpias que el diagnóstico (perfil, inventario, territorios, respuestas filtradas, facts aprobados, trozo de diagnóstico de sección con `depth_opportunities`, `scoring_policy`, `structured_context_note`); esencial vs opcional, negativos como restricciones, Base Límbica simbólica; aprobación enriquece `payload` (p. ej. resumen, trazas, `should_mark_as_ready_for_consolidation`) **sin** escribir en `brand_responses`, `brand_offer_items` ni `brand_audience_territories`; actualiza `brands.updated_at` al aprobar. UI `/brands/[brandId]/improve/[sectionKey]` con etiqueta humana, lectura de diagnóstico por sección e inventario/territorios; APIs `/api/brands/[brandId]/improve/...`.
- **Rediseño Journey de Marca — Ticket A:** migración `20260522120000_brand_structured_offer_and_territories.sql` agrega `brand_offer_items` (inventario repetible de oferta) y `brand_audience_territories` (territorios repetibles), con RLS por ownership de `brands`. Script `scripts/reset-brand-captured-data.mjs` permite reset controlado de datos capturados de prueba con `CONFIRM_RESET_BRAND_CAPTURED_DATA=true` + `RESET_BRAND_IDS` o `RESET_BRAND_USER_EMAIL`; por defecto conserva `brands` y `brand_offer_profiles`, y solo borra marcas si `DELETE_BRANDS=true`.
- **Bases curadas de marca (Ticket H):** migración `20260526120000_brand_knowledge_and_limbic_bases.sql` — tablas **`brand_knowledge_bases`** y **`brand_limbic_bases`** con RLS por ownership, `status` (`running` / `succeeded` / `failed`), `consolidation_run_id` para emparejar pares, `is_active` + `superseded_at` e índice único parcial **una base activa por marca** en cada tabla. Contexto **`brand-base-consolidation-context-v1.0`** vía `lib/brands/build-brand-base-consolidation-context.ts` (reutiliza el bundle del diagnóstico sin `scoring_policy`, suma `consolidation_policy` y resumen de **`brand_evaluations`** activo v2); mismas exclusiones de fuentes crudas que diagnóstico; bloqueo si hay `pending_review` o sin diagnóstico activo; `POST /api/brands/[brandId]/bases/consolidate` (OpenAI strict + Zod `brand-base-consolidation-v1.0`) inserta dos filas `running` (no activas), y solo al éxito desactiva actives previas y marca la nueva pareja como `succeeded` + activa. `GET /api/brands/[brandId]/bases` y UI `/brands/[brandId]/bases`; tarjeta en dashboard de marca (`fetch-brand-dashboard-bases-state.ts`); staleness en `lib/brands/brand-bases-staleness.ts` ante cambios en marca, perfil, oferta/territorios, respuestas, facts (cualquier `updated_at`), mejoras aprobadas posteriores y **diagnóstico activo más nuevo** que la base. Variable opcional `OPENAI_BRAND_BASE_CONSOLIDATION_MODEL`.
- **Rediseño Journey de Marca — Ticket B:** migración `20260523120000_ticket_b_brand_journey_question_definitions.sql` (catálogo activo nuevo; ver párrafo de última revisión).
- **Proyectos:** CRUD básico vía API (`projects`, `project_responses`).
- **Intake conversacional:** `intake-turn` con extracción OpenAI y persistencia en `project_responses`.
- **Evaluación de cuestionario:** `evaluate-questionnaire` + almacenamiento (`questionnaire_evaluations`, campos en `project_responses`).
- **Aclaraciones post-diagnóstico:** flujo UI + API (`questionnaire-clarifications`, `questionnaire-clarification-coach`).
- **Documento maestro:** generación y validación (`generate-master`, `master_documents`).
- **Marco visible:** generación y aprobación (`generate-framework`, `visible_frameworks`).
- **Contenidos:** generación y refinamiento (`generate-content`, `generated-content`, refine).
- **Tests:** Vitest en lógica de negocio; build Next.js.

## Qué está en construcción / desalineado vs V2

- **Journey de Marca completo:** parcial. Tickets 1–5 y **H** cubren marca, catálogo, `brand_responses`, documentos + `brand_source_facts`, diagnóstico (**4+F**), mejora por sección (**5+G**) y bases curadas (**H**); **Tickets A/B/E** estructuran catálogo, oferta/territorios y análisis documental. Pendiente: anclar generación de proyecto a estas bases y `brand_id` en `projects`.
- **Proyecto anclado a marca:** `projects` sin `brand_id` ni consumo de bases de marca en generación.
- **Cuestionario puro como primera captura:** en **marca** ya hay cuestionario por secciones (`/brands/[brandId]/questionnaire`); el flujo principal de **proyecto** sigue siendo conversacional hasta alinear V2.
- **Generación solo desde fuentes curadas V2:** hoy se usa maestro + marco aprobado, pero aún hay **fallback** a `project_responses` en el contexto de generación.
- **Tablas V2 en proyecto** (`project_master_documents`, `strategic_frameworks`, etc.): en parte cubiertas por nombres legacy (`master_documents`, `visible_frameworks`). **Tablas del journey de marca** para bases curadas: `brand_knowledge_bases` y `brand_limbic_bases` (**Ticket H**); no confundir con el catálogo `question_definitions`.

## Obsoleto o deuda explícita (respecto a V2)

- Modelo **todo-en-proyecto** con capa de marca aún **incompleta** respecto a generación: hay `brands`, `brand_offer_profiles`, `brand_responses`, diagnóstico (**4+F**), mejora (**5+G**), oferta/territorios estructurados y bases curadas (**H**); falta cablear generación de proyecto a `brand_knowledge_bases` / `brand_limbic_bases`.
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
- **Ticket 3B.3:** migración `20260519100000_brand_document_analysis_and_source_facts.sql`; `OPENAI_BRAND_DOCUMENT_ANALYSIS_MODEL` opcional; contrato JSON `analysis_result` / `no_useful_findings`.
- **Ticket E (análisis documental, taxonomía nueva):** `brand-document-analysis-v2.0`; dedupe frente a `brand_offer_items` y `brand_audience_territories`; reglas de restricción/negativo y Base Límbica simbólica en prompt; sin cambios a diagnóstico ni mejora por sección en este ticket.
- **Ticket F + Ticket 4 (diagnóstico de marca):** implementación unificada en el bullet *Diagnóstico de marca (Tickets 4 + F)* de *Qué funciona* (`brand-diagnosis-v2.0`, `brand-diagnosis-context-v2.0`, `brand_evaluations`).
- **Ticket G + Ticket 5 (mejora por sección):** implementación unificada en el bullet *Mejora por sección (Tickets 5 + G)* de *Qué funciona* (`brand-section-improvement-v2.0`, `brand-section-improve-context-v2.0`, tablas de sesión y `brand_section_improvements`).
- **Ticket H (bases curadas de marca):** migración `20260526120000_brand_knowledge_and_limbic_bases.sql`; APIs `GET /api/brands/[brandId]/bases`, `POST .../bases/consolidate`; prompt `brand-base-consolidation-v1.0`; contexto `brand-base-consolidation-context-v1.0`; tests en `lib/brands/brand-bases-staleness.test.ts`.
- **Ticket A rediseño Journey de Marca:** `brand_offer_items` y `brand_audience_territories` para datos repetibles; reset seguro de datos capturados de prueba. `offer_nature` sigue viviendo en `brand_offer_profiles`, no en `brand_responses`. No se desactiva ni reemplaza el seed viejo todavía.

## Ticket 3B planificado (documentos de marca / material de contexto)

**Hecho (3B.1):** `brand_documents` + bucket `brand-documents` + upload/listado/eliminar.

**Hecho (3B.2):** extracción técnica con `pdf-parse` → `brand_document_extractions`; sincronía de `processing_status`; UI solo estado/resumen (no texto completo).

**Hecho (3B.3):** análisis IA por documento dentro de un batch consolidado; contrato JSON `analysis_result`: `findings_found` | `no_useful_findings` (v1.1); si `no_useful_findings`, `findings` vacío y **no** se insertan filas en `brand_source_facts`; batch puede quedar `succeeded` con `findings_count = 0` (resultado válido, no error). Hallazgos en `brand_source_facts` solo cuando hay contenido útil; límites 5 por `section_key` y 25 total **sin forzar** el máximo; dedupe servidor + facts `approved`; bloqueo si existe `pending_review`; documentos con facts `approved` o `pending_review` omitidos; riesgos/tensiones como `restriction` / `other`. **No:** cola externa, `force`, chat ni preguntas automáticas desde el análisis.

**Pendiente (3B.4+):** reanálisis explícito de documentos; async / polling si hace falta. **Ticket H (bases curadas)** está implementado (ver *Qué funciona* y *Decisiones recientes*).

**Criterios futuros (resumen):** diagnóstico marca; no tocar generación de proyecto ni intake conversacional hasta alinear fuentes curadas.

---

*Mantener este archivo breve y accionable; el detalle vive en ADRs y en `LIMBI_DATA_ARCHITECTURE_V2.md`.*
