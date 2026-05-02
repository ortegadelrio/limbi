import { stripJsonFence } from "@/lib/master-document/validate-openai-json";
import { looksLikeInternalSlug } from "@/lib/framework/validate-framework-json";
import type { ContentGenerationType } from "@/lib/content/build-input";

/** Mensaje fijo cuando se detecta lenguaje de plantilla / brochure. */
export const GENERIC_CONTENT_REJECTION_MESSAGE =
  "El contenido generado suena demasiado genérico. Debe regenerarse con mayor conexión al Marco Estratégico aprobado.";

/**
 * Frases sospechosas (comparación sin acentos, minúsculas).
 * Si aparecen como subcadena en textos visibles, se rechaza la salida.
 */
const BANNED_GENERIC_SUBSTRINGS_NORMALIZED = [
  "nuestra solucion",
  "nuestro servicio",
  "descubre la diferencia",
  "tu companero de confianza",
  "simplicidad que empodera",
  "te ayudamos a crecer",
  "transforma la manera",
  "valor anadido",
  "soluciones innovadoras",
  "valor autentico",
  "guia confiable",
  "liderazgo transformacional",
  "beneficios tangibles",
  "desafios en oportunidades",
  "conexion emocional",
  "propuesta diferenciadora",
  "solucion integral",
  "experiencia memorable",
  "proposito de marca",
  "despierta el valor oculto",
  "despierta el valor",
  "claridad transformadora",
  "impulso sin presiones",
  "tu camino al exito",
  "conecta con lo que importa",
  "energiza sin presionar",
  "revolucionando",
  "terreno saturado",
  "aliado fiel",
  "contenidos que resuenan",
  "que realmente resuenan",
  "alternativas humanizadas",
  "alternativa humanizada",
  "herramientas innovadoras y efectivas",
  "el futuro de la ia",
  "desde el estrategia",
  "con alma",
  "resultados resonantes",
  "verdaderamente resonantes",
  "aliado estrategico",
  "humanizado",
  "humanizados",
  "humanizada",
  "indispensable",
  "transforma la automatizacion",
  "del caos a la claridad",
  "conocimiento enriquecido",
  "conexion autentica",
  "contenidos significativos y personalizados",
  "mercado saturado de automatizacion",
  "potenciar la comunicacion estrategica",
] as const;

export type ContentValidationOffendingRule =
  | "generic_phrase"
  | "internal_slug"
  | "missing_field"
  | "wrong_shape"
  | "wrong_content_type"
  | "wrong_items_count"
  | "unexpected_root_keys"
  | "unexpected_item_key"
  | "invalid_json_syntax"
  | "wrong_root_type"
  | "rejected_editorial_term"
  | "missing_preferred_editorial_term";

/** Detalle de un fallo de validación (público + técnico para reintento de prompt). */
export type ContentValidationFailure = {
  message: string;
  internal_reason: string;
  offending_value?: string;
  offending_rule: ContentValidationOffendingRule;
};

/** Feedback pasado al segundo prompt de generación. */
export type ContentGenerationValidationFeedback = ContentValidationFailure;

function normalizeForGenericScan(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Partículas cortas entre palabras del término preferido; no exigirlas en secuencia. */
const PREFERRED_TERM_SKIP_TOKENS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "y",
  "o",
  "a",
  "al",
  "en",
  "un",
  "una",
]);

/**
 * True si el término preferido aparece de forma reconocible en el blob:
 * subcadena normalizada continua, o bien las palabras sustantivas en orden
 * (tolera puntuación o partículas entre ellas — p. ej. "Plataforma Límbica — digital").
 */
export function normalizedPreferredTermAppearsInBlob(
  blobNorm: string,
  prefNorm: string,
): boolean {
  const compact = prefNorm.replace(/\s+/g, " ").trim();
  if (compact.length < 4) return true;
  if (blobNorm.includes(compact)) return true;

  const rawTokens = compact.split(" ").filter(Boolean);
  const tokens = rawTokens.filter(
    (t) => t.length >= 2 && !PREFERRED_TERM_SKIP_TOKENS.has(t),
  );
  if (tokens.length === 0) {
    return rawTokens.some((t) => t.length > 0 && blobNorm.includes(t));
  }
  let searchFrom = 0;
  for (const tok of tokens) {
    const pos = blobNorm.indexOf(tok, searchFrom);
    if (pos === -1) return false;
    searchFrom = pos + tok.length;
  }
  return true;
}

