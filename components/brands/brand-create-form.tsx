"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import { OFFER_NATURE_OPTIONS } from "@/lib/brands/offer-nature-labels";
import { BRAND_STATUS_OPTIONS } from "@/lib/brands/brand-status-labels";
import type { BrandOfferNature, BrandStatus } from "@/types/database";

export function BrandCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brandStatus, setBrandStatus] = useState<BrandStatus | "">("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [countryOrMarket, setCountryOrMarket] = useState("");
  const [offerNature, setOfferNature] = useState<BrandOfferNature | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!offerNature) {
      setError("Selecciona qué ofrece principalmente esta marca.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        offer_nature: offerNature,
      };
      if (description.trim()) body.description = description.trim();
      if (brandStatus) body.brand_status = brandStatus;
      if (websiteUrl.trim()) body.website_url = websiteUrl.trim();
      if (countryOrMarket.trim()) body.country_or_market = countryOrMarket.trim();

      const res = await fetch("/api/brands", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        throw new Error(
          typeof j.error === "string" ? j.error : "No se pudo crear la marca.",
        );
      }
      router.push("/brands");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={cn("space-y-6")}
      noValidate
    >
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="brand-name" className="text-sm font-medium text-limbi-text">
          Nombre de la marca <span className="text-destructive">*</span>
        </label>
        <Input
          id="brand-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border-limbi-border"
          autoComplete="organization"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="offer-nature" className="text-sm font-medium text-limbi-text">
          ¿Qué ofrece principalmente? <span className="text-destructive">*</span>
        </label>
        <select
          id="offer-nature"
          value={offerNature}
          onChange={(e) =>
            setOfferNature(e.target.value as BrandOfferNature | "")
          }
          className="flex h-10 w-full rounded-xl border border-limbi-border bg-transparent px-3 py-2 text-sm text-limbi-text ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35"
          required
        >
          <option value="">Selecciona una opción</option>
          {OFFER_NATURE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="brand-desc" className="text-sm font-medium text-limbi-text">
          Descripción breve (opcional)
        </label>
        <Textarea
          id="brand-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="resize-none rounded-xl border-limbi-border"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="brand-status" className="text-sm font-medium text-limbi-text">
          Estado de la marca (opcional)
        </label>
        <select
          id="brand-status"
          value={brandStatus}
          onChange={(e) => setBrandStatus(e.target.value as BrandStatus | "")}
          className="flex h-10 w-full rounded-xl border border-limbi-border bg-transparent px-3 py-2 text-sm text-limbi-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35"
        >
          <option value="">Por defecto: marca nueva</option>
          {BRAND_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="website" className="text-sm font-medium text-limbi-text">
          Sitio web (opcional)
        </label>
        <Input
          id="website"
          type="text"
          inputMode="url"
          placeholder="ej. limbi.io o https://limbi.io"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className="rounded-xl border-limbi-border"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="country" className="text-sm font-medium text-limbi-text">
          País o mercado principal (opcional)
        </label>
        <Input
          id="country"
          value={countryOrMarket}
          onChange={(e) => setCountryOrMarket(e.target.value)}
          className="rounded-xl border-limbi-border"
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="submit"
          disabled={loading}
          className={cn("rounded-xl", limbiPrimaryButtonClass)}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Guardando…
            </span>
          ) : (
            "Crear marca"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={loading}
          onClick={() => router.push("/brands")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
