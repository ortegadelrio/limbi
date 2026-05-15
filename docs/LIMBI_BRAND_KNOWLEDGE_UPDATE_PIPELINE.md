# Limbi — Pipeline futuro: «Actualizar conocimiento de marca»

**Estado:** diseño y tipos esqueleto (`lib/brands/brand-knowledge-update-pipeline.stub.ts`). **Sin** tabla ni UI completa en esta fase.

## Principio

Las respuestas originales cerradas del cuestionario **no** son un documento vivo editable libremente. La información nueva entra por un **flujo controlado**: captura → clasificación → propuesta de impacto → decisión humana → reconsolidación → **nueva fila activa** en `brand_knowledge_bases` / `brand_limbic_bases`.

## Pasos de producto (objetivo)

1. El usuario agrega nueva información (texto, referencia, corrección).
2. Limbi clasifica (`source_type`).
3. Limbi propone `section_key` afectada e `importance_level`.
4. El usuario aprueba, edita, guarda como referencia o descarta (`status` / `user_decision`).
5. Si se aprueba lo que debe incorporarse a la base, se lanza **reconsolidación**.
6. Se crea una **nueva versión activa** (patrón actual: desactivar anteriores, insertar/activar nuevas filas).
7. Se registra qué cambió (`affected_outputs`, timestamps).

## Estados sugeridos (`status`)

| Estado | Significado |
|--------|--------------|
| `pending_review` | Esperando revisión humana |
| `approved` | Aprobado para incorporación |
| `incorporated` | Ya reflejado en base activa |
| `reference_only` | Queda como nota, no en base |
| `discarded` | Descartado |
| `excluded_with_reason` | Excluido con `reason_for_exclusion` |

## Regla crítica

Toda entrada aprobada con `importance_level` **`critical`** o **`high`** debe quedar **`incorporated`** en la Base de Marca activa **o** `excluded_with_reason` con motivo explícito. **Nunca** en limbo indefinido.

## Tabla futura sugerida: `brand_knowledge_update_items` (nombre tentativo)

| Campo | Tipo conceptual |
|--------|------------------|
| `id` | uuid |
| `brand_id` | uuid |
| `source_type` | manual_addition, correction, replacement, brainstormer_suggestion, document_finding, other |
| `raw_text` | text |
| `interpreted_summary` | text |
| `section_key` | text |
| `importance_level` | critical, high, medium, low |
| `must_include` | boolean |
| `requires_user_review` | boolean |
| `status` | ver tabla arriba |
| `user_decision` | text nullable |
| `reason_for_exclusion` | text nullable |
| `affected_outputs` | jsonb array: brand_knowledge_base, brand_limbic_base, project_context, generation_rules |
| `created_at` | timestamptz |
| `approved_at` | timestamptz nullable |
| `incorporated_at` | timestamptz nullable |
| `created_by` | uuid (user) |

## Relación con auditoría actual

`auditBrandActiveBaseReadiness` y el dashboard de marca cubren hoy: hallazgos pendientes, staleness, contrato de payload. Cuando exista esta tabla, la auditoría debe incluir: **¿hay ítems aprobados no incorporados?** especialmente `critical` / `high`.
