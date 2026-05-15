import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import type { BrainstormBrandContextStatus, BrainstormSessionStatus } from "@/types/database";

function sessionStatusEs(s: BrainstormSessionStatus): string {
  switch (s) {
    case "open":
      return "Abierta";
    case "paused":
      return "Pausada";
    case "closed":
      return "Cerrada";
    case "converted_to_project_base":
      return "Cerrada";
    default:
      return s;
  }
}

function contextEs(c: BrainstormBrandContextStatus): string {
  switch (c) {
    case "ready":
      return "Listo";
    case "advisory":
      return "Advertencias";
    case "blocked":
      return "Bloqueado";
    default:
      return c;
  }
}

export default async function BrainstormerHomePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("brainstorm_sessions")
    .select(
      "id, brand_id, title, status, brand_context_status, updated_at, created_at, brand_context_has_pending_updates",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) {
    throw new Error(error.message);
  }

  const sessions = rows ?? [];
  const brandIds = [...new Set(sessions.map((s) => s.brand_id))];
  const { data: brands } =
    brandIds.length > 0
      ? await supabase.from("brands").select("id, name").in("id", brandIds)
      : { data: [] as { id: string; name: string }[] };

  const nameById = new Map(
    (brands ?? []).map((b) => [b.id, String(b.name ?? "").trim() || "Marca"] as const),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      <header className="border-b border-limbi-border/90 bg-limbi-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-8">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
              Brainstormer
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-limbi-text sm:text-4xl">
              Brainstormer
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-limbi-muted sm:text-base">
              Piensa retos de comunicación con Limbi usando el conocimiento aprobado de tus marcas.
            </p>
          </div>
          <Button
            asChild
            className={cn(
              "h-11 shrink-0 gap-2 self-start sm:self-auto",
              limbiPrimaryButtonClass,
            )}
          >
            <Link href="/brainstormer/new">
              <Plus className="size-4" aria-hidden />
              Nueva sesión
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-limbi-border bg-limbi-bg-soft/30 px-6 py-12 text-center">
            <p className="text-sm text-limbi-muted">
              Todavía no hay sesiones. Creá una para pensar un reto con Limbi.
            </p>
            <Button asChild className={cn("mt-6", limbiPrimaryButtonClass)}>
              <Link href="/brainstormer/new">Nueva sesión</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/brainstormer/${s.id}`}
                  className="block rounded-2xl border border-limbi-border bg-limbi-surface/90 p-4 transition-colors hover:border-limbi-green/30 hover:bg-limbi-bg-soft/40 sm:p-5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-limbi-text">{s.title}</p>
                      <p className="text-sm text-limbi-muted">{nameById.get(s.brand_id) ?? "Marca"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-lg border border-limbi-border bg-limbi-bg-soft/50 px-2 py-1 text-limbi-muted">
                        {sessionStatusEs(s.status as BrainstormSessionStatus)}
                      </span>
                      <span className="rounded-lg border border-limbi-border bg-limbi-bg-soft/50 px-2 py-1 text-limbi-muted">
                        Contexto: {contextEs(s.brand_context_status as BrainstormBrandContextStatus)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-limbi-muted">
                    Última actualización:{" "}
                    {new Date(s.updated_at).toLocaleString("es", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
