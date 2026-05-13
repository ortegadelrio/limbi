# Limbi — Brainstormer: base preliminar universal (BRAIN-0)

Contrato conceptual del artefacto que **sale** de Brainstormer hacia **Proyectos**. No es esquema SQL ni Zod implementado: guía para BRAIN-1 y posteriores.

---

## Rol respecto a Proyecto

| Base preliminar (Brainstormer) | Proyecto (módulo existente / futuro) |
|-------------------------------|--------------------------------------|
| Puede nacer **incompleta** | Completa, valida y estructura |
| Hipótesis y `pending` explícitos | Obligatoriedad según tipo de proyecto |
| Orienta decisión y brief liviano | Ejecución, entregables, generación cuando aplique |

**Regla:** la base preliminar **no** exige información completa. Los vacíos se guardan como **pendientes** para que Proyectos los trabaje con flujos propios.

---

## Estructura: `common_base`

Cada **campo clave** es un objeto con:

- `value` — string u objeto liviano según el campo (en BRAIN-1 se fija tipado).
- `status` — `defined` \| `hypothesis` \| `pending`

### Campos obligatorios en el contrato conceptual

| Clave | Rol |
|--------|-----|
| `working_title` | Título de trabajo de la iniciativa (no necesariamente nombre final de campaña) |
| `challenge` | Reto central que destraba la sesión |
| `preliminary_objective` | Objetivo preliminar, refinable |
| `main_audience` | Audiencia principal |
| `secondary_audiences` | Audiencias secundarias (puede ser texto compuesto o lista en `value`) |
| `tension_or_barrier` | Tensión o barrera detectada |
| `strategic_opportunity` | Oportunidad estratégica |
| `possible_insight` | Insight posible (con `hypothesis` frecuente) |
| `available_evidence` | Qué evidencia curada de marca respalda el hilo (referencias textuales a la base, no dumps) |
| `brand_assets_to_use` | Activos de marca a usar (tono, pilares, credibilidad, etc., según base) |
| `restrictions` | Restricciones y alertas relevantes copiadas o reinterpretadas desde base curada |
| `ideas_explored` | Lista / texto de ideas ya exploradas en sesión |
| `recommended_route` | Ruta recomendada por Limbi |
| `why_this_route` | Razonamiento explícito |
| `pending_information` | Qué falta para bajar a proyecto con menos fricción |
| `maturity_level` | Madurez de la conversión (ver abajo) |
| `recommended_next_step` | Siguiente paso sugerido para el usuario o para Proyectos |

**Madurez** puede mapearse a etiquetas discretas alineadas con sesión, por ejemplo: `exploring` \| `focused` \| `ready_to_convert` (definición exacta en BRAIN-1).

---

## Estructura: `suggested_project_type`

```json
{
  "type": "campaign_360",
  "confidence": "medium",
  "alternative_types": ["content_strategy", "not_sure_yet"],
  "reasoning": "Texto breve que justifica la sugerencia sin afirmar certeza absoluta."
}
```

- `confidence`: `low` \| `medium` \| `high`
- `alternative_types`: array de otros tipos plausibles
- `reasoning`: siempre presente en nivel conceptual (puede ser corto)

### Tipos sugeridos (catálogo inicial)

| `type` | Uso |
|--------|-----|
| `campaign_360` | Campaña integral |
| `content_strategy` | Estrategia de contenidos |
| `brand_activation_btl` | Activación / BTL |
| `audiovisual_piece` | Pieza audiovisual |
| `launch` | Lanzamiento |
| `reputation_pr` | Reputación / PR |
| `commercial_pitch` | Presentación comercial / pitch |
| `event_experience` | Evento / experiencia |
| `internal_communication` | Comunicación interna |
| `brand_positioning` | Posicionamiento de marca |
| `social_impact_project` | Proyecto de impacto social |
| `not_sure_yet` | Explícitamente indeciso — válido |

---

## Módulos específicos opcionales (`specific_module`)

Objeto **opcional** cuya forma depende de `suggested_project_type.type`. Ejemplos de claves de módulo (no exhaustivos en BRAIN-0):

- **Campaña 360:** `phasing_hypothesis`, `channel_mix_sketch`, `kpis_tension`
- **Estrategia de contenidos:** `pillars_sketch`, `formats_explored`, `cadence_tension`
- **Activación / BTL:** `touchpoints`, `experience_idea`, `logistics_tension`
- **Pieza audiovisual:** `duration_format`, `narrative_beats`, `production_tension`
- **Lanzamiento:** `timeline_hypothesis`, `audience_wave`, `risk_register`
- **Reputación / PR:** `narrative_stakes`, `spokespeople_hypothesis`, `crisis_tension`
- **Pitch comercial:** `value_story`, `objection_map`, `proof_points_from_brand_base`

Cada subcampo puede seguir el patrón `value` + `status` si aporta claridad en BRAIN-1.

---

## Estructura: `conversion_readiness`

```json
{
  "level": "medium",
  "can_convert": true,
  "reason": "Hay reto y ruta recomendada; faltan detalles de medición que Proyectos puede capturar después."
}
```

- `can_convert`: boolean — si `false`, la UI explica `reason` y ofrece seguir conversando o guardar borrador.
- `level`: coherente con madurez (`low` \| `medium` \| `high`).

---

## Pendientes hacia Proyectos (`pending_information`)

Lista de objetos sugeridos:

```json
{
  "items": [
    {
      "label": "Presupuesto orden de magnitud",
      "detail": "Usuario no definió aún; Proyectos puede preguntarlo en intake.",
      "priority": "medium"
    }
  ]
}
```

(BRAIN-1 define `priority` y validaciones.)

---

## Documentos relacionados

- `LIMBI_BRAINSTORMER_CANON.md`
- `LIMBI_BRAINSTORMER_JOURNEY.md`
- `LIMBI_BRAINSTORMER_DATA_MODEL.md`
- `LIMBI_BRAINSTORMER_MVP.md`

---

*BRAIN-0 — contrato conceptual de base preliminar.*
