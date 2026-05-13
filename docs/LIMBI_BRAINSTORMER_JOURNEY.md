# Limbi — Brainstormer: journey (BRAIN-0)

Flujo funcional y pantallas previstas. **Solo diseño;** sin rutas implementadas ni persistencia en este entregable.

---

## Entradas al módulo

El usuario puede llegar por al menos tres caminos:

1. **`/brands/[brandId]`** → acción **“Brainstormear con esta marca”** (marca ya elegida).
2. **`/brainstormer`** → listado global → **elegir marca** antes o al crear sesión.
3. **`/projects/new`** → opción **“No estoy seguro, quiero pensar primero”** → flujo que deriva a Brainstormer con elección de marca (sin crear aún un proyecto formal, según reglas de producto futuras).

En todos los casos la sesión termina **ligada a una `brand_id`** válida y propiedad del usuario.

---

## Inicio obligatorio de sesión

Toda sesión Brainstormer debe arrancar solo cuando se cumple este bloque mínimo (en este orden conceptual en producto):

1. **Título / nombre de sesión** — sugerido por Limbi o **editable por el usuario** desde el inicio.
2. **Marca asociada** — obligatoria; sin marca no hay sesión Brainstormer.
3. **Validación y carga de bases activas** — deben existir y cargarse la **Base de Conocimiento de Marca activa** y la **Base Límbica activa** (`brand_knowledge_bases` / `brand_limbic_bases` en estado vigente según reglas de producto alineadas al journey de marca). Si faltan o están bloqueadas por staleness / pendientes de revisión, el producto debe **explicar el bloqueo** y ofrecer el camino de corrección (sin mezclar fuentes prohibidas).
4. **Pregunta inicial general** — una sola apertura que invite a pensar **sin** convertir el turno en cuestionario.

### Preguntas iniciales sugeridas (elegir una variante en implementación)

**Variante A (corta):**

> Ya tengo el contexto de la marca. ¿Sobre qué reto quieres que pensemos hoy?

**Variante B (más abierta):**

> Ya tengo el contexto de la marca. Para que esta sesión sea útil, cuéntame qué quieres destrabar: una campaña, una idea, una comunicación, una activación, un contenido o simplemente una inquietud que todavía no sabes cómo ordenar.

---

## Pantallas

| Ruta | Rol |
|------|-----|
| `/brainstormer` | **Listado de sesiones** del usuario (filtrable por marca, estado, fecha). |
| `/brainstormer/new` | **Crear sesión:** elegir marca (si no viene fijada), nombrar o editar título, confirmar carga de bases, iniciar chat con pregunta inicial. |
| `/brainstormer/[sessionId]` | **Sesión conversacional** activa: chat + mapa vivo + acciones (guardar, convertir). |

---

## Layout ideal de la sesión (`/brainstormer/[sessionId]`)

### Columna izquierda (contexto de marca)

- Marca activa (nombre, enlace al dashboard de marca).
- **Calidad de información** (resumen del indicador existente de marca, si está disponible).
- Estado de **Base de Marca** (vigente / desactualizada / bloqueada) con enlace **Ver Base de Marca**.
- Recordatorio breve: “Esta sesión usa la base consolidada al momento de inicio” (ids y fechas en datos futuros).

### Centro (conversación)

- Hilo con Limbi siguiendo el **canon** (`LIMBI_BRAINSTORMER_CANON.md`): anti-bucle, sin formulario, con avances explícitos.

### Derecha (mapa vivo de la sesión)

Panel estructural que se **actualiza** a medida que la conversación madura (manual + asistido por extracción estructurada en mensajes del asistente, según BRAIN-1).

Campos conceptuales del mapa:

- **Reto**
- **Objetivo preliminar**
- **Audiencia**
- **Tensión**
- **Oportunidad**
- **Ideas exploradas**
- **Rutas creativas**
- **Ruta recomendada**
- **Pendientes**
- **Madurez** (escala discreta coherente con `maturity_level` en sesión / base preliminar)
- **Guardar** (persistir snapshot del mapa + estado de sesión)
- **Convertir en base preliminar de proyecto** (habilitado según reglas de `conversion_readiness` en `LIMBI_BRAINSTORMER_PRELIMINARY_BASE.md`)

---

## Reglas de navegación entre pantallas

- Crear sesión en **`/brainstormer/new`** debe redirigir a **`/brainstormer/[sessionId]`** tras el primer guardado exitoso.
- Desde listado, “continuar” abre la sesión en el mismo layout de tres columnas.

---

## Relación con Proyecto (solo conceptual)

- Brainstormer **destraba y ordena**; la **base preliminar** es el puente.
- Proyecto **completa, valida y estructura** el trabajo operativo posterior (fuera del alcance BRAIN-0 de implementación).

---

## Documentos relacionados

- `LIMBI_BRAINSTORMER_CANON.md` — principios y fuentes.
- `LIMBI_BRAINSTORMER_DATA_MODEL.md` — tablas sugeridas.
- `LIMBI_BRAINSTORMER_PRELIMINARY_BASE.md` — contrato de salida hacia proyecto.
- `LIMBI_BRAINSTORMER_MVP.md` — qué entra en la primera versión construible.

---

*BRAIN-0 — journey documental.*
