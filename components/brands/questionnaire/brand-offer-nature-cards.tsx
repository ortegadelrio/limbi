"use client";

import { BRAND_OFFER_NATURE_UI_OPTIONS } from "@/lib/brands/offer-nature-ui";
import { cn } from "@/lib/utils";
import type { BrandOfferNature } from "@/types/database";

type Props = {
  value: BrandOfferNature | null;
  onSelect: (nature: BrandOfferNature) => void;
  disabled?: boolean;
  labelledBy?: string;
};

export function BrandOfferNatureCards({
  value,
  onSelect,
  disabled,
  labelledBy,
}: Props) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2"
      role="radiogroup"
      aria-labelledby={labelledBy}
    >
      {BRAND_OFFER_NATURE_UI_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelect(opt.value)}
            className={cn(
              "rounded-2xl border p-4 text-left text-sm transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/45",
              selected
                ? "border-[var(--limbi-green)] bg-limbi-bg-soft ring-2 ring-[var(--limbi-green)]/30"
                : "border-limbi-border bg-limbi-surface hover:bg-limbi-bg-soft/80",
            )}
          >
            <span className="font-medium text-limbi-text">{opt.label}</span>
            {opt.description ? (
              <span className="mt-1 block text-xs text-limbi-muted">
                {opt.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