function findFirstBannedGenericSubstring(text: string): string | null {
  const n = normalizeForGenericScan(text);
  for (const frag of BANNED_GENERIC_SUBSTRINGS_NORMALIZED) {
    if (n.includes(frag)) return frag;
  }
  return null;
}

/** Patrones brochure frecuentes solo para graphic_phrases (comparación normalizada). */
const GRAPHIC_PHRASE_BROCHURE_FRAGMENTS_NORMALIZED = [
  "transforma el caos",
  "transforma el caos digital",
  "transforma el conocimiento",
  "poder estrategico",
  "mas alla de la automatizacion",
  "humanidad en cada linea de codigo",
  // Frase completa del cliché (evitar subcadenas sueltas como "comunicacion que conecta",
  // que aparece en copy estratégico válido).
  "comunicacion que conecta no solo transmite",
  "comunicacion que conecta, no solo transmite",
  "del ruido digital a la claridad",
  "del ruido digital a la claridad estrategica",
  "nuevo horizonte",
  "plataforma innovadora y confiable",
  "plataforma innovadora",
  "solucion visualizada",
  "con un solo clic",
  "comunicacion con inteligencia y humanidad",
  "descubre limbi",
  "puente que une el intelecto",
  "une el intelecto con la emocion",
  "intelecto con la emocion",
  "intelecto y la emocion",
  // Clichés tipo SaaS / IA genérica (mayo 2026 — no bloquean "plataforma limbica digital").
  "comunicacion humanizada",
  "resultados reales",
  "conecta estrategia",
  "estrategia y creatividad",
  "contenido con alma",
  "lineas de codigo",
  "contexto humano",
  "manos uniendo engranajes",
  "nube de ideas",
  "destino claro",
  "innovacion en comunicacion",
  "engranajes",
] as const;

function findGraphicPhraseBrochureFragment(text: string): string | null {
  const n = normalizeForGenericScan(text);
  for (const frag of GRAPHIC_PHRASE_BROCHURE_FRAGMENTS_NORMALIZED) {
    if (n.includes(frag)) return frag;
  }
  return null;
}

/**
 * Detecta intercambio de terminología en persistent_editorial_guidance
 * (p. ej. "no usar X, sino Y").
 */
