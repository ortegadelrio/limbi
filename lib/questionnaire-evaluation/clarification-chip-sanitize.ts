import {
  CLARIFICATION_SKIP_CONTINUE_BASE_ID,
  CLARIFICATION_SKIP_IMPROVE_LATER_ID,
  CLARIFICATION_SKIP_NOT_AVAILABLE_ID,
  CLARIFICATION_UNIVERSAL_SKIP_OPTIONS,
  isUniversalClarificationSkipOptionId,
} from "@/lib/questionnaire-evaluation/clarification-skip-constants";
import type { ClarificationQuestion } from "@/lib/questionnaire-evaluation/schema";

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export type ProjectChipCategory =
  | "wellness_yoga"
  | "cocktails_beverage"
  | "alcohol_communication"
  | "b2b_corporate"
  | "generic";

export type ClarificationChipQuestionKind =
  | "evidence"
  | "audience"
  | "differentiation_product"
  | "challenge_friction"
  | "transformation_experience"
  | "transformation_wellness"
  | "tone"
  | "unknown";

const WELLNESS_MARKERS =
  /\b(yoga|meditaci|mindfulness|pilates|bienestar|salud mental|relajaci|aula|escuela|niñ|infantil|familia en aula)\b/i;

const COCKTAIL_BAR_MARKERS =
  /\b(cocktail|coctel|cóctel|mezcal|gin|ron|whisky|whiskey|vodka|bar\b|bebida|mixologi|brindis|tragos|cocteleria|coctelería|aperitivo|digestivo|licor|cerveza artesanal|vinos?\b)\b/i;

const ALCOHOL_MARKERS =
  /\b(alcohol|alcoholic|etanol|bebidas? alcoholicas?|graduaci|abv|destilad|licoreria|licorería|bar nocturno|coctel alcoholic)\b/i;

const B2B_TECH_MARKERS =
  /\b(saas|b2b|software|api|plataforma tecnologica|tecnologia|cloud|enterprise|corporativ|comunicacion interna)\b/i;

/**
 * Heurística de categoría del proyecto para chips (no sustituye el cuestionario).
 */
export function detectProjectChipCategory(
  responses: Record<string, unknown>,
): ProjectChipCategory {
  const blob = fold(JSON.stringify(responses));
  if (ALCOHOL_MARKERS.test(blob) || COCKTAIL_BAR_MARKERS.test(blob)) {
    if (ALCOHOL_MARKERS.test(blob) || /\b(vino|cerveza|destilad|licor|graduacion|abv)\b/i.test(blob)) {
      return "alcohol_communication";
    }
    return "cocktails_beverage";
  }
  if (WELLNESS_MARKERS.test(blob)) return "wellness_yoga";
  if (B2B_TECH_MARKERS.test(blob)) return "b2b_corporate";
  return "generic";
}

/**
 * Clasificación estricta por texto de la pregunta (orden importa: evidencia antes que transformación genérica).
 */
