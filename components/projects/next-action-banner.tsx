"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { NextActionVariant } from "./system-status-utils";

type Props = {
  variant: NextActionVariant;
  title: string;
  description: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
};

const VARIANT_RING: Record<NextActionVariant, string> = {
  neutral: "ring-1 ring-limbi-border/90",
  success: "ring-1 ring-limbi-green/25",
  warning: "ring-1 ring-limbi-yellow/35",
  active: "ring-2 ring-limbi-green/30 ring-offset-2 ring-offset-limbi-bg-soft",
};

const VARIANT_SURFACE: Record<NextActionVariant, string> = {
  neutral: "border-limbi-border bg-limbi-surface-soft/90",
  success: "border-limbi-green/20 bg-limbi-green/[0.06]",
  warning: "border-limbi-yellow/30 bg-limbi-yellow/[0.06]",
  active: "border-limbi-green/25 bg-limbi-surface shadow-limbi",
};

export function NextActionBanner({
  variant,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: Props) {
  return (
    <section
      aria-labelledby="next-action-title"
      className={cn(
        "rounded-2xl border p-5 sm:p-6",
        VARIANT_SURFACE[variant],
        VARIANT_RING[variant],
        className,
      )}
    >
      <h2
        id="next-action-title"
        className="font-heading text-base font-semibold tracking-tight text-limbi-text"
      >
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-limbi-muted">
        {description}
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap gap-2">{primaryAction}</div>
        {secondaryAction ? (
          <div className="flex flex-wrap gap-2 sm:ml-0">{secondaryAction}</div>
        ) : null}
      </div>
    </section>
  );
}