export function parseEditorialTerminologySwap(
  guidance: string | null | undefined,
): { rejected: string; preferred: string } | null {
  if (!guidance || typeof guidance !== "string") return null;
  const g = guidance.trim();
  if (g.length < 8) return null;

  const tryMatch = (re: RegExp): { rejected: string; preferred: string } | null => {
    const m = g.match(re);
    if (!m?.[1] || !m?.[2]) return null;
    const rejected = m[1]
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "");
    const preferred = m[2]
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .replace(/\s*\.\s*$/, "");
    if (rejected.length >= 2 && preferred.length >= 2) {
      return { rejected, preferred };
    }
    return null;
  };

  return (
    tryMatch(/no\s+usar\s+([^,]+?)\s*,\s*sino\s+(.+?)(?:\.|\s*$)/i) ??
    tryMatch(/no\s+usar\s+([^,]+?)\s+sino\s+(.+?)(?:\.|\s*$)/i) ??
    tryMatch(/no\s+uses\s+([^,]+?)\s*,\s*usa\s+(.+?)(?:\.|\s*$)/i) ??
    tryMatch(/avoid\s+["']?(.+?)["']?\s*,\s*use\s+["']?(.+?)(?:\.|\s*$)/i) ??
    tryMatch(/evita\s+["']?(.+?)["']?\s*,\s*usa\s+["']?(.+?)(?:\.|\s*$)/i) ??
    null
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function truncateVisible(s: string, max = 800): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function validateNaturalSpanish(
  path: string,
  value: unknown,
): ContentValidationFailure | null {
  if (!isNonEmptyString(value)) {
    return {
      message: `${path} debe ser un string no vacío (en español).`,
      internal_reason: "non_empty_string_required",
      offending_value:
        typeof value === "string"
          ? truncateVisible(value, 400)
          : value === undefined || value === null
            ? String(value)
            : truncateVisible(JSON.stringify(value), 400),
      offending_rule: "missing_field",
    };
  }
  const t = value.trim();
  if (looksLikeInternalSlug(t)) {
    return {
      message: `${path}: el texto parece una etiqueta técnica o slug (p. ej. snake_case), no español natural.`,
      internal_reason: "heuristic_internal_slug",
      offending_value: truncateVisible(t, 800),
      offending_rule: "internal_slug",
    };
  }
  const frag = findFirstBannedGenericSubstring(t);
  if (frag !== null) {
    return {
      message: GENERIC_CONTENT_REJECTION_MESSAGE,
      internal_reason: `banned_generic_substring:${frag}`,
      offending_value: truncateVisible(t, 800),
      offending_rule: "generic_phrase",
    };
  }
  return null;
}

const SHORT_PITCH_KEYS = [
  "title",
  "pitch",
  "strategic_intention",
  "best_use",
] as const;
const CAPTIONS_KEYS = [
  "caption",
  "tone",
  "strategic_intention",
  "suggested_channel",
] as const;
const CONTENT_IDEAS_KEYS = [
  "idea_title",
  "idea_description",
  "strategic_role",
  "possible_format",
  "why_it_works",
] as const;
const GRAPHIC_PHRASES_KEYS = [
  "phrase",
  "intention",
  "visual_context",
  "usage_note",
] as const;

function validateItemShape(
  item: unknown,
  path: string,
  keys: readonly string[],
  options?: { graphicPhraseBrochureCheck?: boolean },
): ContentValidationFailure | null {
  if (!isPlainObject(item)) {
    return {
      message: `${path} debe ser un objeto.`,
      internal_reason: "item_not_plain_object",
      offending_value: truncateVisible(
        typeof item === "string" ? item : JSON.stringify(item),
        500,
      ),
      offending_rule: "wrong_shape",
    };
  }
  for (const k of keys) {
    const err = validateNaturalSpanish(`${path}.${k}`, item[k]);
    if (err) return err;
  }
  if (options?.graphicPhraseBrochureCheck === true) {
    const parts: string[] = [];
    for (const k of keys) {
      const v = item[k];
      if (typeof v === "string" && v.trim().length > 0) parts.push(v);
    }
    const joined = parts.join(" ");
    const frag = findGraphicPhraseBrochureFragment(joined);
    if (frag !== null) {
      return {
        message:
          "Las frases gráficas suenan demasiado genéricas o tipo brochure. Deben ser titulares más afilados y anclados al marco.",
        internal_reason: `graphic_brochure:${frag}`,
        offending_value: truncateVisible(joined, 800),
        offending_rule: "generic_phrase",
      };
    }
  }
  for (const k of Object.keys(item)) {
    if (!keys.includes(k)) {
      return {
        message: `${path} contiene la clave no permitida "${k}".`,
        internal_reason: `unexpected_key_on_item:${k}`,
        offending_value: k,
        offending_rule: "unexpected_item_key",
      };
    }
  }
  return null;
}

export type ValidateContentGenerationJsonResult =
  | { ok: true; output: Record<string, unknown> }
  | ({ ok: false } & ContentValidationFailure);

/**
 * Parsea la salida del modelo y valida esquema por tipo, cantidad y heurística anti-slug / anti-genérico.
 * @param persistentEditorialGuidance Si hay intercambio "no usar X, sino Y", se rechaza cualquier aparición de X en textos visibles.
 */
export function validateContentGenerationJson(
  rawText: string,
  expectedType: ContentGenerationType,
  expectedQuantity: number,
  persistentEditorialGuidance?: string | null,
): ValidateContentGenerationJsonResult {
  const trimmed = stripJsonFence(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    const hint = e instanceof Error ? e.message : "unknown_parse_error";
    return {
      ok: false,
      message:
        "El modelo no devolvió JSON válido (error de sintaxis al interpretar la respuesta).",
      internal_reason: `json_parse_error:${hint}`,
      offending_value: truncateVisible(trimmed, 600),
      offending_rule: "invalid_json_syntax",
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      message: "El JSON raíz debe ser un objeto.",
      internal_reason: "root_not_plain_object",
      offending_value: truncateVisible(JSON.stringify(parsed), 400),
      offending_rule: "wrong_root_type",
    };
  }

  if (parsed.content_type !== expectedType) {
    return {
      ok: false,
      message: `"content_type" debe ser exactamente "${expectedType}".`,
      internal_reason: `wrong_content_type:got:${String(parsed.content_type)}`,
      offending_value: String(parsed.content_type),
      offending_rule: "wrong_content_type",
    };
  }

  if (!Array.isArray(parsed.items)) {
    return {
      ok: false,
      message: '"items" debe ser un array.',
      internal_reason: "items_not_array",
      offending_rule: "wrong_shape",
    };
  }

  if (parsed.items.length !== expectedQuantity) {
    return {
      ok: false,
      message: `Se esperaban ${String(expectedQuantity)} elementos en "items", pero se recibieron ${String(parsed.items.length)}.`,
      internal_reason: `wrong_items_count:expected:${String(expectedQuantity)}:got:${String(parsed.items.length)}`,
      offending_rule: "wrong_items_count",
    };
  }

  const keysByType: Record<ContentGenerationType, readonly string[]> = {
    short_pitch: SHORT_PITCH_KEYS,
    captions: CAPTIONS_KEYS,
    content_ideas: CONTENT_IDEAS_KEYS,
    graphic_phrases: GRAPHIC_PHRASES_KEYS,
  };
  const keys = keysByType[expectedType];

  for (let i = 0; i < parsed.items.length; i++) {
    const err = validateItemShape(
      parsed.items[i],
      `items[${String(i)}]`,
      keys,
      expectedType === "graphic_phrases"
        ? { graphicPhraseBrochureCheck: true }
        : undefined,
    );
    if (err) return { ok: false, ...err };
  }

  const swap = parseEditorialTerminologySwap(persistentEditorialGuidance);
  if (swap) {
    let blob = "";
    for (let i = 0; i < parsed.items.length; i++) {
      const it = parsed.items[i];
      if (!isPlainObject(it)) continue;
      for (const k of keys) {
        const v = it[k];
        if (typeof v === "string") blob += `${v} `;
      }
    }
    const n = normalizeForGenericScan(blob);

    const rejNorm = normalizeForGenericScan(swap.rejected);
    if (rejNorm.length >= 4 && n.includes(rejNorm)) {
      return {
        ok: false,
        message: `El contenido aún incluye «${swap.rejected}», que el usuario pidió no usar.`,
        internal_reason: `rejected_editorial_term:${swap.rejected}`,
        offending_value: truncateVisible(swap.rejected, 200),
        offending_rule: "rejected_editorial_term",
      };
    }

    if (expectedType === "graphic_phrases" || expectedType === "short_pitch") {
      const prefNorm = normalizeForGenericScan(swap.preferred);
      if (
        prefNorm.length >= 4 &&
        !normalizedPreferredTermAppearsInBlob(n, prefNorm)
      ) {
        return {
          ok: false,
          message:
            "El contenido no integró el término preferido indicado en la guía editorial persistente.",
          internal_reason: `missing_preferred_editorial_term:${swap.preferred}`,
          offending_value: truncateVisible(swap.preferred, 200),
          offending_rule: "missing_preferred_editorial_term",
        };
      }
    }
  }

  const extraKeys = Object.keys(parsed).filter(
    (k) => k !== "content_type" && k !== "items",
  );
  if (extraKeys.length > 0) {
    return {
      ok: false,
      message: `El JSON raíz solo puede contener "content_type" e "items". Claves extra: ${extraKeys.join(", ")}.`,
      internal_reason: `unexpected_root_keys:${extraKeys.join(",")}`,
      offending_value: extraKeys.join(", "),
      offending_rule: "unexpected_root_keys",
    };
  }

  return { ok: true, output: parsed as Record<string, unknown> };
}
