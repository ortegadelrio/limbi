# Limbi — Brainstormer: modelo de datos sugerido (BRAIN-0)

**BRAIN-1 implementa este modelo mínimo** en la migración `supabase/migrations/20260601120000_brainstormer_tables.sql` (tablas reales + RLS). La sección siguiente conserva el diseño conceptual; los nombres de columnas coinciden salvo extensiones explícitas (`source_brand_context` jsonb en sesiones para metadatos de staleness y versión; `snapshot_kind` en snapshots; `conversion_readiness` en `brainstorm_project_bases`).

**Especificación original (BRAIN-0).** Sirve como referencia de producto; la implementación SQL es la fuente de verdad para constraints e índices exactos.

---

## Principio de trazabilidad de bases

Cada sesión debe registrar **qué filas de `brand_knowledge_bases` y `brand_limbic_bases` se usaron al iniciar** (ids y, si el producto lo guarda en snapshot, metadatos de versión / `created_at` / `prompt_version`). Así, cuando la marca se actualice después, el sistema puede:

- mostrar aviso tipo “La base de marca cambió desde esta sesión”;
- no mezclar silenciosamente contexto viejo con base nueva sin decisión del usuario.

---

## Tabla sugerida: `brainstorm_sessions`

| Campo | Tipo conceptual | Notas |
|--------|------------------|--------|
| `id` | UUID | PK |
| `user_id` | UUID | Dueño de la sesión (RLS alineado a auth) |
| `brand_id` | UUID | FK a `brands`; obligatorio |
| `source_brand_knowledge_base_id` | UUID | Base de conocimiento activa al inicio (o al último “refresh” explícito si el producto lo permite más adelante) |
| `source_brand_limbic_base_id` | UUID | Base límbica activa al inicio |
| `title` | text | Título editable de sesión |
| `status` | enum | `open` \| `paused` \| `closed` \| `converted_to_project_base` |
| `summary` | text | Resumen estratégico curado (post-sesión o incremental) |
| `recommended_route` | text | Ruta recomendada final o última conocida |
| `maturity_level` | text o enum | Nivel de madurez de la sesión (coherente con base preliminar) |
| `suggested_project_type` | jsonb | Última sugerencia estructurada (tipo + confianza + razonamiento breve) |
| `source_brand_context` | jsonb | **BRAIN-1:** metadatos de bases al inicio (versiones, staleness, `blocking_reasons_at_start`, reglas interpretativas, etc.) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `closed_at` | timestamptz nullable | |
| `converted_at` | timestamptz nullable | Cuando pasó a base preliminar / proyecto según reglas |

Índices sugeridos (BRAIN-1): `(user_id, updated_at desc)`, `(brand_id, status)`.

---

## Tabla sugerida: `brainstorm_messages`

| Campo | Tipo conceptual | Notas |
|--------|------------------|--------|
| `id` | UUID | PK |
| `session_id` | UUID | FK a `brainstorm_sessions` |
| `user_id` | UUID | Dueño del mensaje (debe coincidir con sesión) **BRAIN-1** |
| `role` | enum | `user` \| `assistant` \| `system` |
| `content` | text | Mensaje visible |
| `structured_extraction` | jsonb nullable | Fragmento estructurado para alimentar mapa vivo (slots parciales, sin duplicar todo el mapa en cada mensaje) |
| `created_at` | timestamptz | |

Índice sugerido: `(session_id, created_at asc)`.

---

## Tabla sugerida: `brainstorm_session_snapshots`

Para “Guardar” en el mapa vivo y puntos de restauración ligeros (MVP puede usar solo la última fila; versionado fino es posterior).

| Campo | Tipo conceptual | Notas |
|--------|------------------|--------|
| `id` | UUID | PK |
| `session_id` | UUID | FK |
| `user_id` | UUID | Dueño (redundancia controlada; RLS) **BRAIN-1** |
| `snapshot_payload` | jsonb | Estado del mapa vivo + metadatos opcionales |
| `snapshot_kind` | text | **BRAIN-1:** `live_map` \| `strategic_summary` \| `conversion_candidate` |
| `created_at` | timestamptz | |

---

## Tabla sugerida: `brainstorm_project_bases`

Puente hacia Proyecto: **base preliminar universal** materializada (ver `LIMBI_BRAINSTORMER_PRELIMINARY_BASE.md`).

| Campo | Tipo conceptual | Notas |
|--------|------------------|--------|
| `id` | UUID | PK |
| `session_id` | UUID | FK |
| `user_id` | UUID | Dueño (RLS) **BRAIN-1** |
| `brand_id` | UUID | Redundancia controlada para consultas |
| `source_brand_knowledge_base_id` | UUID | Copiado de sesión al convertir |
| `source_brand_limbic_base_id` | UUID | Copiado de sesión al convertir |
| `common_base` | jsonb | Objeto `common_base` con campos `value` + `status` |
| `suggested_project_type` | jsonb | Objeto sugerencia |
| `specific_module` | jsonb nullable | Módulo opcional según tipo |
| `pending_information` | jsonb | Lista estructurada de pendientes para Proyectos |
| `conversion_readiness` | jsonb | **BRAIN-1:** nivel, `can_convert`, `reason` |
| `status` | enum | `draft` \| `sent_to_project` \| `archived` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## RLS y multi-tenant (BRAIN-1)

Políticas alineadas a **ownership de marca** vía `brands.user_id` (o el patrón que ya use Limbi). Sin acceso cruzado entre usuarios.

---

## Documentos relacionados

- `LIMBI_BRAINSTORMER_CANON.md`
- `LIMBI_BRAINSTORMER_JOURNEY.md`
- `LIMBI_BRAINSTORMER_PRELIMINARY_BASE.md`
- `LIMBI_BRAINSTORMER_MVP.md`

---

*BRAIN-0 — modelo documental; **BRAIN-1** — migración `20260601120000_brainstormer_tables.sql` + tipos TypeScript.*
