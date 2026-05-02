export const VISIBLE_FRAMEWORK_NOT_FINAL_WARNING =
  "Estas son oportunidades estratégicas, no piezas finales.";

const TECHNICAL_ATOMS = new Set([
  "generic",
  "true",
  "false",
  "null",
  "undefined",
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "low",
  "high",
  "medium",
  "default",
  "optional",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripJsonFence(raw: string): string {
  const t = raw.trim();
  const m = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(t);
  return m ? m[1].trim() : t;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Arrays of strings; allows empty array; drops non-strings; trims; drops empty strings. */
function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const el of value) {
    if (typeof el === "string") {
      const t = el.trim();
      if (t.length > 0) out.push(t);
    }
  }
  return out;
}

function requireNonEmptyString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
): string | null {
  const v = obj[key];
  if (!isNonEmptyString(v)) {
    return `${path}.${key} debe ser un string no vacío (en español).`;
  }
  return null;
}

function requireObject(value: unknown): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    return null;
  }
  return value;
}

/**
 * Detecta texto que parece slug, variable interna o etiqueta técnica (no español natural).
 */
function looksLikeInternalSlugSingle(token: string): boolean {
  const t = token.trim();
  if (t.length < 2) return false;
  if (/[áéíóúñüÁÉÍÓÚÑ¿¡]/.test(t)) return false;

  if (TECHNICAL_ATOMS.has(t.toLowerCase())) return true;

  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/i.test(t)) return true;

  if (/^[a-z0-9]+(-[a-z0-9]+)+$/i.test(t)) return true;

  if (/^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/.test(t)) return true;
  if (/^[A-Z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/.test(t)) return true;

  return false;
}

/**
 * Heurística para valores visibles completos (puede incluir espacios).
 * No sustituye revisión humana; reduce slugs y keywords sueltas en el marco.
 */
export function looksLikeInternalSlug(value: string): boolean {
  const t = value.trim();
  if (t.length === 0) return false;

  if (/[áéíóúñüÁÉÍÓÚÑ¿¡]/.test(t)) return false;
  if (/[.,;:()]/.test(t) && t.length >= 14) return false;

  if (/\s/.test(t)) {
    const tokens = t.split(/[\s,;]+/).filter(Boolean);
    if (tokens.length >= 2) {
      const allSluggy = tokens.every((tok) => looksLikeInternalSlugSingle(tok));
      if (allSluggy) return true;
    }
    return false;
  }

  return looksLikeInternalSlugSingle(t);
}

function validateUserFacingString(value: string, path: string): string | null {
  if (looksLikeInternalSlug(value)) {
    return `${path}: el texto parece una etiqueta técnica o slug (p. ej. snake_case o variable), no español natural. Reescribe con significado estratégico completo.`;
  }
  return null;
}

