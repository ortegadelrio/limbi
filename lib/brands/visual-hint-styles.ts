import { cn } from "@/lib/utils";

/** Fondos suaves por `visual_hint` en opciones de catálogo (extensible). */
export function visualHintCardClass(visualHint?: string | null): string {
  const key = visualHint?.trim().toLowerCase() ?? "";
  const map: Record<string, string> = {
    soft_light:
      "border-limbi-border/80 bg-gradient-to-br from-amber-50/90 via-limbi-surface to-sky-50/50 dark:from-amber-950/20 dark:via-limbi-surface dark:to-sky-950/20",
    urban_energy:
      "border-limbi-border/80 bg-gradient-to-br from-slate-100 via-limbi-surface to-emerald-50/60 dark:from-slate-900/40 dark:via-limbi-surface dark:to-emerald-950/30",
    warm_glow:
      "border-limbi-border/80 bg-gradient-to-br from-orange-50/90 to-rose-50/50 dark:from-orange-950/25 dark:to-rose-950/20",
    cool_clarity:
      "border-limbi-border/80 bg-gradient-to-br from-cyan-50/80 to-limbi-surface dark:from-cyan-950/25 dark:to-limbi-surface",
    deep_focus:
      "border-limbi-border/80 bg-gradient-to-br from-indigo-50/80 to-limbi-surface dark:from-indigo-950/30 dark:to-limbi-surface",
  };
  return cn(
    map[key] ??
      "border-limbi-border/80 bg-limbi-surface-soft/60 hover:bg-limbi-bg-soft/90",
  );
}
