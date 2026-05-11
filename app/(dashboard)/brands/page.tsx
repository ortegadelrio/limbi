import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { BrandList, type BrandListItem } from "@/components/brands/brand-list";
import { limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import type { BrandOfferNature, BrandStatus } from "@/types/database";

export default async function BrandsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brandRows, error: brandsError } = await supabase
    .from("brands")
    .select(
      "id, name, description, brand_status, website_url, country_or_market, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (brandsError) {
    throw new Error(brandsError.message);
  }

  const list = brandRows ?? [];
  let brands: BrandListItem[] = [];

  if (list.length > 0) {
    const ids = list.map((b) => b.id);
    const { data: profiles, error: profilesError } = await supabase
      .from("brand_offer_profiles")
      .select("brand_id, offer_nature")
      .in("brand_id", ids);

    if (profilesError) {
      throw new Error(profilesError.message);
    }

    const natureByBrand = new Map(
      (profiles ?? []).map((p) => [p.brand_id, p.offer_nature] as const),
    );

    brands = list.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      brand_status: b.brand_status as BrandStatus,
      website_url: b.website_url,
      country_or_market: b.country_or_market,
      updated_at: b.updated_at,
      offer_nature: (natureByBrand.get(b.id) as BrandOfferNature | undefined) ?? null,
    }));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      <header className="border-b border-limbi-border/90 bg-limbi-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-8">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
              Journey de Marca
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-limbi-text sm:text-4xl">
              Marcas
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-limbi-muted sm:text-base">
              La marca es memoria estable: identidad y oferta separadas del
              proyecto.
            </p>
          </div>
          <Button
            asChild
            className={cn(
              "h-11 shrink-0 gap-2 self-start sm:self-auto",
              limbiPrimaryButtonClass,
            )}
          >
            <Link href="/brands/new">
              <Plus className="size-4" aria-hidden />
              Nueva marca
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <BrandList brands={brands} />
      </div>
    </div>
  );
}
