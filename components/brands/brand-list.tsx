import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import { offerNatureLabelEs } from "@/lib/brands/offer-nature-labels";
import type { BrandOfferNature, BrandStatus } from "@/types/database";

export type BrandListItem = {
  id: string;
  name: string;
  description: string | null;
  brand_status: BrandStatus;
  website_url: string | null;
  country_or_market: string | null;
  updated_at: string;
  offer_nature: BrandOfferNature | null;
};

function formatUpdatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function BrandList({ brands }: { brands: BrandListItem[] }) {
  if (brands.length === 0) {
    return (
      <div
        className={cn(limbiDocumentCardClass, "p-8 text-center")}
        data-testid="brand-list-empty"
      >
        <p className="text-sm text-limbi-muted">
          Aún no tienes marcas. Crea la primera para separar la memoria de marca
          de tus proyectos.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4" aria-label="Lista de marcas">
      {brands.map((b) => (
        <li key={b.id}>
          <Card
            className={cn(
              limbiDocumentCardClass,
              "overflow-hidden transition-shadow hover:shadow-md",
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg text-limbi-text">
                {b.name}
              </CardTitle>
              <CardDescription className="text-limbi-muted">
                {offerNatureLabelEs(b.offer_nature)} · Actualizado{" "}
                {formatUpdatedAt(b.updated_at)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0 sm:flex-row sm:items-center sm:justify-between">
              {b.description ? (
                <p className="line-clamp-2 text-sm text-limbi-muted">
                  {b.description}
                </p>
              ) : (
                <span className="text-sm text-limbi-muted">Sin descripción</span>
              )}
              <Link
                href={`/brands/${b.id}`}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-limbi-green hover:underline"
              >
                Ver marca
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
