"use client";

import {
  THINKING_MODEL_SELECTOR_OPTIONS,
  getThinkingModelByKey,
  type ThinkingModelKey,
} from "@/lib/ai/thinking-models";
import { cn } from "@/lib/utils";

export function ThinkingModelSelector(props: {
  value: ThinkingModelKey;
  onChange: (key: ThinkingModelKey) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-limbi-text">Modelo de pensamiento</p>
        <p className="text-xs text-limbi-muted">
          Elegí con qué creativo estratégico de la agencia querés trabajar en esta sesión.
        </p>
      </div>
      <div
        className="grid gap-2 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Modelo de pensamiento"
      >
        {THINKING_MODEL_SELECTOR_OPTIONS.map((key) => {
          const model = getThinkingModelByKey(key)!;
          const selected = props.value === key;
          return (
            <label
              key={key}
              className={cn(
                "cursor-pointer rounded-xl border px-3 py-3 text-left transition-colors",
                selected
                  ? "border-limbi-green/50 bg-limbi-green/[0.08]"
                  : "border-limbi-border bg-limbi-surface hover:border-limbi-green/25",
                props.disabled && "pointer-events-none opacity-60",
              )}
            >
              <input
                type="radio"
                name="thinking_model"
                className="sr-only"
                value={key}
                checked={selected}
                disabled={props.disabled}
                onChange={() => props.onChange(key)}
              />
              <span className="block text-sm font-medium text-limbi-text">{model.publicName}</span>
              <span className="mt-1 block text-xs leading-relaxed text-limbi-muted">
                {model.selectorMicrocopy}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
