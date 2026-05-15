# Limbi — Fuente de verdad de marca (activa vs presentación)

## Regla de producto

- La **Base de Conocimiento activa** (`brand_knowledge_bases` con `is_active`, `status = succeeded`, sin `superseded_at`) y la **Base Límbica activa** (`brand_limbic_bases` con las mismas reglas) son la **fuente interna profunda** para IA y módulos operativos.
- El **resumen visible** en `/brands/[brandId]/bases` (lectura ejecutiva, tarjetas, `executive_reading`) **presenta** al usuario; **no** sustituye al `consolidated_payload` JSON que debe leer el modelo.
- **La base activa manda** para: Brainstormer (cuando persista sesiones), proyectos anclados a marca, generación futura explícitamente ligada a marca.

## Consumidores permitidos

- Carga canónica: `loadActiveBrandContextForProject` (`lib/brands/load-active-brand-context-for-project.ts`).
- Brainstormer (preparación de sesión): `prepareBrainstormSessionContext` (`lib/brainstormer/create-brainstorm-session-context.ts`).
- Auditoría mínima post-consolidación: `auditBrandActiveBaseReadiness` (`lib/brands/audit-brand-active-base-readiness.ts`), devuelta en `POST .../bases/consolidate` como `post_consolidation_readiness`.

## No usar como fuente principal

- Respuestas crudas del cuestionario (`brand_responses`).
- Documentos y extracciones crudas; facts **pendientes** o rechazados.
- Chats de mejora por sección.
- Sesiones de Brainstormer (exploración, no verdad de marca).
- Solo el resumen UI sin el payload consolidado.
- Información nueva no reconsolidada en la base activa.

## Trazabilidad Brainstormer

Migración `20260602130000_brainstorm_sessions_brand_truth_traceability.sql`: columnas `brand_knowledge_base_id_used`, `brand_limbic_base_id_used`, `brand_context_generated_at`, `brand_context_status` (`ready` \| `advisory` \| `blocked`), `brand_context_blocking_reasons`, `brand_context_has_pending_updates`.

## UX

- Dashboard de marca: pie de página con `BRAND_IA_SOURCE_FOOTNOTE_ES` (componente de mantenimiento).
- Mensaje estándar si hay pendientes no incorporados antes de brainstormear: `BRAND_PENDING_INCORPORATION_BRAINSTORMER_ES` (`lib/brands/brand-active-base-source-of-truth.ts`).
