"use client";

import type { QuestionOption } from "@/types/database";
import { visualHintCardClass } from "@/lib/brands/visual-hint-styles";
import { cn } from "@/lib/utils";

type Mode = "single" | "multi";

type Props = {
  mode: Mode;
  options: QuestionOption[];
  /** single: selected value; multi: selected values */
  selectedValues: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
  labelledBy?: string;
};

function OptionCard({
  opt,
  mode,
  selected,
  onSelect,
  disabled,
}: {
  opt: QuestionOption;
  mode: Mode;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const hasVisual =
    Boolean(opt.image_url) ||
    Boolean(opt.description) ||
    Boolean(opt.emoji) ||
    Boolean(opt.visual_hint);

  return (
    <button
      type="button"
      role={mode === "multi" ? "checkbox" : "radio"}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col rounded-2xl border p-4 text-left transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/45",
        selected
          ? "border-[var(--limbi-green)] ring-2 ring-[var(--limbi-green)]/35 shadow-limbi-primary"
          : "border-limbi-border hover:-translate-y-px hover:shadow-limbi-hover",
        hasVisual ? visualHintCardClass(opt.visual_hint) : "bg-limbi-surface",
      )}
    >
      {opt.image_url ? (
        <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded-xl bg-limbi-bg-soft">
          {/* eslint-disable-next-line @next/next/no-img-element -- URLs externas opcionales sin dominios fijos en next.config */}
          <img
            src={opt.image_url}
            alt=""
            className="size-full object-cover"
          />
        </div>
      ) : null}
      <div className="flex items-start gap-2">
        {opt.emoji ? (
          <span className="text-2xl leading-none" aria-hidden>
            {opt.emoji}
          </span>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <span className="block text-sm font-semibold text-limbi-text">
            {opt.label}
          </span>
          {opt.description ? (
            <span className="block text-xs leading-relaxed text-limbi-muted">
              {opt.description}
            </span>
          ) : null}
        </div>
        {mode === "multi" ? (
          <span
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold",
              selected
                ? "border-[var(--limbi-green)] bg-[var(--limbi-green)] text-white"
                : "border-limbi-border bg-limbi-surface text-transparent",
            )}
            aria-hidden
          >
            ✓
          </span>
        ) : (
          <span
            className={cn(
              "mt-1 size-3 shrink-0 rounded-full border-2",
              selected
                ? "border-[var(--limbi-green)] bg-[var(--limbi-green)]"
                : "border-limbi-border bg-transparent",
            )}
            aria-hidden
          />
        )}
      </div>
    </button>
  );
}

/** Opciones como tarjetas/botones; soporta `description`, `emoji`, `visual_hint`, `image_url`. */
export function BrandChoiceOptionGrid({
  mode,
  options,
  selectedValues,
  onToggle,
  disabled,
  labelledBy,
}: Props) {
  if (options.length === 0) return null;

  const compact = options.length > 5 && !options.some((o) => o.image_url);

  return (
    <div
      className={cn(
        "grid gap-3",
        compact
          ? "grid-cols-1 sm:grid-cols-2"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2",
      )}
      role="group"
      aria-labelledby={labelledBy}
    >
      {options.map((opt) => {
        const selected = selectedValues.includes(opt.value);
        return (
          <OptionCard
            key={opt.value}
            opt={opt}
            mode={mode}
            selected={selected}
            disabled={disabled}
            onSelect={() => onToggle(opt.value)}
          />
        );
      })}
    </div>
  );
}
