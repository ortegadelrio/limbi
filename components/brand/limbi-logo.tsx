"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export type LimbiLogoVariant = "full" | "wordmark" | "symbol";
export type LimbiLogoSize = "sm" | "md" | "lg";

export type LimbiLogoProps = {
  variant?: LimbiLogoVariant;
  size?: LimbiLogoSize;
  showSubtitle?: boolean;
  className?: string;
};

const SIZE_TOKENS = {
  sm: {
    icon: 32,
    gap: "gap-2.5",
    wordmark: "text-lg sm:text-xl",
    subtitle: "text-xs sm:text-sm",
  },
  md: {
    icon: 40,
    gap: "gap-3",
    wordmark: "text-xl sm:text-2xl",
    subtitle: "text-sm",
  },
  lg: {
    icon: 52,
    gap: "gap-3.5",
    wordmark: "text-2xl sm:text-3xl",
    subtitle: "text-sm sm:text-base",
  },
} as const;

function svgGradientId(rawId: string) {
  return `limbi-logo-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function LimbiIsotype({
  pixelSize,
  gradId,
  decorative,
}: {
  pixelSize: number;
  gradId: string;
  decorative: boolean;
}) {
  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 80 80"
      className="shrink-0"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : "Limbi"}
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="8"
          y1="10"
          x2="72"
          y2="70"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#10B981" />
          <stop offset="0.48" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      <path
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="4.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M 58 20 C 42 10 22 14 14 30 C 6 46 14 64 32 68 C 46 71 60 62 66 48"
      />
      <path
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.88}
        d="M 48 30 C 38 24 26 28 22 38 C 18 48 24 58 36 60 C 44 61 52 56 54 48"
      />
    </svg>
  );
}

export function LimbiLogo({
  variant = "wordmark",
  size = "md",
  showSubtitle: showSubtitleProp,
  className,
}: LimbiLogoProps) {
  const gradId = svgGradientId(useId());
  const t = SIZE_TOKENS[size];

  const showSubtitle =
    variant === "full"
      ? (showSubtitleProp ?? true)
      : (showSubtitleProp ?? false);

  if (variant === "symbol") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <LimbiIsotype
          pixelSize={t.icon}
          gradId={gradId}
          decorative={false}
        />
      </span>
    );
  }

  const symbolDecorative = true;

  return (
    <span
      className={cn("inline-flex max-w-full items-start", t.gap, className)}
    >
      <LimbiIsotype
        pixelSize={t.icon}
        gradId={`${gradId}-mark`}
        decorative={symbolDecorative}
      />
      <span className="flex min-w-0 flex-col justify-center leading-tight">
        <span
          className={cn(
            "font-heading font-semibold tracking-tight text-limbi-text",
            t.wordmark,
          )}
        >
          <span className="inline text-current">L</span>
          <span className="inline lowercase text-current">imbi</span>
        </span>
        {showSubtitle ? (
          <span
            className={cn(
              "mt-0.5 font-medium leading-snug text-limbi-muted",
              t.subtitle,
            )}
          >
            Plataforma Límbica Digital
          </span>
        ) : null}
      </span>
    </span>
  );
}
