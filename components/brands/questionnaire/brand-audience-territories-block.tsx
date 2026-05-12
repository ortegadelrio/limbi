"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { limbiOutlineButtonClass } from "@/components/projects/limbi-ui";
import type {
  BrandAudienceTerritoryRow,
  BrandAudienceTerritoryType,
} from "@/types/database";

const TERRITORY_TYPE_OPTIONS: { value: BrandAudienceTerritoryType; label: string }[] =
  [
    { value: "city", label: "Ciudad" },
    { value: "state_department", label: "Departamento / Estado" },
    { value: "region", label: "Región" },
    { value: "country", label: "País" },
    { value: "continent", label: "Continente" },
    { value: "cultural_community", label: "Comunidad cultural" },
    { value: "global_market", label: "Mercado global" },
  ];

export type TerritoryDraft = {
  clientKey: string;
  id?: string;
  territory_type: BrandAudienceTerritoryType;
  name: string;
  display_order: number;
};

function rowsToDrafts(rows: BrandAudienceTerritoryRow[]): TerritoryDraft[] {
  return rows.map((r, i) => ({
    clientKey: r.id,
    id: r.id,
    territory_type: r.territory_type,
    name: r.name,
    display_order: r.display_order ?? i,
  }));
}

function newTerritory(order: number): TerritoryDraft {
  return {
    clientKey: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    territory_type: "city",
    name: "",
    display_order: order,
  };
}

type Props = {
  territories: TerritoryDraft[];
  onTerritoriesChange: (next: TerritoryDraft[]) => void;
  disabled?: boolean;
};

export function BrandAudienceTerritoriesBlock({
  territories,
  onTerritoriesChange,
  disabled,
}: Props) {
  const sorted = useMemo(
    () => [...territories].sort((a, b) => a.display_order - b.display_order),
    [territories],
  );

  const reorder = (list: TerritoryDraft[]) =>
    list.map((t, i) => ({ ...t, display_order: i }));

  const move = (clientKey: string, dir: -1 | 1) => {
    const idx = sorted.findIndex((x) => x.clientKey === clientKey);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[j]] = [next[j], next[idx]];
    onTerritoriesChange(reorder(next));
  };

  const remove = (clientKey: string) => {
    onTerritoriesChange(reorder(sorted.filter((x) => x.clientKey !== clientKey)));
  };

  const update = (clientKey: string, patch: Partial<TerritoryDraft>) => {
    onTerritoriesChange(
      sorted.map((x) => (x.clientKey === clientKey ? { ...x, ...patch } : x)),
    );
  };

  const add = () => {
    onTerritoriesChange([...sorted, newTerritory(sorted.length)]);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-limbi-border/80 bg-limbi-bg-soft/40 p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold text-limbi-text">
          Territorios geográficos o culturales
        </h3>
        <p className="mt-1 text-sm text-limbi-muted">
          ¿En qué territorios necesita ser relevante esta marca?
        </p>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-limbi-muted">
          Opcional. Agrega territorios si aplica a tu estrategia.
        </p>
      ) : (
        <div className="space-y-4">
          {sorted.map((t) => (
            <div
              key={t.clientKey}
              className="space-y-3 rounded-xl border border-limbi-border bg-limbi-surface p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-limbi-muted">
                  Territorio
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    disabled={disabled}
                    aria-label="Subir"
                    onClick={() => move(t.clientKey, -1)}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    disabled={disabled}
                    aria-label="Bajar"
                    onClick={() => move(t.clientKey, 1)}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 text-red-600"
                    disabled={disabled}
                    aria-label="Eliminar territorio"
                    onClick={() => remove(t.clientKey)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-limbi-text">
                  Tipo de territorio
                </label>
                <select
                  value={t.territory_type}
                  onChange={(e) =>
                    update(t.clientKey, {
                      territory_type: e.target
                        .value as BrandAudienceTerritoryType,
                    })
                  }
                  disabled={disabled}
                  className="flex h-10 w-full rounded-xl border border-limbi-border bg-limbi-surface px-3 py-2 text-sm text-limbi-text"
                >
                  {TERRITORY_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-limbi-text">
                  Nombre del territorio
                  <span className="text-red-600"> *</span>
                </label>
                <Input
                  value={t.name}
                  onChange={(e) => update(t.clientKey, { name: e.target.value })}
                  disabled={disabled}
                  className="rounded-xl border-limbi-border bg-limbi-surface"
                  maxLength={200}
                  placeholder="Ej. Ciudad de México, LATAM, mercado hispano en EE. UU."
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        className={limbiOutlineButtonClass}
        disabled={disabled}
        onClick={add}
      >
        + Agregar territorio
      </Button>
    </div>
  );
}

export function territoryDraftsFromRows(
  rows: BrandAudienceTerritoryRow[],
): TerritoryDraft[] {
  return rowsToDrafts(rows);
}

export function payloadFromTerritoryDrafts(
  drafts: TerritoryDraft[],
): {
  territory_type: BrandAudienceTerritoryType;
  name: string;
  display_order: number;
}[] {
  const sorted = [...drafts].sort((a, b) => a.display_order - b.display_order);
  return sorted
    .map((t, i) => ({
      territory_type: t.territory_type,
      name: t.name.trim(),
      display_order: i,
    }))
    .filter((t) => t.name.length > 0);
}
