# Tickets internos — Journey de Marca (fases pequeñas)

Tickets verificables; no implementar todo de una vez.

---

## TICKET 1 — Modelo mínimo de Marca (actual)

**Objetivo:** Entidad `Marca` separada de `Proyecto`, con clasificación `offer_nature`, API mínima y rutas `/brands` + `/brands/new`.

**Archivos previstos:** ver desglose en la respuesta del agente / sección “Ticket 1” del plan (migración, `types/database.ts`, API, páginas, componentes, `dashboard-nav`, `middleware`).

**Criterios de aceptación:** (lista acordada en chat: crear marca, RLS por usuario, `offer_nature` en 7 valores, nav “Marcas”, listado y alta, sin cuestionario ni proyecto, sin borrado de data salvo necesario, build verde).

---

## TICKET 2 — `brand_responses` + guardado de cuestionario (sin UI completa opcional)

**Objetivo:** Persistir respuestas del cuestionario puro de marca (modelo normalizado o fila JSON acordada).

**Archivos:** migración, API GET/PATCH respuestas, tipos, tests mínimos.

**Aceptación:** Guardar y releer respuestas por marca; RLS correcto; sin tocar proyectos.

---

## TICKET 3 — `question_definitions` + seed `journey_type = brand`

**Objetivo:** Catálogo de preguntas para armar el cuestionario por secciones y `offer_nature`.

**Archivos:** migración `question_definitions`, seed SQL o TS, API opcional GET definiciones.

**Aceptación:** Al menos núcleo común + un módulo condicional en datos de prueba; render mínimo opcional en ticket aparte.

---

## TICKET 4 — UI cuestionario puro de marca (por secciones)

**Objetivo:** `/brands/[brandId]/questionnaire` sin intake conversacional como captura principal.

**Archivos:** shell de secciones, bloques de pregunta, progreso.

**Aceptación:** Usuario completa secciones leyendo de `question_definitions`; guarda vía API del ticket 2.

---

## TICKET 5 — `brand_evaluations` + evaluar marca

**Objetivo:** Diagnóstico IA con contexto ordenado; persistir en `brand_evaluations`.

**Archivos:** migración, `lib/openai`, `lib/prompts`, ruta POST evaluate, pantalla diagnosis.

**Aceptación:** Una evaluación activa por versión acordada; canon editorial respetado.

---

## TICKET 6 — `brand_improvement_sessions` + mejora por sección

**Objetivo:** Experto acotado a `section_key`; no reabrir toda la marca.

**Archivos:** migración, API, UI mejora.

**Aceptación:** Aprobación escribe `approved_changes` y prepara siguiente consolidación (sin obligar consolidación en el mismo ticket si se divide).

---

## TICKET 7 — `brand_knowledge_bases` + consolidación activa

**Objetivo:** Versión activa de base de conocimiento de marca.

**Archivos:** migración, prompt + API consolidate, vista lectura.

**Aceptación:** Una fila activa por marca (unique partial); versionado básico.

---

## TICKET 8 — `brand_limbic_bases` + consolidación activa

**Objetivo:** Igual que ticket 7 para universo sensible.

**Archivos:** migración, prompt + API, vista lectura.

**Aceptación:** Una activa por marca; símbolos no literales en instrucciones.

---

## TICKET 9 — `brand_documents` + `brand_source_facts` (fuentes)

**Objetivo:** Subida/metadata y hechos con `pending_review` / `approved`.

**Archivos:** migración, storage si aplica, API mínima.

**Aceptación:** No alimentar generación hasta aprobación (cuando exista generación marca).

---

## TICKET 10 — Fase 2: `projects.brand_id` NOT NULL + reset acordado

**Objetivo:** Proyecto obligatoriamente ligado a marca; política sin compat compleja con data vieja.

**Archivos:** migración FK + truncates documentados en dev, `types/database.ts`, APIs.

**Aceptación:** No crear proyecto sin marca; build verde.

---

## TICKET 11 — Fase 2: UI picker marca + bloqueo sin marcas

**Objetivo:** `/projects/new` exige marca; CTA a `/brands/new` si vacío.

**Archivos:** wizard o página new project, componente picker.

**Aceptación:** Criterios de producto acordados; sin refactor de generación.

---

## TICKET 12 — Fase 2: Cargar bases activas en contexto de proyecto (solo lectura)

**Objetivo:** Helpers servidor para `brand_knowledge_bases` / `brand_limbic_bases` activas al abrir proyecto (sin cambiar prompts de contenido aún).

**Archivos:** `lib/brands/*` o `lib/projects/*`, uso en detalle proyecto.

**Aceptación:** Datos visibles o en payload debug interno; sin nuevos entregables.

---

*Actualizar este archivo al cerrar cada ticket.*
