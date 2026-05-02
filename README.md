# Limbi V1

Plataforma de estrategia de comunicación y marketing narrativo con IA. Stack: Next.js App Router, TypeScript, Tailwind, shadcn/ui, Supabase Auth (email/contraseña) y preparación para OpenAI en servidor.

## Requisitos

- Node.js 18.18+ o 20+
- npm, pnpm o yarn
- Proyecto en [Supabase](https://supabase.com) con Auth por email habilitado

## Primer uso

```bash
cd /Users/odelr/Documents/limbi
npm install
cp .env.example .env.local
```

En `.env.local` define al menos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (solo servidor) si vas a generar el documento maestro
- Opcional: `OPENAI_MASTER_DOCUMENT_MODEL` — id del modelo para esa ruta; si no existe, aplica el fallback documentado en `lib/openai/master-document.ts` (por defecto `gpt-4o`, fácil de cambiar ahí o por env)
- Opcional: `OPENAI_VISIBLE_FRAMEWORK_MODEL` — id del modelo para `POST /api/projects/:id/generate-framework`; fallback en `lib/openai/visible-framework.ts`
- Opcional: `OPENAI_CONTENT_GENERATION_MODEL` — id del modelo para `POST /api/projects/:id/generate-content`; fallback en `lib/openai/content-generation.ts`

```bash
npm run dev
```

Abre la URL que muestre la consola (p. ej. [http://localhost:3001](http://localhost:3001)).

## Supabase — URL de la aplicación

En el panel: **Authentication → URL configuration**.

- **Site URL:** `http://localhost:3001`
- **Redirect URLs** (una por línea):

  - `http://localhost:3001/auth/callback`
  - `http://localhost:3000/auth/callback`

Así funcionan la confirmación de email y el intercambio de código en `/auth/callback`. Si cambias de puerto, actualiza estos valores.

## Rutas

| Ruta | Acceso |
|------|--------|
| `/`, `/login`, `/signup`, `/auth/callback`, `/api/health` | Públicas |
| `/dashboard`, `/projects`, `/projects/new`, `/projects/[id]` | Requieren sesión |

## Scripts

- `npm run dev` — desarrollo
- `npm run build` — compilación de producción
- `npm run start` — servidor de producción
- `npm run lint` — ESLint

## Comprobaciones rápidas

- Home con enlaces a login, signup, dashboard y nuevo proyecto.
- `GET /api/health` → `{"ok":true,"app":"limbi"}`.
- Sin sesión, `/dashboard` o `/projects` redirigen a `/login?next=…`.
- Con sesión, dashboard muestra email y **Cerrar sesión**.

## Base de datos (Tarea 3)

La migración vive en `supabase/migrations/20260502180000_limbi_product_schema.sql`. **Revísala antes de ejecutarla** en tu proyecto Supabase.

### Aplicar la migración

1. Abre el panel → **SQL** → **New query**.
2. Pega el contenido completo del archivo y pulsa **Run**.

O, con [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase db push` / `supabase migration up` según tu flujo, apuntando al mismo proyecto.

Si al crear los triggers Postgres devuelve error de sintaxis, prueba sustituir `EXECUTE FUNCTION` por `EXECUTE PROCEDURE` en cada `CREATE TRIGGER` (depende de la versión del motor).

### API de proyectos (requiere sesión)

Las rutas usan el cliente servidor con cookies; debes estar logueado en el mismo origen (p. ej. `http://localhost:3001`).

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/projects` | Crea proyecto (`name_or_descriptor`, opcional `name_status`). |
| `GET` | `/api/projects` | Lista tus proyectos. |
| `GET` | `/api/projects/:projectId` | Detalle de un proyecto tuyo. |
| `PATCH` | `/api/projects/:projectId` | Actualiza solo `name_or_descriptor`, `name_status`, `challenge_type`, `main_challenge` (Zod). |
| `GET` | `/api/projects/:projectId/responses` | Lee `project_responses` para rehidratar el wizard. |
| `PATCH` | `/api/projects/:projectId/responses` | Crea o actualiza la fila única; **deep merge** de `responses` (objetos anidados); `completed_steps` sustituye el array completo. |
| `POST` | `/api/projects/:projectId/generate-master` | Llama a OpenAI (**Responses API**, servidor), valida JSON, inserta `master_documents` (nueva versión `active`), archiva activos anteriores del mismo proyecto, pone `projects.status` en `master_created` y registra `project_events`. Respuesta: `{ master_document: { id, project_id, version, status, created_at } }`. |
| `POST` | `/api/projects/:projectId/generate-framework` | Requiere un **Documento Maestro activo**. Genera el Marco Estratégico Narrativo visible (JSON interno con textos en español), valida esquema, inserta `visible_frameworks` con `status: draft` (nueva `version`, sin borrar borradores/aprobados previos), actualiza `projects.status` a `framework_created` y registra `project_events` (`framework_created`). Respuesta **201**: `{ visible_framework: { id, project_id, master_document_id, version, status, created_at } }`. |
| `GET` | `/api/projects/:projectId/framework` | Si `projects.status === framework_approved`: último **approved** por `version` DESC; si no hay, último **draft**. En caso contrario: último **draft**; si no hay, último **approved**. Sin filas → `{ visible_framework: null }`. Incluye `framework` (objeto) para la UI. |
| `POST` | `/api/projects/:projectId/framework/:frameworkId/approve` | Aprueba un marco en **draft** cuyo `framework` cumple el esquema actual (`validateVisibleFrameworkJson`); si no, **400** *"Este marco fue generado con una estructura anterior…"*. Archiva otros **approved** del mismo proyecto, pasa este a **approved**, `projects.status` → `framework_approved`, evento `framework_approved`. Solo borradores; si no, *"Solo se pueden aprobar marcos en borrador."* Respuesta: `{ visible_framework: { id, project_id, version, status, created_at } }`. |
| `POST` | `/api/projects/:projectId/generate-content` | Requiere **Documento Maestro activo** y **Marco Estratégico aprobado**. Cuerpo: `{ content_type, quantity? (1–10), user_note? }`. Tipos: `short_pitch`, `captions`, `content_ideas`, `graphic_phrases`. Si no hay marco aprobado: **400** con *"Primero debes aprobar el Marco Estratégico antes de generar contenidos."* OpenAI **Responses API**, JSON validado, inserta `generated_contents` y `project_events` (`content_generated`). Respuesta **201**: `{ generated_content: { id, project_id, content_type, status, created_at } }`. |

**Probar en el navegador** (con la app abierta y sesión iniciada, consola en la misma pestaña):

```js
fetch("/api/projects", { credentials: "include" })
  .then((r) => r.json())
  .then(console.log);

fetch("/api/projects", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name_or_descriptor: "Mi marca" }),
}).then((r) => r.json()).then(console.log);

// Generar contenido (requiere maestro activo + marco aprobado). quantity opcional (1–10); por defecto: short_pitch 3, captions 5, content_ideas 5, graphic_phrases 8.
fetch("/api/projects/<PROJECT_ID>/generate-content", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ content_type: "short_pitch" }),
}).then((r) => r.json()).then(console.log);
```

Sustituye `:id` por el `id` devuelto en `POST` para `GET` y `PATCH`.

### Verificar RLS

- Con usuario A: crea un proyecto y copia su `id`.
- Inicia sesión como usuario B y llama a `GET /api/projects/<id_de_A>`: debe responder **404** (sin filas visibles).
- `PATCH` de respuestas con un `projectId` ajeno también debe fallar (insert/update sin filas o error según caso).

`project_events` es **solo append**: el rol `authenticated` tiene `SELECT` e `INSERT`, no `UPDATE` ni `DELETE`; no hay políticas de modificación ni borrado.

## Seguridad

- No expongas `OPENAI_API_KEY` ni `SUPABASE_SERVICE_ROLE_KEY` en el cliente.
- Las llamadas a OpenAI deben hacerse solo en el servidor (`getOpenAIClient()` en `lib/openai/server.ts`; maestro en `lib/openai/master-document.ts`, marco visible en `lib/openai/visible-framework.ts`, contenidos en `lib/openai/content-generation.ts`, vía **Responses API**).
- `.env.local` está en `.gitignore`.

## Estructura objetivo

Ver el PRD del proyecto: carpetas `app/`, `components/`, `lib/`, `supabase/`, etc., creciendo por módulos.

## Siguiente módulo sugerido

Wizard visual que persista en `project_responses` y actualice `projects` (challenge_type, main_challenge, etc.).
