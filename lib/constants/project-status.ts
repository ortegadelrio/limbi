/** Etiquetas visibles para `projects.status` (CHECK en migración). Fase 1: lenguaje de producto. */
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: "Por construir",
  responses_completed: "Activo",
  master_created: "Lectura Límbica lista",
  framework_created: "Marco Límbico en borrador",
  framework_approved: "Listo para crear piezas",
};

export function projectStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return PROJECT_STATUS_LABELS[status] ?? status;
}