export function inferClarificationChipQuestionKind(
  q: ClarificationQuestion,
): ClarificationChipQuestionKind {
  const blob = fold(
    `${q.limbi_detection ?? ""} ${q.question_text} ${q.why_it_matters ?? ""}`,
  );

  if (
    /\b(cual es el reto|cuál es el reto|que reto|qué reto|reto principal|friccion central|fricción central|desafio central|desafío central|problema central|dolor principal|obstaculo principal|obstáculo principal|que tension|qué tensión)\b/.test(
      blob,
    ) ||
    (/\b(reto|desafio|desafío|fricción|friccion|barrera|obstaculo|obstáculo)\b/.test(
      blob,
    ) &&
      /\b(aclara|precisa|concreta|matizar|profundiza|define|acota)\b/.test(blob))
  ) {
    return "challenge_friction";
  }

  if (
    /\b(que evidencia|qué evidencia|evidencias?|evidencia real|pruebas?|testimonios?|casos?|resultados? medibles?|datos?|metricas?|métricas?|cifras?|certificaciones?|certificacion|certificación|track record|historial comprobable)\b/.test(
      blob,
    )
  ) {
    return "evidence";
  }

  if (
    /\b(quien decide|quién decide|prioridad entre|audiencia principal|comprador|stakeholder|usuario final|decisor|familia vs|padres vs|colegio vs)\b/.test(
      blob,
    )
  ) {
    return "audience";
  }

  if (
    /\b(diferencia|diferenciac|distintivo|vs otras|competidor|por que elegirte|por qué elegirte|que te hace unico|qué te hace único|unico frente|único frente)\b/.test(
      blob,
    )
  ) {
    return "differentiation_product";
  }

  if (
    /\b(tono|voz|deberia sonar|debería sonar|registro|estilo de comunicacion|estilo de comunicación)\b/.test(
      blob,
    )
  ) {
    return "tone";
  }

  if (
    /\b(calma|ansiedad|convivencia en aula|rutina ordenada|conexion corporal|conexión corporal|disposicion emocional|disposición emocional|bienestar emocional)\b/.test(
      blob,
    ) &&
    /\b(participante|alumno|aula|yoga|meditaci|mindfulness)\b/.test(blob)
  ) {
    return "transformation_wellness";
  }

  if (
    /\b(experiencia del consumidor|experiencia memorable|que experiencia|qué experiencia|sensorial|momento memorable|vivir el consumidor|vivir la experiencia)\b/.test(
      blob,
    ) ||
    (/\b(transformacion|transformación|cambio que|beneficio para)\b/.test(blob) &&
      /\b(consumidor|cliente|invitado|asistente|publico|público)\b/.test(blob) &&
      !/\b(eviden|prueba|metrica|métrica)\b/.test(blob))
  ) {
    return "transformation_experience";
  }

  if (
    /\bcambio\b/.test(blob) &&
    /\b(participantes?|alumnos?|usuarios?|clientes?|consumidores?|aulas?|clases?)\b/.test(
      blob,
    ) &&
    !/\b(eviden|prueba|metrica|métrica|testimonio)\b/.test(blob)
  ) {
    return "transformation_experience";
  }

  if (
    /\b(transform|beneficio|cambio esper|percepci|movimiento emocional|impacto emocional)\b/.test(
      blob,
    ) &&
    !/\b(eviden|prueba|metrica|métrica|testimonio)\b/.test(blob)
  ) {
    return "transformation_experience";
  }

  return "unknown";
}

const EVIDENCE_CHIPS: { id: string; label: string }[] = [
  { id: "chip_ev_years", label: "Años de experiencia" },
  { id: "chip_ev_testimonials", label: "Testimonios" },
  { id: "chip_ev_clients", label: "Clientes anteriores" },
  { id: "chip_ev_cases", label: "Casos o resultados" },
  { id: "chip_ev_qual", label: "Trayectoria o protocolos" },
  { id: "chip_ev_certs", label: "Certificaciones o formación" },
  { id: "chip_ev_other", label: "Otro" },
];

const AUDIENCE_CHIPS: { id: string; label: string }[] = [
  { id: "chip_au_end_consumers", label: "Clientes finales" },
  { id: "chip_au_buyers", label: "Compradores actuales" },
  { id: "chip_au_parents", label: "Padres de familia" },
  { id: "chip_au_schools", label: "Colegios" },
  { id: "chip_au_leaders", label: "Directivos" },
  { id: "chip_au_teachers", label: "Profesores" },
  { id: "chip_au_caregivers", label: "Cuidadores" },
  { id: "chip_au_allies", label: "Aliados" },
  { id: "chip_au_other", label: "Otro" },
];

const COCKTAIL_DIFFERENTIATION_CHIPS: { id: string; label: string }[] = [
  { id: "chip_cd_exotic", label: "Sabores exóticos" },
  { id: "chip_cd_original_mix", label: "Mezclas originales" },
  { id: "chip_cd_presentation", label: "Presentación llamativa" },
  { id: "chip_cd_ingredients", label: "Ingredientes seleccionados" },
  { id: "chip_cd_premium", label: "Experiencia premium" },
  { id: "chip_cd_craft", label: "Preparación artesanal" },
  { id: "chip_cd_other", label: "Otro" },
];

