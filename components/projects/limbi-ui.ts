/** Copy y tokens visuales compartidos (Aire Digital), sin lógica de negocio. */

export const LIMBI_LOADING_MESSAGES = [
  "Estamos pensando y actualizando tu Sistema Límbico…",
  "Estamos ordenando señales, emociones e intención…",
  "Estamos traduciendo tu información en dirección narrativa…",
  "Estamos afinando el pulso estratégico del sistema…",
] as const;

/** Mensaje estable por pantalla/recurso (misma sesión = mismo texto). */
export function limbiLoadingMessage(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % LIMBI_LOADING_MESSAGES.length;
  return LIMBI_LOADING_MESSAGES[idx]!;
}

/** Fondo de página con gradiente Aire Digital (complementa body en globals). */
export const limbiPageShellClass =
  "min-h-0 flex-1 flex-col bg-transparent";

/** Cabecera de página interna (clara, aire). */
export const limbiShellHeaderClass =
  "border-b border-limbi-border/90 bg-limbi-surface/90 backdrop-blur-sm";

/** Botón primario: gradiente verde → aqua, elevación suave. */
export const limbiPrimaryButtonClass =
  "rounded-xl border-0 bg-gradient-to-br from-[var(--limbi-green)] to-[var(--limbi-aqua)] text-white shadow-limbi-primary transition-all duration-200 hover:-translate-y-px hover:shadow-[0_12px_32px_rgba(16,185,129,0.35)] hover:brightness-[1.02] active:translate-y-0";

/** Outline secundario (blanco / borde limpio). */
export const limbiOutlineButtonClass =
  "rounded-xl border border-limbi-border bg-limbi-surface text-limbi-text shadow-sm transition-all duration-200 hover:bg-limbi-bg-soft hover:border-limbi-border";

/** Tarjeta de documento / bloque principal. */
export const limbiDocumentCardClass =
  "rounded-[22px] border border-limbi-border bg-limbi-surface shadow-limbi transition-all duration-200 hover:-translate-y-px hover:shadow-limbi-hover";

/** Cabecera interna de card de documento. */
export const limbiDocumentCardHeaderClass =
  "rounded-t-[22px] border-b border-limbi-border bg-limbi-surface-soft/90";

/** Celda de métrica (listados, dashboard). */
export const limbiMetricCellClass =
  "rounded-xl border border-limbi-border/80 bg-limbi-bg-soft/80 px-3 py-2.5";

/** Tabs estilo underline (Piezas narrativas, etc.); combinar con `relative` en el botón. */
export const limbiTabActiveClass =
  "relative text-limbi-text after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-limbi-green after:to-limbi-aqua";

export const limbiTabInactiveClass =
  "relative text-limbi-muted hover:text-limbi-text";
