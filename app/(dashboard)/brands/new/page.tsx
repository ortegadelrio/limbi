import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { BrandCreateForm } from "@/components/brands/brand-create-form";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

export default async function NewBrandPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 gap-1 rounded-xl" asChild>
        <Link href="/brands">
          <ArrowLeft className="size-4" aria-hidden />
          Marcas
        </Link>
      </Button>

      <div className={cn(limbiDocumentCardClass, "p-6 sm:p-8")}>
        <header className="mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
            Journey de Marca
          </p>
          <h1 className="font-heading text-2xl font-semibold text-limbi-text">
            Nueva marca
          </h1>
          <p className="text-sm text-limbi-muted">
            Define el nombre, la naturaleza de la oferta y, si quieres, datos
            básicos. El cuestionario profundo vendrá después.
          </p>
        </header>

        <BrandCreateForm />
      </div>
    </div>
  );
}
