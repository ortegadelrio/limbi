import type { ClarificationQuestion } from "@/lib/questionnaire-evaluation/schema";

export type ClarificationGapKind =
  | "evidence"
  | "audience"
  | "transformation"
  | "tone"
  | "generic";

const EVIDENCE_CHIPS: { id: string; label: string }[] = [
  { id: "chip_ev_years", label: "Años de experiencia" },
  { id: "chip_ev_testimonials", label: "Testimonios" },
  { id: "chip_ev_clients", label: "Clientes/colegios anteriores" },
  { id: "chip_ev_qual", label: "Observaciones cualitativas" },
  { id: "chip_ev_cases", label: "Casos o resultados" },
  { id: "chip_ev_certs", label: "Formación/certificaciones" },
  { id: "chip_ev_other", label: "Otro" },
];

const AUDIENCE_CHIPS: { id: string; label: string }[] = [
  { id: "chip_au_parents", label: "Padres de familia" },
  { id: "chip_au_schools", label: "Colegios" },
  { id: "chip_au_teachers", label: "Profesores" },
  { id: "chip_au_caregivers", label: "Cuidadores" },
  { id: "chip_au_leaders", label: "Directivos" },
  { id: "chip_au_other", label: "Otro" },
];

const TRANSFORM_CHIPS: { id: string; label: string }[] = [
  { id: "chip_tr_calm", label: "Más calma" },
  { id: "chip_tr_anxiety", label: "Menos ansiedad" },
  { id: "chip_tr_conv", label: "Mejor convivencia" },
  { id: "chip_tr_disposition", label: "Mejor disposición" },
  { id: "chip_tr_routine", label: "Rutina más ordenada" },
  { id: "chip_tr_other", label: "Otro" },
];

const TONE_CHIPS: { id: string; label: string }[] = [
  { id: "chip_to_close", label: "Más cercano" },
  { id: "chip_to_expert", label: "Más experto" },
  { id: "chip_to_serene", label: "Más sereno" },
  { id: "chip_to_commercial", label: "Más comercial" },
  { id: "chip_to_emotional", label: "Más emocional" },
  { id: "chip_to_other", label: "Otro" },
];

function inferGapKindFromQuestion(q: ClarificationQuestion): ClarificationGapKind {
  const blob = `${q.limbi_detection ?? ""} ${q.question_text} ${q.why_it_matters}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (
    /evidencia|prueba|resultado|metrica|métrica|caso|testimonio|dato|cifra|track|historial/.test(
      blob,
    )
  ) {
    return "evidence";
  }
  if (
    /audiencia|padres|colegios|familia|decisor|usuario|cliente|comprador|prioridad|quien decide/.test(
      blob,
    )
  ) {
    return "audience";
  }
  if (
    /transform|beneficio|cambio|calma|ansiedad|convivencia|rutina|disposicion|disposición|impacto emocional/.test(
      blob,
    )
  ) {
    return "transformation";
  }
  if (/tono|voz|estilo|registro|comunicar|sereno|cercano|comercial|emocional/.test(blob)) {
    return "tone";
  }
  return "generic";
}

function chipsForKind(kind: ClarificationGapKind): { id: string; label: string }[] {
  switch (kind) {
    case "evidence":
      return EVIDENCE_CHIPS;
    case "audience":
      return AUDIENCE_CHIPS;
    case "transformation":
      return TRANSFORM_CHIPS;
    case "tone":
      return TONE_CHIPS;
    default:
      return [];
  }
}

/**
 * Si el modelo no dio suficientes opciones, añade chips de dirección según el tipo de brecha inferido.
 */
export function mergeClarificationSuggestionChips(
  q: ClarificationQuestion,
): ClarificationQuestion {
  const existing = q.options ?? [];
  if (existing.length >= 4) return q;

  const kind = inferGapKindFromQuestion(q);
  const presets = chipsForKind(kind);
  if (presets.length === 0) return q;

  const seen = new Set(existing.map((o) => o.label.trim().toLowerCase()));
  const merged = [...existing];
  for (const p of presets) {
    const k = p.label.trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      merged.push({ id: p.id, label: p.label });
    }
  }

  return { ...q, options: merged.slice(0, 8) };
}
