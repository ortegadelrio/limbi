# Limbi — Architecture decisions (V2)

Este documento resume decisiones de producto y arquitectura alineadas con **LIMBI — Arquitectura V2** (marca, proyecto, sistema límbico, canon editorial). Sirve como referencia para implementación y revisiones de código.

## ADR-001 — Primero estrategia, luego narrativa, al final formato

**Decisión:** El producto no es un generador de piezas sueltas. El flujo obligatorio es: base de conocimiento clara → diagnóstico → mejora opcional → generación desde contexto curado.

**Implicación:** No promover generación de contenido antes de existir un documento maestro activo y reglas de generación alineadas con fuentes curadas.

## ADR-002 — Dos journeys separados: Marca y Proyecto

**Decisión:** El **Journey de Marca** y el **Journey de Proyecto / Sistema Límbico** están completamente separados. No se mezcla captura de marca con captura de proyecto.

**Implicación:**

- La marca es **memoria estable** (base de conocimiento + base límbica de marca).
- El proyecto es **estrategia aplicada** a un reto, anclada a una marca ya existente (`brand_id` + bases activas).
- UI, rutas, prompts y persistencia deben mantener esta frontera.

## ADR-003 — Capas de información

**Decisión:** Organizar todo en tres capas:

| Capa | Rol |
|------|-----|
| **Cruda** | Lo que el usuario respondió o subió. Se conserva para trazabilidad; **no manda** en generación. |
| **Evaluada** | Diagnósticos, puntajes, vacíos, riesgos. **Orienta**; no es fuente única de generación. |
| **Curada** | Bases activas aprobadas y documento maestro activo. **Manda** para generación. |

**Capa visible:** El Marco Estratégico **presenta**; no sustituye al documento maestro como fuente de verdad para la IA.

## ADR-004 — Fuente de generación (V2 objetivo)

**Decisión:** La IA debe generar contenidos principalmente desde:

- `project_master_documents` activo (nombre conceptual V2; hoy el código usa `master_documents`).
- `brand_knowledge_bases` activa.
- `brand_limbic_bases` activa.

**No debe** generar desde, como sustituto de lo anterior: respuestas crudas sueltas, diagnósticos dispersos, chats del experto, documentos crudos, marco visible como única fuente, ni bitácoras (`project_events`) como contexto narrativo principal.

## ADR-005 — Cuestionario puro en primera captura (V2 objetivo)

**Decisión:** La primera etapa de captura de marca y de proyecto es **cuestionario puro** por secciones (núcleo común + módulos condicionales según clasificación), no conversación abierta como fase principal.

**Estado en código actual:** Existe un flujo de intake conversacional (`intake-turn`) mezclado con el proyecto; se considera **desalineado** con V2 hasta que se reordene o reemplace por el modelo de cuestionario puro + journeys separados.

## ADR-006 — Documentos como fuentes, no como verdad automática

**Decisión:** Documentos cargados alimentan tablas de hechos extraídos con estados de revisión (`pending_review`, `approved`, etc.). Solo lo **aprobado** entra en bases curadas.

## ADR-007 — Diagnóstico con contexto ordenado

**Decisión:** El backend construye un `evaluation_context` explícito (marca o proyecto) antes de llamar al modelo de diagnóstico. No diagnosticar leyendo JSON suelto sin contrato.

## ADR-008 — Mejora por sección con experto Limbi

**Decisión:** Tras el diagnóstico, el usuario puede mejorar **solo una sección** a la vez. El experto no reabre todo el journey. Los cambios aprobados alimentan la base curada correspondiente.

## ADR-009 — Marco Estratégico vs Documento Maestro

**Decisión:**

- **Documento Maestro activo manda** (payload consolidado para IA y producto).
- **Marco Estratégico visible presenta** (cara amigable al usuario).
- Si el usuario cambia algo **sustancial** en el marco, eso debe **versionar** el documento maestro, no quedar solo como texto visible.

## ADR-010 — Reset de datos de prueba

**Decisión:** La data actual de pruebas **no** es requisito de migración compleja. Priorizar arquitectura limpia. Conservar lo que ya funciona: auth Supabase, OpenAI, Vercel, env, diseño base.

## ADR-011 — Canon editorial obligatorio

**Decisión:** Las reglas del canon (anti-IA genérica, tensiones, base límbica no literal, no inventar datos) son **no negociables** y deben reflejarse en documentación (`LIMBI_EDITORIAL_CANON.md`) y en reglas/prompts (`GLOBAL_AI_RULES`, prompts por tarea).

---

*Última actualización: alineado con Arquitectura V2 y auditoría del repo Limbi.*
