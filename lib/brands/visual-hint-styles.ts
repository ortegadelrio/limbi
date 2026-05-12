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
    warm:
      "border-limbi-border/80 bg-gradient-to-br from-rose-50/90 to-amber-50/70 dark:from-rose-950/25 dark:to-amber-950/20",
    clear:
      "border-limbi-border/80 bg-gradient-to-br from-sky-50/90 to-limbi-surface dark:from-sky-950/25 dark:to-limbi-surface",
    sober:
      "border-limbi-border/80 bg-gradient-to-br from-stone-100 to-zinc-50 dark:from-stone-900/40 dark:to-zinc-950/30",
    intense:
      "border-limbi-border/80 bg-gradient-to-br from-fuchsia-50/90 to-orange-50/70 dark:from-fuchsia-950/25 dark:to-orange-950/20",
    calm:
      "border-limbi-border/80 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 dark:from-emerald-950/25 dark:to-teal-950/20",
    luminous:
      "border-limbi-border/80 bg-gradient-to-br from-yellow-50/90 to-sky-50/60 dark:from-yellow-950/20 dark:to-sky-950/25",
    creative:
      "border-limbi-border/80 bg-gradient-to-br from-violet-50/90 to-pink-50/60 dark:from-violet-950/25 dark:to-pink-950/20",
    fresh:
      "border-limbi-border/80 bg-gradient-to-br from-teal-50/90 to-cyan-50/50 dark:from-teal-950/25 dark:to-cyan-950/20",
    authority:
      "border-limbi-border/80 bg-gradient-to-br from-slate-100 to-indigo-50/70 dark:from-slate-900/50 dark:to-indigo-950/30",
    human:
      "border-limbi-border/80 bg-gradient-to-br from-rose-50/80 to-amber-50/50 dark:from-rose-950/20 dark:to-amber-950/15",
    edge:
      "border-limbi-border/80 bg-gradient-to-br from-orange-50/90 to-fuchsia-50/60 dark:from-orange-950/25 dark:to-fuchsia-950/20",
    technical:
      "border-limbi-border/80 bg-gradient-to-br from-slate-100 to-cyan-50/60 dark:from-slate-900/45 dark:to-cyan-950/25",
    elegant:
      "border-limbi-border/80 bg-gradient-to-br from-zinc-50 to-stone-100 dark:from-zinc-900/35 dark:to-stone-900/30",
  };
  return cn(
    map[key] ??
      "border-limbi-border/80 bg-limbi-surface-soft/60 hover:bg-limbi-bg-soft/90",
  );
}
