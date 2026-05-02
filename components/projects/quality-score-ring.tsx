"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

const R = 40;
const STROKE = 5;

function band(score: number): "low" | "mid" | "high" {
  if (score < 50) return "low";
  if (score < 80) return "mid";
  return "high";
}

type Size = "sm" | "md";

const sizeMap: Record<
  Size,
  { box: number; r: number; stroke: number; text: string }
> = {
  sm: { box: 52, r: 18, stroke: 4, text: "text-sm" },
  md: { box: 88, r: R, stroke: STROKE, text: "text-xl sm:text-2xl" },
};

type Props = {
  score: number;
  /** 0–100; se recorta al rango. */
  size?: Size;
  className?: string;
};

export function QualityScoreRing({ score, size = "md", className }: Props) {
  const reactId = useId();
  const uid = reactId.replace(/:/g, "");
  const clamped = Math.max(0, Math.min(100, Math.round(Number(score)) || 0));
  const { box, r, stroke, text } = sizeMap[size];
  const c = 2 * Math.PI * r;
  const dash = c * (1 - clamped / 100);
  const b = band(clamped);
  const label = `Puntuación de calidad: ${clamped} por ciento`;
  const strokePaint =
    b === "low"
      ? `url(#${uid}-grad-low)`
      : b === "mid"
        ? `url(#${uid}-grad-mid)`
        : `url(#${uid}-grad-high)`;

  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: box, height: box }}
      role="img"
      aria-label={label}
    >
      <svg
        width={box}
        height={box}
        viewBox={`0 0 ${box} ${box}`}
        className="-rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient
            id={`${uid}-grad-low`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#FECACA" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
          <linearGradient
            id={`${uid}-grad-mid`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient
            id={`${uid}-grad-high`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <circle
          className="fill-none"
          stroke="rgb(232 238 242)"
          strokeWidth={stroke}
          cx={box / 2}
          cy={box / 2}
          r={r}
        />
        <circle
          className="fill-none transition-[stroke-dashoffset] duration-500"
          stroke={strokePaint}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dash}
          cx={box / 2}
          cy={box / 2}
          r={r}
        />
      </svg>
      <span
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center font-semibold tabular-nums tracking-tight text-limbi-text",
          text,
        )}
        aria-hidden
      >
        {clamped}%
      </span>
    </div>
  );
}
