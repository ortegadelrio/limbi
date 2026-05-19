import { dedupeSessionProgressFields } from "@/lib/brainstormer/dedupe-session-progress";
import type { BrainstormerSessionProgressPayload } from "@/lib/schemas/brainstormer-session";

export type OperationalSummarySection = {
  id: string;
  label: string;
  value: string;
  variant?: "list";
};

const SECTION_DEFS: ReadonlyArray<{
  id: string;
  label: string;
  field?: keyof BrainstormerSessionProgressPayload;
  variant?: "list";
}> = [
  { id: "challenge", label: "Reto actual", field: "current_challenge" },
  { id: "direction", label: "Dirección", field: "preliminary_objective" },
  { id: "audience", label: "Audiencia priorizada", field: "audience_notes" },
  { id: "tension", label: "Tensión o problema", field: "tension_or_pain" },
  { id: "ideas", label: "Decisiones tomadas", field: "ideas_explored", variant: "list" },
  { id: "routes", label: "Rutas recomendadas", field: "recommended_routes" },
  { id: "deliverable", label: "Entregable detectado", field: "project_seed_summary" },
  { id: "opportunities", label: "Oportunidades", field: "opportunities" },
  { id: "pending", label: "Pendientes", field: "open_questions", variant: "list" },
  { id: "next", label: "Siguiente paso", field: "next_step" },
];

function trimField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** True si hay al menos un campo útil para mostrar (no solo defaults vacíos). */
export function hasOperationalSummaryContent(
  progress: BrainstormerSessionProgressPayload,
): boolean {
  if (trimField(progress.session_summary)) return true;
  for (const def of SECTION_DEFS) {
    if (def.field && trimField(progress[def.field])) return true;
  }
  return progress.missing_project_inputs.some((item) => item.trim().length > 0);
}

function splitListLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•\-–*]+/, "").trim())
    .filter((line) => line.length > 0);
}

/** Secciones compactas para UI (sin JSON). */
export function buildOperationalSummarySections(
  progress: BrainstormerSessionProgressPayload,
): OperationalSummarySection[] {
  const cleaned = dedupeSessionProgressFields(progress);
  const sections: OperationalSummarySection[] = [];

  const summary = trimField(cleaned.session_summary);
  if (summary) {
    sections.push({ id: "summary", label: "Resumen", value: summary });
  }

  for (const def of SECTION_DEFS) {
    if (!def.field) continue;
    const value = trimField(cleaned[def.field]);
    if (!value) continue;
    sections.push({
      id: def.id,
      label: def.label,
      value,
      variant: def.variant,
    });
  }

  const missing = cleaned.missing_project_inputs
    .map((item) => item.trim())
    .filter(Boolean);
  if (missing.length > 0) {
    const existingPending = sections.find((s) => s.id === "pending");
    if (existingPending) {
      const combined = [
        ...splitListLines(existingPending.value),
        ...missing,
      ];
      existingPending.value = combined.map((line) => `- ${line}`).join("\n");
      existingPending.variant = "list";
    } else {
      sections.push({
        id: "missing_inputs",
        label: "Pendientes",
        value: missing.map((line) => `- ${line}`).join("\n"),
        variant: "list",
      });
    }
  }

  return sections;
}

export function formatOperationalSummaryListItems(value: string): string[] {
  const lines = splitListLines(value);
  if (lines.length > 1) return lines;
  if (value.includes(";")) {
    return value
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return lines;
}
