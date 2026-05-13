# Limbi — Brainstormer: MVP v1 (BRAIN-0)

Alcance razonable para la **primera versión construible** (BRAIN-1 en código). Lo que sigue es **criterio de producto**, no estado de implementación.

---

## Incluye MVP v1

1. **Crear sesión** asociada a una **marca** del usuario.
2. **Validar** que existan **Base de Conocimiento** y **Base Límbica** activas según las mismas reglas de vigencia que el resto del producto (sin inventar fuentes).
3. **Nombrar sesión** (título sugerido o editable desde el inicio).
4. **Pregunta inicial general** alineada al journey documentado (`LIMBI_BRAINSTORMER_JOURNEY.md`).
5. **Chat con Limbi** bajo el canon (`LIMBI_BRAINSTORMER_CANON.md`), incluyendo **regla anti-bucle**.
6. **Mapa vivo** en panel lateral con los campos definidos en journey; actualización asistida + edición manual mínima donde aplique.
7. **Guardar sesión** (persistir mensajes y estado del mapa; snapshots según `LIMBI_BRAINSTORMER_DATA_MODEL.md` en BRAIN-1).
8. **Continuar sesión** desde listado.
9. **Resumen estratégico** (texto curado al cierre o bajo demanda; puede vivir en `brainstorm_sessions.summary`).
10. **Convertir en base preliminar universal** según `LIMBI_BRAINSTORMER_PRELIMINARY_BASE.md`, con **pendientes** explícitos.
11. **Sugerir tipo de proyecto** con `confidence` y `reasoning` (sin forzar elección del usuario).

---

## No incluye todavía MVP v1

- **Generación de piezas** finales (copys, scripts largos, artefactos descargables masivos).
- **Campañas completas** ejecutadas dentro de Brainstormer.
- **Calendario de contenidos** ni planificación temporal fina.
- **Colaboración multiusuario** en tiempo real.
- **Métricas** de desempeño de sesión o dashboards analíticos.
- **Render visual avanzado** del mapa (p. ej. canvas infinito, mindmap interactivo pesado).
- **Múltiples versiones de rutas** con diff visual complejo (una ruta recomendada + historial simple puede bastar en v1 si se documenta en BRAIN-1).

---

## Criterios de éxito del MVP (revisión humana)

- Un usuario puede **entrar**, **pensar con Limbi**, **ver el mapa evolucionar**, **guardar**, **volver** y **convertir** sin sentir que rellenó un formulario.
- La salida hacia proyecto es **honesta** sobre huecos (`pending_information`).
- Si la base de marca cambia después, el producto puede **explicar** la situación gracias a ids de base en sesión (BRAIN-1).

---

## Orden sugerido de implementación (BRAIN-1, no ejecutado aquí)

1. Migraciones + RLS mínimo para `brainstorm_sessions` y `brainstorm_messages`.
2. API de sesión + streaming o turnos de chat según stack existente en Limbi.
3. UI `/brainstormer`, `/brainstormer/new`, `/brainstormer/[sessionId]` con layout de tres columnas.
4. Snapshots y conversión a `brainstorm_project_bases`.
5. Integración superficial con **Proyectos** (crear borrador o “enviar” según decisión de producto).

---

## Documentos relacionados

- `LIMBI_BRAINSTORMER_CANON.md`
- `LIMBI_BRAINSTORMER_JOURNEY.md`
- `LIMBI_BRAINSTORMER_DATA_MODEL.md`
- `LIMBI_BRAINSTORMER_PRELIMINARY_BASE.md`

---

*BRAIN-0 — MVP documental.*
