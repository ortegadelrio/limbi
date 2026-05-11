# Limbi — Data architecture V2 (objetivo) vs código actual

Este documento describe el **modelo de datos objetivo** según la Arquitectura V2 y contrasta con lo que existe hoy en el repositorio (migraciones Supabase y uso en código). **No sustituye** migraciones futuras: es la brújula para diseñar el siguiente esquema.

## 1. Principio de datos (V2)

- **Lo crudo se conserva** (`brand_responses`, `project_responses` normalizados por keys).
- **Lo evaluado orienta** (`brand_evaluations`, `project_evaluations`).
- **Lo mejorado se aprueba** (`*_improvement_sessions`).
- **Lo curado manda** (`brand_knowledge_bases`, `brand_limbic_bases`, `project_master_documents`).
- **Lo visible presenta** (`strategic_frameworks`).
- **Lo generado se guarda** (`generated_contents`).

## 2. Tablas objetivo — Journey de Marca (V2)

| Tabla | Propósito |
|-------|-----------|
| `brands` | Identidad básica de la marca. |
| `brand_offer_profiles` | `offer_nature` y perfil de oferta (activa ramas del cuestionario). |
| `brand_responses` | Respuestas crudas del cuestionario (`section_key`, `module_key`, `question_key`). |
| `brand_documents` | Archivos de marca. |
| `brand_source_facts` | Hechos extraídos; revisión/aprobación. |
| `brand_evaluations` | Diagnóstico total. |
| `brand_improvement_sessions` | Mejora conversacional por sección. |
| `brand_knowledge_bases` | Base de conocimiento de marca versionada; una activa. |
| `brand_limbic_bases` | Base límbica de marca versionada; una activa. |

## 3. Tablas objetivo — Journey de Proyecto (V2)

| Tabla | Propósito |
|-------|-----------|
| `projects` | Proyecto ligado a `brand_id` y a bases activas de marca. |
| `project_deployments` | Despliegue principal/secundario. |
| `project_responses` | Respuestas crudas (misma idea de keys que marca). |
| `project_documents` / `project_source_facts` | Fuentes del proyecto. |
| `project_evaluations` | Diagnóstico del proyecto. |
| `project_improvement_sessions` | Mejora por sección. |
| `project_master_documents` | **Fuente principal de generación** (nombre V2). |
| `strategic_frameworks` | Marco visible (presenta; no manda sobre generación). |
| `generated_contents` | Piezas generadas; referencia al maestro usado. |
| `project_events` | Bitácora. |
| `question_definitions` | Catálogo central de preguntas por journey y `applies_to`. |

## 4. Estado actual en el repo (migraciones aplicables en código)

Según `supabase/migrations/` y `types/database.ts`:

### 4.1 Tablas existentes hoy

- `projects`
- `project_responses` — **una fila por proyecto**, JSON `responses` + campos extendidos en tipos TS para evaluación y aclaraciones embebidas (`questionnaire_pre_master_evaluation`, `questionnaire_clarifications`).
- `master_documents` — documento maestro por proyecto (equivale conceptualmente a `project_master_documents` V2, pero sin `brand_id` / snapshots de marca).
- `visible_frameworks` — marco visible (equivale parcialmente a `strategic_frameworks` V2).
- `generated_contents`
- `project_events`
- `questionnaire_evaluations` — evaluaciones versionadas en tabla dedicada.
- `questionnaire_clarifications` — aclaraciones post-diagnóstico en tabla dedicada (además de posible reflejo en `project_responses`).

### 4.2 Tablas V2 **no presentes** aún

`brands`, `brand_offer_profiles`, `brand_responses`, `brand_documents`, `brand_source_facts`, `brand_evaluations`, `brand_improvement_sessions`, `brand_knowledge_bases`, `brand_limbic_bases`, `project_deployments`, `project_documents`, `project_source_facts`, `project_evaluations` (tabla separada; hoy hay evaluación de cuestionario acoplada al proyecto), `project_improvement_sessions`, `strategic_frameworks` (nombre/columnas), `question_definitions`.

### 4.3 Fricciones conocidas vs V2

1. **No hay journey de marca** en base ni en rutas: todo es **proyecto-centric**.
2. **`project_responses`** es un blob JSON + metadatos; V2 apunta a filas o estructura fuertemente clasificada por `section_key` / `module_key` / `question_key`.
3. **`projects`** no referencia `brand_id` ni IDs de bases activas de marca.
4. **Generación de contenido** hoy usa `master_documents` + `visible_frameworks` aprobado, pero **también** carga `project_responses` para *fallback* de trazas estratégicas (ver `lib/content/strategic-context-for-generation.ts`). V2 quiere eliminar dependencia de crudo para generación.
5. Nombres: `master_documents` / `visible_frameworks` vs `project_master_documents` / `strategic_frameworks` del PDF — al migrar, conviene **mapear** o **renombrar** con plan explícito.

## 5. Clasificación mínima de datos (V2)

Cada dato relevante debería poder etiquetarse con:

- `scope`: `brand` | `project`
- `section_key`: p. ej. `audience`, `evidence`, `limbic_pulse`
- `source_type`: `questionnaire` | `document` | `ai_interpretation` | `user_improvement` | `approved_framework_adjustment`

El código actual mezcla fuentes en JSON anidado y en columnas de `project_responses`; la trazabilidad fina V2 aún no está modelada.

## 6. Política de migración (solo planificación)

- No preservar datos de prueba con migraciones complejas.
- Cuando se implemente V2: nuevas tablas y RLS; opcionalmente scripts de reset en entornos de desarrollo.
- Este documento **no** ejecuta migraciones.

---

*Última actualización: coherente con migraciones `20260502180000_limbi_product_schema.sql` y `20260504120000_questionnaire_evaluations_and_clarifications.sql`.*
