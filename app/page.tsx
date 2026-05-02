import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/login", label: "Iniciar sesión" },
  { href: "/signup", label: "Crear cuenta" },
  { href: "/dashboard", label: "Mi Limbi" },
  { href: "/projects/new", label: "Crear Sistema Límbico" },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Limbi V1</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Plataforma Límbica digital
        </h1>
        <p className="text-muted-foreground">
          Setup inicial: Next.js, Tailwind, shadcn/ui, Supabase y OpenAI
          preparados para crecer.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {nav.map((item) => (
          <li key={item.href}>
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link href={item.href}>
                {item.label}
                <ArrowRight className="size-4 opacity-60" aria-hidden />
              </Link>
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        API:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">GET /api/health</code>
      </p>
    </main>
  );
}
