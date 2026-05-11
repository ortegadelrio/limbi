# Limbi — Estado del proyecto (vivo)

Documento de estado para alinear equipo y agentes. **Actualizar al cierre de sesiones** que cambien arquitectura, flujos o riesgos.

**Última revisión:** 2026-05-12 — Alineación del estado del Journey de Marca (Tickets 1–2 vs tablas y UI pendientes).

## Qué funciona (alto nivel)

- **Auth:** Supabase (login, signup, callback, middleware de rutas protegidas).
- **Marcas (Ticket 1):** `brands`, `brand_offer_profiles`, APIs `/api/brands`, UI lista/detalle básica.
- **Catálogo de preguntas de marca (Ticket 2):** migración `question_definitions`, seed en español neutro (LA), Base Límbica de Marca (`section_key` `brand_limbic_base`), módulos condicionales por `offer_nature`. **Solo catálogo:** sin formulario visual ni persistencia de respuestas en este ticket.
- **Proyectos:** CRUD básico vía API (`projects`, `project_responses`).
- **Intake conversacional:** `intake-turn` con extracción OpenAI y persistencia en `project_responses`.
- **Evaluación de cuestionario:** `evaluate-questionnaire` + almacenamiento (`questionnaire_evaluations`, campos en `project_responses`).
- **Aclaraciones post-diagnóstico:** flujo UI + API (`questionnaire-clarifications`, `questionnaire-clarification-coach`).
- **Documento maestro:** generación y validación (`generate-master`, `master_documents`).
- **Marco visible:** generación y aprobación (`generate-framework`, `visible_frameworks`).
- **Contenidos:** generación y refinamiento (`generate-content`, `generated-content`, refine).
- **Tests:** Vitest en lógica de negocio; build Next.js.

## Qué está en construcción / desalineado vs V2

- **Journey de Marca completo:** **no** está implementado. Ticket 1 aportó `brands` y `brand_offer_profiles`; Ticket 2 aportó `question_definitions` con seed para `journey_type=brand`. Aún faltan, entre otras: `brand_responses`, `brand_evaluations`, `brand_improvement_sessions`, `brand_knowledge_bases`, `brand_limbic_bases`, más **UI de cuestionario** y **diagnóstico** de marca.
- **Proyecto anclado a marca:** `projects` sin `brand_id` ni referencias a bases de marca.
- **Cuestionario puro como primera captura:** el flujo principal actual es conversacional; V2 exige cuestionario puro por secciones para marca y proyecto (el catálogo `question_definitions` prepara el contenido, no el flujo).
- **Generación solo desde fuentes curadas V2:** hoy se usa maestro + marco aprobado, pero aún hay **fallback** a `project_responses` en el contexto de generación.
- **Tablas V2 en proyecto** (`project_master_documents`, `strategic_frameworks`, etc.): en parte cubiertas por nombres legacy (`master_documents`, `visible_frameworks`). **Tablas V2 del journey de marca** (`brand_knowledge_bases`, `brand_limbic_bases`, …): pendientes; no confundir con el catálogo `question_definitions`.

## Obsoleto o deuda explícita (respecto a V2)

- Modelo **todo-en-proyecto** con capa de marca **incompleta**: ya existen `brands` / `brand_offer_profiles`, pero sin persistencia del cuestionario ni bases activas de marca en DB.
- Evaluación/aclaraciones acopladas al mismo agregado `project_responses` (JSON grande) además de tablas dedicadas.
- Archivos duplicados con sufijo ` 2` en rutas/páginas (limpieza pendiente).
- Intake conversacional como **sustituto** del cuestionario puro V2 (a redefinir o relegar a fase posterior).

## Riesgos conocidos

- **Regresión de auth/RLS** si se alteran políticas sin revisión.
- **Contrato de prompts** si se renombran campos del maestro/marco sin actualizar prompts y validadores JSON.
- **Expectativa de usuario:** mezcla “marca en proyecto” en copy/UI vs separación V2.

## Qué sigue (recomendado, sin ejecutar aquí)

1. Congelar documentación V2 (`/docs`) como referencia.
2. Completar el journey de marca en DB y producto: `brand_responses`, evaluaciones, sesiones de mejora, `brand_knowledge_bases`, `brand_limbic_bases`, UI de cuestionario y diagnóstico; anclar `projects` con `brand_id` cuando corresponda.
3. Normalizar `project_responses` hacia filas o JSON con `section_key` / `module_key` / `question_key`.
4. Reducir y eliminar `responses_fallback` en generación cuando el maestro + bases marca sean completos.
5. Renombrar o mapear `master_documents` → `project_master_documents` y `visible_frameworks` → `strategic_frameworks` con plan de compatibilidad.

## Decisiones recientes

- **Ticket 1:** migraciones `brands` y `brand_offer_profiles` (RLS, APIs, UI básica de marcas).
- **Ticket 2:** `GET /api/question-definitions?journey_type=brand&offer_nature=…` devuelve solo filas `is_active = true`, ordenadas por `display_order`; el filtro `offer_nature` aplica núcleo (`applies_to` nulo) + módulos cuyo JSON incluye esa naturaleza. Agrupación por sección: `lib/questions/get-brand-question-definitions.ts`.

---

*Mantener este archivo breve y accionable; el detalle vive en ADRs y en `LIMBI_DATA_ARCHITECTURE_V2.md`.*
