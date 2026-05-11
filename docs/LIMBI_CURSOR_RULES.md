# Limbi — Reglas de trabajo para Cursor / agentes

Reglas operativas para implementación y refactors. Complementan la Arquitectura V2 y los ADRs en `LIMBI_ARCHITECTURE_DECISIONS.md`.

## 1. Alcance y seguridad

- **No** ejecutar migraciones destructivas ni borrar tablas sin instrucción explícita del equipo.
- **No** preservar datos de prueba antiguos a costa de una arquitectura limpia; en dev se puede resetear cuando se apruebe.
- **Sí** conservar y no romper: autenticación Supabase, cliente OpenAI, variables de entorno, despliegue Vercel, layout y estética **Aire Digital**, componentes UI reutilizables, flujo de login.

## 2. Frontera Marca / Proyecto

- **No mezclar** captura de marca con captura de proyecto en la misma pantalla o mismo payload de persistencia sin diseño explícito.
- Nuevo código debe asumir que **marca es memoria estable** y **proyecto es estrategia aplicada** anclada a marca (cuando exista el modelo en BD).

## 3. Fuentes de verdad para IA

- **Documento Maestro activo manda** para consolidación y generación (hoy: `master_documents` con `status = active`).
- **Marco visible presenta** (hoy: `visible_frameworks` aprobado); no reemplazar al maestro como única fuente.
- **No** diseñar generación de contenido que dependa de **respuestas crudas**, **diagnósticos** o **chats** como fuente principal. Objetivo V2: `project_master_documents` + `brand_knowledge_bases` + `brand_limbic_bases`.
- Si el código actual usa *fallback* desde `project_responses` para generación, tratarlo como **deuda** a eliminar cuando existan bases de marca y maestro V2 completos.

## 4. Canon editorial

- **No** debilitar reglas de `LIMBI_EDITORIAL_CANON.md` ni de `GLOBAL_AI_RULES` al editar prompts.
- Cualquier nuevo entregable o tipo de contenido: primero estabilizar arquitectura y datos (según PDF V2); **no** expandir entregables sin decisión explícita.

## 5. Cambios en datos y tipos

- Tras cambios de esquema, actualizar `types/database.ts` (o fuente generada) y políticas RLS en migraciones.
- Mantener compatibilidad temporal solo cuando el plan lo indique; evitar “doble verdad” permanente (p. ej. evaluación solo en JSON embebido y en tabla sin política).

## 6. Calidad de código

- **No** refactorizar componentes grandes sin tarea explícita; preferir cambios acotados.
- Eliminar duplicados accidentales (p. ej. archivos `* 2.ts(x)`) cuando se aborden en una tarea dedicada.
- Tests: `npm test` y `npm run build` deben pasar antes de merge cuando el cambio toque lógica crítica.

## 7. Documentación

- Tras sesiones que cambien arquitectura o estado del producto, actualizar `LIMBI_STATUS.md`.
- Decisiones nuevas de producto/datos: añadir ADR breve en `LIMBI_ARCHITECTURE_DECISIONS.md`.

## 8. Prompt operativo (resumen)

Al planificar un epic V2:

1. Actualizar documentos en `/docs`.
2. Auditar tablas, rutas y llamadas OpenAI.
3. Diseñar migraciones nuevas (sin ejecutar hasta acuerdo).
4. Separar journeys Marca / Proyecto en UI y API.
5. Asegurar `evaluation_context` y `generation_context` limpios y acotados.

---

*Última actualización: sesión de documentación y auditoría V2.*