const COCKTAIL_EXPERIENCE_CHIPS: { id: string; label: string }[] = [
  { id: "chip_ce_flavor", label: "Sabor diferente" },
  { id: "chip_ce_moment", label: "Momento memorable" },
  { id: "chip_ce_social", label: "Experiencia social" },
  { id: "chip_ce_premium_feel", label: "Sensación premium" },
  { id: "chip_ce_discovery", label: "Descubrimiento de sabores" },
  { id: "chip_ce_celebration", label: "Celebración" },
  { id: "chip_ce_shareable", label: "Fácil de compartir" },
  { id: "chip_ce_other", label: "Otro" },
];

const WELLNESS_TRANSFORM_CHIPS: { id: string; label: string }[] = [
  { id: "chip_tw_calm", label: "Más calma" },
  { id: "chip_tw_anxiety", label: "Menos ansiedad" },
  { id: "chip_tw_mood", label: "Mejor disposición" },
  { id: "chip_tw_conv", label: "Mejor convivencia" },
  { id: "chip_tw_routine", label: "Rutina más ordenada" },
  { id: "chip_tw_body", label: "Mayor conexión corporal" },
  { id: "chip_tw_other", label: "Otro" },
];

const TONE_CHIPS: { id: string; label: string }[] = [
  { id: "chip_to_close", label: "Cercana" },
  { id: "chip_to_expert", label: "Experta" },
  { id: "chip_to_serene", label: "Serena" },
  { id: "chip_to_commercial", label: "Comercial" },
  { id: "chip_to_emotional", label: "Emocional" },
  { id: "chip_to_premium", label: "Premium" },
  { id: "chip_to_direct", label: "Directa" },
  { id: "chip_to_other", label: "Otro" },
];

const GENERIC_TRANSFORM_CHIPS: { id: string; label: string }[] = [
  { id: "chip_gt_clarity", label: "Más claridad" },
  { id: "chip_gt_confidence", label: "Más confianza" },
  { id: "chip_gt_trust", label: "Más confianza hacia la marca" },
  { id: "chip_gt_consideration", label: "Más consideración de compra" },
  { id: "chip_gt_other", label: "Otro" },
];

/** Chips de bienestar que no deben aparecer fuera de contexto wellness / pregunta explícita. */
const WELLNESS_ONLY_CHIP_LABEL_FOLDS = new Set(
  [
    "mas calma",
    "menos ansiedad",
    "mejor convivencia",
    "rutina mas ordenada",
    "mayor conexion corporal",
    "mejor disposicion",
  ].map(fold),
);

function chipAnswersQuestion(
  kind: ClarificationChipQuestionKind,
  label: string,
  category: ProjectChipCategory,
): boolean {
  const lf = fold(label);

  if (WELLNESS_ONLY_CHIP_LABEL_FOLDS.has(lf)) {
    return (
      kind === "transformation_wellness" ||
      (kind === "transformation_experience" && category === "wellness_yoga")
    );
  }

  if (kind === "evidence") {
    return (
      /\b(experiencia|anos|años|testimonio|cliente|caso|resultado|trayector|protocolo|formaci|certificaci|cifra|aliado|otro)\b/i.test(
        label,
      ) && !/\b(calma|ansiedad|yoga|aula)\b/i.test(label)
    );
  }

  if (kind === "audience") {
    return (
      /\b(cliente|comprador|padre|colegio|directivo|profesor|cuidador|aliado|otro|final)\b/i.test(
        label,
      ) && !/\b(sabor|mezcla|coctel|cocktail)\b/i.test(label)
    );
  }

  if (kind === "differentiation_product") {
    if (category === "cocktails_beverage" || category === "alcohol_communication") {
      return COCKTAIL_DIFFERENTIATION_CHIPS.some((c) => fold(c.label) === lf);
    }
    return (
      /\b(diferenc|unico|único|calidad|propuesta|valor|otro)\b/i.test(label) &&
      !WELLNESS_ONLY_CHIP_LABEL_FOLDS.has(lf)
    );
  }

  if (kind === "transformation_experience") {
    if (category === "cocktails_beverage" || category === "alcohol_communication") {
      return COCKTAIL_EXPERIENCE_CHIPS.some((c) => fold(c.label) === lf);
    }
    if (category === "wellness_yoga") {
      return WELLNESS_TRANSFORM_CHIPS.some((c) => fold(c.label) === lf);
    }
    return GENERIC_TRANSFORM_CHIPS.some((c) => fold(c.label) === lf);
  }

  if (kind === "transformation_wellness") {
    return WELLNESS_TRANSFORM_CHIPS.some((c) => fold(c.label) === lf);
  }

  if (kind === "tone") {
    return TONE_CHIPS.some((c) => fold(c.label) === lf);
  }

  return false;
}

