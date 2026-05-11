import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  limbiDocumentCardClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import { offerNatureLabelEs } from "@/lib/brands/offer-nature-labels";
import { BRAND_STATUS_OPTIONS } from "@/lib/brands/brand-status-labels";

type Props = { params: Promise<{ brandId: string }> };

function brandStatusLabel(code: string): string {
  return BRAND_STATUS_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

export default async function BrandDetailPage({ params }: Props) {
  const { brandId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select(
      "id, name, description, brand_status, website_url, country_or_market, updated_at",
    )
    .eq("id", brandId)
    .maybeSingle();

  if (brandError) {
    throw new Error(brandError.message);
  }
  if (!brand) notFound();

  const { data: profile } = await supabase
    .from("brand_offer_profiles")
    .select("offer_nature")
    .eq("brand_id", brandId)
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 gap-1 rounded-xl" asChild>
        <Link href="/brands">
          <ArrowLeft className="size-4" aria-hidden />
          Marcas
        </Link>
      </Button>

      <div className={cn(limbiDocumentCardClass, "space-y-4 p-6 sm:p-8")}>
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
            Marca
          </p>
          <h1 className="font-heading text-2xl font-semibold text-limbi-text">
            {brand.name}
          </h1>
          <p className="text-sm text-limbi-muted">
            <span className="font-medium text-limbi-text">Naturaleza:</span>{" "}
            {offerNatureLabelEs(profile?.offer_nature ?? null)}
          </p>
          <p className="text-sm text-limbi-muted">
            <span className="font-medium text-limbi-text">Estado:</span>{" "}
            {brandStatusLabel(brand.brand_status)}
          </p>
        </header>

        {brand.description ? (
          <p className="text-sm leading-relaxed text-limbi-text">
            {brand.description}
          </p>
        ) : null}

        {(brand.website_url || brand.country_or_market) && (
          <dl className="grid gap-2 text-sm text-limbi-muted">
            {brand.website_url ? (
              <div>
                <dt className="font-medium text-limbi-text">Web</dt>
                <dd>
                  <a
                    href={brand.website_url}
                    className="text-limbi-green underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {brand.website_url}
                  </a>
                </dd>
              </div>
            ) : null}
            {brand.country_or_market ? (
              <div>
                <dt className="font-medium text-limbi-text">Mercado / país</dt>
                <dd>{brand.country_or_market}</dd>
              </div>
            ) : null}
          </dl>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button className={limbiPrimaryButtonClass} asChild>
            <Link href={`/brands/${brandId}/questionnaire`}>
              Completar cuestionario de marca
            </Link>
          </Button>
        </div>
        <p className="text-xs text-limbi-muted">
          El diagnóstico de marca y las bases activas llegarán en tickets
          posteriores.
        </p>
      </div>
    </div>
  );
}
