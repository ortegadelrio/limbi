"use client";

import { cn } from "@/lib/utils";
import type { SystemHealthStripModel } from "./system-status-utils";

type Props = {
  model: SystemHealthStripModel;
  className?: string;
};

export function SystemHealthStrip({ model, className }: Props) {
  const items = [
    model.lecturaLine,
    model.marcoLine,
    model.piezasLine,
    model.estadoLine,
  ];
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-limbi-border bg-limbi-surface px-4 py-3.5 text-sm text-limbi-text shadow-limbi sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1 sm:gap-y-1 sm:px-5",
        className,
      )}
      role="status"
    >
      {items.map((line, i) => (
        <span key={`${String(i)}-${line}`} className="flex items-center gap-1">
          {i > 0 ? (
            <span
              className="mx-1 hidden text-limbi-border sm:inline"
              aria-hidden
            >
              ·
            </span>
          ) : null}
          <span className="leading-snug text-limbi-text">{line}</span>
        </span>
      ))}
    </div>
  );
}