function validateNoSlugInFramework(
  value: unknown,
  path: string,
): string | null {
  if (typeof value === "string") {
    return validateUserFacingString(value, path);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const err = validateNoSlugInFramework(value[i], `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      const err = validateNoSlugInFramework(v, `${path}.${k}`);
      if (err) return err;
    }
    return null;
  }
  return null;
}

export type ConceptualAxisNormalized = {
  axis_title: string;
  strategic_meaning: string;
  narrative_use: string;
};

function normalizeConceptualAxes(
  value: unknown,
): { ok: true; axes: ConceptualAxisNormalized[] } | { ok: false; message: string } {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      message:
        '"narrative_strategy.conceptual_axes" debe ser un array de objetos con axis_title, strategic_meaning y narrative_use.',
    };
  }
  const axes: ConceptualAxisNormalized[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item === "string") {
      return {
        ok: false,
        message: `narrative_strategy.conceptual_axes[${i}] no puede ser un string suelto; usa un objeto con axis_title, strategic_meaning y narrative_use.`,
      };
    }
    if (!isPlainObject(item)) {
      return {
        ok: false,
        message: `narrative_strategy.conceptual_axes[${i}] debe ser un objeto.`,
      };
    }
    const axis_title = String(item.axis_title ?? "").trim();
    const strategic_meaning = String(item.strategic_meaning ?? "").trim();
    const narrative_use = String(item.narrative_use ?? "").trim();
    if (!axis_title || !strategic_meaning || !narrative_use) {
      return {
        ok: false,
        message: `narrative_strategy.conceptual_axes[${i}]: axis_title, strategic_meaning y narrative_use deben ser strings no vacíos.`,
      };
    }
    axes.push({ axis_title, strategic_meaning, narrative_use });
  }
  return { ok: true, axes };
}

export type ValidateVisibleFrameworkJsonResult =
  | { ok: true; framework: Record<string, unknown> }
  | { ok: false; message: string };

/**
 * Valida el JSON del Marco visible, normaliza al esquema acordado y rechaza lenguaje tipo slug.
 */
export function validateVisibleFrameworkJson(
  rawText: string,
): ValidateVisibleFrameworkJsonResult {
  const trimmed = stripJsonFence(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      ok: false,
      message:
        "El modelo no devolvió JSON válido (error de sintaxis al interpretar la respuesta).",
    };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, message: "El JSON raíz debe ser un objeto." };
  }

  const forbiddenRootKeys = [
    "revision_note",
    "revision_context",
    "sugerencia",
    "user_revision_note",
    "final_suggestion",
  ] as const;
  for (const key of forbiddenRootKeys) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      return {
        ok: false,
        message: `El marco no debe incluir la clave raíz "${key}". Integra la sugerencia solo en el contenido de executive_summary, strategic_diagnosis y el resto del esquema obligatorio.`,
      };
    }
  }

  const errExecutive = requireNonEmptyString(parsed, "executive_summary", "Raíz");
  if (errExecutive) return { ok: false, message: errExecutive };

  const sd = requireObject(parsed.strategic_diagnosis);
  if (!sd) {
    return { ok: false, message: '"strategic_diagnosis" debe ser un objeto.' };
  }
  for (const k of [
    "current_situation",
    "communication_problem",
    "strategic_opportunity",
    "expected_result",
  ] as const) {
    const e = requireNonEmptyString(sd, k, "strategic_diagnosis");
    if (e) return { ok: false, message: e };
  }

  const aud = requireObject(parsed.audience);
  if (!aud) {
    return { ok: false, message: '"audience" debe ser un objeto.' };
  }
  for (const k of [
    "who_we_need_to_move",
    "current_state",
    "desired_state",
    "expected_action",
  ] as const) {
    const e = requireNonEmptyString(aud, k, "audience");
    if (e) return { ok: false, message: e };
  }

  const cm = requireObject(parsed.conflict_map);
  if (!cm) {
    return { ok: false, message: '"conflict_map" debe ser un objeto.' };
  }
  for (const k of [
    "main_conflict",
    "perception_conflict",
    "emotional_conflict",
    "category_or_market_conflict",
    "internal_communication_conflict",
  ] as const) {
    const e = requireNonEmptyString(cm, k, "conflict_map");
    if (e) return { ok: false, message: e };
  }

  const rm = requireObject(parsed.risk_map);
  if (!rm) {
    return { ok: false, message: '"risk_map" debe ser un objeto.' };
  }
  for (const k of [
    "main_risks",
    "credibility_risks",
    "tone_risks",
    "evidence_gaps",
    "what_could_go_wrong",
  ] as const) {
    if (!Array.isArray(rm[k])) {
      return { ok: false, message: `"risk_map.${k}" debe ser un array.` };
    }
  }

  const ns = requireObject(parsed.narrative_strategy);
  if (!ns) {
    return { ok: false, message: '"narrative_strategy" debe ser un objeto.' };
  }
  for (const k of [
    "narrative_promise",
    "communication_territory",
    "emotional_atmosphere",
    "voice_personality",
  ] as const) {
    const e = requireNonEmptyString(ns, k, "narrative_strategy");
    if (e) return { ok: false, message: e };
  }

  const axesResult = normalizeConceptualAxes(ns.conceptual_axes);
  if (!axesResult.ok) {
    return { ok: false, message: axesResult.message };
  }

  const ma = requireObject(parsed.message_architecture);
  if (!ma) {
    return {
      ok: false,
      message: '"message_architecture" debe ser un objeto.',
    };
  }
  const errMain = requireNonEmptyString(ma, "main_message", "message_architecture");
  if (errMain) return { ok: false, message: errMain };
  for (const k of [
    "supporting_messages",
    "proof_points",
    "messages_to_avoid",
  ] as const) {
    if (!Array.isArray(ma[k])) {
      return {
        ok: false,
        message: `"message_architecture.${k}" debe ser un array.`,
      };
    }
  }

  const cso = requireObject(parsed.content_strategy_opportunities);
  if (!cso) {
    return {
      ok: false,
      message: '"content_strategy_opportunities" debe ser un objeto.',
    };
  }
  for (const k of [
    "strategic_content_roles",
    "content_opportunities",
    "recommended_angles",
  ] as const) {
    if (!Array.isArray(cso[k])) {
      return {
        ok: false,
        message: `"content_strategy_opportunities.${k}" debe ser un array.`,
      };
    }
  }

  const ss = requireObject(parsed.success_signals);
  if (!ss) {
    return { ok: false, message: '"success_signals" debe ser un objeto.' };
  }
  for (const k of [
    "perception_indicators",
    "engagement_indicators",
    "conversion_or_action_indicators",
    "qualitative_signals",
  ] as const) {
    if (!Array.isArray(ss[k])) {
      return {
        ok: false,
        message: `"success_signals.${k}" debe ser un array.`,
      };
    }
  }

  if (!Array.isArray(parsed.strategic_recommendations)) {
    return {
      ok: false,
      message: '"strategic_recommendations" debe ser un array en la raíz.',
    };
  }
  if (!Array.isArray(parsed.guardrails)) {
    return { ok: false, message: '"guardrails" debe ser un array en la raíz.' };
  }

  const framework: Record<string, unknown> = {
    executive_summary: String(parsed.executive_summary).trim(),
    strategic_diagnosis: {
      current_situation: String(sd.current_situation).trim(),
      communication_problem: String(sd.communication_problem).trim(),
      strategic_opportunity: String(sd.strategic_opportunity).trim(),
      expected_result: String(sd.expected_result).trim(),
    },
    audience: {
      who_we_need_to_move: String(aud.who_we_need_to_move).trim(),
      current_state: String(aud.current_state).trim(),
      desired_state: String(aud.desired_state).trim(),
      expected_action: String(aud.expected_action).trim(),
    },
    conflict_map: {
      main_conflict: String(cm.main_conflict).trim(),
      perception_conflict: String(cm.perception_conflict).trim(),
      emotional_conflict: String(cm.emotional_conflict).trim(),
      category_or_market_conflict: String(cm.category_or_market_conflict).trim(),
      internal_communication_conflict: String(
        cm.internal_communication_conflict,
      ).trim(),
    },
    risk_map: {
      main_risks: normalizeStringArray(rm.main_risks),
      credibility_risks: normalizeStringArray(rm.credibility_risks),
      tone_risks: normalizeStringArray(rm.tone_risks),
      evidence_gaps: normalizeStringArray(rm.evidence_gaps),
      what_could_go_wrong: normalizeStringArray(rm.what_could_go_wrong),
    },
    narrative_strategy: {
      narrative_promise: String(ns.narrative_promise).trim(),
      communication_territory: String(ns.communication_territory).trim(),
      conceptual_axes: axesResult.axes,
      emotional_atmosphere: String(ns.emotional_atmosphere).trim(),
      voice_personality: String(ns.voice_personality).trim(),
    },
    message_architecture: {
      main_message: String(ma.main_message).trim(),
      supporting_messages: normalizeStringArray(ma.supporting_messages),
      proof_points: normalizeStringArray(ma.proof_points),
      messages_to_avoid: normalizeStringArray(ma.messages_to_avoid),
    },
    content_strategy_opportunities: {
      strategic_content_roles: normalizeStringArray(cso.strategic_content_roles),
      content_opportunities: normalizeStringArray(cso.content_opportunities),
      recommended_angles: normalizeStringArray(cso.recommended_angles),
      not_final_content_warning: VISIBLE_FRAMEWORK_NOT_FINAL_WARNING,
    },
    success_signals: {
      perception_indicators: normalizeStringArray(ss.perception_indicators),
      engagement_indicators: normalizeStringArray(ss.engagement_indicators),
      conversion_or_action_indicators: normalizeStringArray(
        ss.conversion_or_action_indicators,
      ),
      qualitative_signals: normalizeStringArray(ss.qualitative_signals),
    },
    strategic_recommendations: normalizeStringArray(
      parsed.strategic_recommendations,
    ),
    guardrails: normalizeStringArray(parsed.guardrails),
  };

  const slugErr = validateNoSlugInFramework(framework, "framework");
  if (slugErr) {
    return { ok: false, message: slugErr };
  }

  return { ok: true, framework };
}

/** Mensaje al intentar aprobar un marco que no pasa la validación del esquema actual. */
export const FRAMEWORK_APPROVE_SCHEMA_ERROR_MESSAGE =
  "Este marco fue generado con una estructura anterior. Regenera el marco antes de aprobarlo.";

/**
 * Comprueba si un `framework` ya persistido cumple el mismo contrato que exige
 * `validateVisibleFrameworkJson` (incl. ejes conceptuales como objetos).
 */
export function isStoredFrameworkEligibleForApprove(framework: unknown): boolean {
  if (
    typeof framework !== "object" ||
    framework === null ||
    Array.isArray(framework)
  ) {
    return false;
  }
  try {
    const result = validateVisibleFrameworkJson(JSON.stringify(framework));
    return result.ok;
  } catch {
    return false;
  }
}