function bankForKind(
  kind: ClarificationChipQuestionKind,
  category: ProjectChipCategory,
): { id: string; label: string }[] {
  switch (kind) {
    case "evidence":
      return EVIDENCE_CHIPS;
    case "audience":
      return AUDIENCE_CHIPS;
    case "differentiation_product":
      if (category === "cocktails_beverage" || category === "alcohol_communication") {
        return COCKTAIL_DIFFERENTIATION_CHIPS;
      }
      return [];
    case "transformation_experience":
      if (category === "cocktails_beverage" || category === "alcohol_communication") {
        return COCKTAIL_EXPERIENCE_CHIPS;
      }
      if (category === "wellness_yoga") return WELLNESS_TRANSFORM_CHIPS;
      return GENERIC_TRANSFORM_CHIPS;
    case "transformation_wellness":
      return WELLNESS_TRANSFORM_CHIPS;
    case "tone":
      return TONE_CHIPS;
    default:
      return [];
  }
}

/**
 * Filtra chips del modelo y de bancos: solo respuestas plausibles a la pregunta actual.
 */
export function filterClarificationChipsForQuestion(
  q: ClarificationQuestion,
  responses: Record<string, unknown>,
  chips: { id: string; label: string }[],
): { id: string; label: string }[] {
  const category = detectProjectChipCategory(responses);
  const kind = inferClarificationChipQuestionKind(q);
  const out: { id: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const c of chips) {
    if (isUniversalClarificationSkipOptionId(c.id)) continue;
    const lf = fold(c.label);
    if (seen.has(lf)) continue;
    if (!chipAnswersQuestion(kind, c.label, category)) continue;
    seen.add(lf);
    out.push(c);
  }
  return out;
}

const ALL_KINDS_FOR_SKIP_LABELS: ClarificationChipQuestionKind[] = [
  "evidence",
  "audience",
  "differentiation_product",
  "challenge_friction",
  "transformation_experience",
  "transformation_wellness",
  "tone",
  "unknown",
];

/**
 * Universal skip chips: stable ids for `project_responses` / answers; labels
 * vary by clarification gap so the UI stays contextual post-captura.
 */
export function getContextualUniversalSkipOptions(
  kind: ClarificationChipQuestionKind,
): { id: string; label: string }[] {
  switch (kind) {
    case "evidence":
      return [
        {
          id: CLARIFICATION_SKIP_NOT_AVAILABLE_ID,
          label: "No tengo evidencia todavía",
        },
        {
          id: CLARIFICATION_SKIP_CONTINUE_BASE_ID,
          label: "Continuar sin esta evidencia",
        },
        {
          id: CLARIFICATION_SKIP_IMPROVE_LATER_ID,
          label: "La puedo mejorar después",
        },
      ];
    case "audience":
      return [
        {
          id: CLARIFICATION_SKIP_NOT_AVAILABLE_ID,
          label: "No tengo claridad sobre la audiencia",
        },
        {
          id: CLARIFICATION_SKIP_CONTINUE_BASE_ID,
          label: "Continuar sin definir prioridad",
        },
        {
          id: CLARIFICATION_SKIP_IMPROVE_LATER_ID,
          label: "La puedo precisar después",
        },
      ];
    case "differentiation_product":
      return [
        {
          id: CLARIFICATION_SKIP_NOT_AVAILABLE_ID,
          label: "No tengo el diferencial claro todavía",
        },
        {
          id: CLARIFICATION_SKIP_CONTINUE_BASE_ID,
          label: "Continuar sin cerrar el diferencial",
        },
        {
          id: CLARIFICATION_SKIP_IMPROVE_LATER_ID,
          label: "Lo trabajaré después",
        },
      ];
    case "tone":
      return [
        {
          id: CLARIFICATION_SKIP_NOT_AVAILABLE_ID,
          label: "No tengo el tono definido todavía",
        },
        {
          id: CLARIFICATION_SKIP_CONTINUE_BASE_ID,
          label: "Continuar con el tono actual",
        },
        {
          id: CLARIFICATION_SKIP_IMPROVE_LATER_ID,
          label: "Lo ajustaré después",
        },
      ];
    case "challenge_friction":
      return [
        {
          id: CLARIFICATION_SKIP_NOT_AVAILABLE_ID,
          label: "No tengo más contexto del reto",
        },
        {
          id: CLARIFICATION_SKIP_CONTINUE_BASE_ID,
          label: "Continuar con esta base",
        },
        {
          id: CLARIFICATION_SKIP_IMPROVE_LATER_ID,
          label: "Lo ampliaré después",
        },
      ];
    case "transformation_experience":
    case "transformation_wellness":
      return [
        {
          id: CLARIFICATION_SKIP_NOT_AVAILABLE_ID,
          label: "No tengo claro el beneficio",
        },
        {
          id: CLARIFICATION_SKIP_CONTINUE_BASE_ID,
          label: "Continuar con este beneficio",
        },
        {
          id: CLARIFICATION_SKIP_IMPROVE_LATER_ID,
          label: "Lo mejoraré después",
        },
      ];
    default:
      return CLARIFICATION_UNIVERSAL_SKIP_OPTIONS.map((o) => ({
        id: o.id,
        label: o.label,
      }));
  }
}

