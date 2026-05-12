"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useMemo } from "react";
import {
  defaultItemTypeForOfferNature,
  offerSectionAddButtonLabel,
} from "@/lib/brands/offer-nature-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { limbiOutlineButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import type {
  BrandOfferItemRow,
  BrandOfferItemType,
  BrandOfferNature,
} from "@/types/database";

export type OfferItemDraft = {
  clientKey: string;
  id?: string;
  item_type: BrandOfferItemType;
  title: string;
  description: string;
  display_order: number;
};

function toDrafts(items: BrandOfferItemRow[]): OfferItemDraft[] {
  return items.map((it, i) => ({
    clientKey: it.id,
    id: it.id,
    item_type: it.item_type,
    title: it.title,
    description: it.description ?? "",
    display_order: it.display_order ?? i,
  }));
}

function newDraftItem(nature: BrandOfferNature, order: number): OfferItemDraft {
  return {
    clientKey: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    item_type: defaultItemTypeForOfferNature(nature),
    title: "",
    description: "",
    display_order: order,
  };
}

type Props = {
  offerNature: BrandOfferNature;
  items: OfferItemDraft[];
  onItemsChange: (next: OfferItemDraft[]) => void;
  disabled?: boolean;
};

export function BrandOfferItemsBlock({
  offerNature,
  items,
  onItemsChange,
  disabled,
}: Props) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.display_order - b.display_order),
    [items],
  );

  const reorder = (list: OfferItemDraft[]) =>
    list.map((it, i) => ({ ...it, display_order: i }));

  const move = (clientKey: string, dir: -1 | 1) => {
    const idx = sorted.findIndex((x) => x.clientKey === clientKey);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[j]] = [next[j], next[idx]];
    onItemsChange(reorder(next));
  };

  const remove = (clientKey: string) => {
    onItemsChange(reorder(sorted.filter((x) => x.clientKey !== clientKey)));
  };

  const update = (clientKey: string, patch: Partial<OfferItemDraft>) => {
    onItemsChange(
      sorted.map((x) => (x.clientKey === clientKey ? { ...x, ...patch } : x)),
    );
  };

  const add = () => {
    onItemsChange([
      ...sorted,
      newDraftItem(offerNature, sorted.length),
    ]);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-limbi-muted">
        Puedes escribir poco. Lo importante es ordenar qué ofrece la marca. La
        propuesta de valor la veremos más adelante.
      </p>
      <div className="space-y-4">
        {sorted.length === 0 ? (
          <p className="text-sm text-limbi-muted">
            Aún no hay ítems. Usa el botón de abajo para agregar el primero.
          </p>
        ) : (
          sorted.map((it) => (
            <div
              key={it.clientKey}
              className="space-y-3 rounded-2xl border border-limbi-border bg-limbi-surface/60 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-limbi-muted">
                  Ítem de oferta
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0"
                    disabled={disabled}
                    aria-label="Subir"
                    onClick={() => move(it.clientKey, -1)}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0"
                    disabled={disabled}
                    aria-label="Bajar"
                    onClick={() => move(it.clientKey, 1)}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0 text-red-600 hover:text-red-700"
                    disabled={disabled}
                    aria-label="Eliminar ítem"
                    onClick={() => remove(it.clientKey)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-limbi-text">
                  Nombre del servicio, producto, solución, característica o componente
                  <span className="text-red-600"> *</span>
                </label>
                <Input
                  value={it.title}
                  onChange={(e) => update(it.clientKey, { title: e.target.value })}
                  disabled={disabled}
                  className="rounded-xl border-limbi-border bg-limbi-surface"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-limbi-text">
                  Descripción breve{" "}
                  <span className="font-normal text-limbi-muted">(opcional)</span>
                </label>
                <Textarea
                  value={it.description}
                  onChange={(e) =>
                    update(it.clientKey, { description: e.target.value })
                  }
                  disabled={disabled}
                  rows={3}
                  className={cn(
                    "rounded-xl border-limbi-border bg-limbi-surface",
                    "min-h-[72px] resize-y",
                  )}
                  maxLength={3000}
                />
              </div>
            </div>
          ))
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        className={limbiOutlineButtonClass}
        disabled={disabled}
        onClick={add}
      >
        {offerSectionAddButtonLabel(offerNature)}
      </Button>
    </div>
  );
}

export function offerItemDraftsFromRows(rows: BrandOfferItemRow[]): OfferItemDraft[] {
  return toDrafts(rows);
}

export function payloadFromOfferItemDrafts(
  drafts: OfferItemDraft[],
): { item_type: BrandOfferItemType; title: string; description: string | null; display_order: number }[] {
  const sorted = [...drafts].sort((a, b) => a.display_order - b.display_order);
  return sorted
    .map((it, i) => ({
      item_type: it.item_type,
      title: it.title.trim(),
      description: it.description.trim() || null,
      display_order: i,
    }))
    .filter((it) => it.title.length > 0);
}
