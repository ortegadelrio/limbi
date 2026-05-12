/**
 * Formatea instantes en **America/Bogota** con locale **es-CO** (no depende del TZ del navegador
 * cuando se ejecuta en servidor o en tests con Intl).
 */
export function formatBogotaDateTime(iso: string | Date | null | undefined): string {
  if (iso == null || iso === "") return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";

  const formatter = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${formatter.format(date)} — Hora Bogotá`;
}