/** Used to treat selected universal skips as intentional (not “vague”). */
export function foldMatchesAnyUniversalSkipDisplayLabel(text: string): boolean {
  const tf = fold(text.trim());
  for (const k of ALL_KINDS_FOR_SKIP_LABELS) {
    for (const o of getContextualUniversalSkipOptions(k)) {
      if (tf === fold(o.label)) return true;
    }
  }
  return false;
}

/**
 * Inyecta opciones de omisión universales al final (sin duplicar ids).
 */
export function injectUniversalClarificationSkips(
  q: ClarificationQuestion,
): ClarificationQuestion {
  const kind = inferClarificationChipQuestionKind(q);
  const universal = getContextualUniversalSkipOptions(kind);
  const existing = q.options ?? [];
  const byId = new Map(existing.map((o) => [o.id, o] as const));
  for (const u of universal) {
    byId.set(u.id, { id: u.id, label: u.label });
  }
  return { ...q, options: Array.from(byId.values()) };
}

/**
 * Sanitiza opciones sugeridas: modelo + banco solo si encajan; nunca chips fuera de contexto.
 */
/** Campos del Documento Maestro que deben reflejar cautela cuando falta información. */
export function inferClarificationTargetMasterFields(
  q: ClarificationQuestion,
): string[] {
  const kind = inferClarificationChipQuestionKind(q);
  const common = ["input_quality_assessment", "production_rules"];
  switch (kind) {
    case "evidence":
      return [...common, "evidence_base", "memory"];
    case "audience":
      return [...common, "audience_base", "strategic_base", "semantic_base"];
    case "differentiation_product":
      return [...common, "strategic_base", "semantic_base", "voice_base"];
    case "challenge_friction":
      return [...common, "strategic_base", "challenge_context", "semantic_base"];
    case "tone":
      return [...common, "voice_base", "semantic_base"];
    case "transformation_experience":
    case "transformation_wellness":
      return [...common, "strategic_base", "audience_base", "semantic_base"];
    default:
      return [...common, "strategic_base"];
  }
}

export function sanitizeClarificationQuestionChips(
  q: ClarificationQuestion,
  responses: Record<string, unknown>,
): ClarificationQuestion {
  const category = detectProjectChipCategory(responses);
  const kind = inferClarificationChipQuestionKind(q);
  const rawModel = (q.options ?? []).filter(
    (o) => !isUniversalClarificationSkipOptionId(o.id),
  );
  const filteredModel = filterClarificationChipsForQuestion(q, responses, rawModel);

  const bank = bankForKind(kind, category).filter((b) =>
    chipAnswersQuestion(kind, b.label, category),
  );

  const merged: { id: string; label: string }[] = [...filteredModel];
  const seen = new Set(merged.map((o) => fold(o.label)));
  for (const b of bank) {
    const k = fold(b.label);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(b);
    if (merged.length >= 8) break;
  }

  const options = merged.length > 0 ? merged.slice(0, 8) : undefined;
  return { ...q, options };
}
