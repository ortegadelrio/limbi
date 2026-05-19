import {
  CONFERENCE_NARRATIVE_SECTIONS_ES,
  CONSULTING_PREFERRED_PHRASES_ES,
  CONSULTING_WEAK_PHRASES_ES,
} from "@/lib/brainstormer/consulting-style/consulting-voice-contract";
import type {
  ConsultingStyleDetectionInput,
  ConsultingStyleDetectionResult,
  ConsultingStyleMode,
} from "@/lib/brainstormer/consulting-style/types";
import { truncateDirectorSignal } from "@/lib/brainstormer/conversation-director/truncate-director-signal";

const TYPO_CORRECTIONS: ReadonlyArray<{ pattern: RegExp; avoid: string; use_instead: string }> = [
  { pattern: /\bpapalelo\b/i, avoid: "papalelo", use_instead: "paralelo" },
  { pattern: /\bparalelo\b/i, avoid: "", use_instead: "paralelo" },
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export function detectNeedsClarity(userMessage: string): boolean {
  const t = normalize(userMessage);
  return hasAny(t, [
    /\bno entiendo\b/,
    /\bno me queda claro\b/,
    /\bno me quedo claro\b/,
    /\bno me quedo claro\b/,
    /\bexplicame mejor\b/,
    /\bexplicalo mejor\b/,
    /\bno me quedo\b/,
    /\bestoy perdido\b/,
    /\bme perdi\b/,
  ]);
}

export function detectUserHasNotes(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    /\btengo\s+(ya\s+)?(algunas\s+)?notas\b/,
    /\bya tengo notas\b/,
    /\btengo\s+notas\b/,
    /\ben\s+un\s+word\b/,
    /\btengo\s+los\s+temas\b/,
  ]);
}

export function detectConferenceSectionsRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    /\bsecciones\s+de\s+la\s+conferencia\b/,
    /\bsecciones\s+de\s+conferencia\b/,
    /\bpuntos\s+de\s+la\s+conferencia\b/,
    /\bestructura\s+de\s+la\s+conferencia\b/,
    /\bcomo\s+serian\s+las\s+secciones\b/,
    /\bsecciones\s+como\s+serian\b/,
    /\boutline\s+de\s+conferencia\b/,
  ]) || (/\bconferencia\b/.test(t) && /\bsecciones\b/.test(t));
}

export function detectTypoAvoidTerms(text: string): string[] {
  const avoid = new Set<string>();
  for (const rule of TYPO_CORRECTIONS) {
    if (rule.pattern.test(text) && rule.avoid) {
      avoid.add(rule.avoid);
    }
  }
  return [...avoid];
}

export function detectStrongUserIdea(userMessage: string, excerpt: string): string | null {
  const t = normalize(`${excerpt}\n${userMessage}`);

  if (
    hasAny(t, [
      /individualidades/,
      /equipo\s+ganador/,
      /talento\s+disperso/,
      /rendimiento\s+colectivo/,
    ]) &&
    hasAny(t, [/entrenar/, /trabajo\s+en\s+equipo/, /futbol/, /equipo/])
  ) {
    return truncateDirectorSignal(
      "Liderazgo de individualidades al servicio de una causa común: convertir talento disperso en rendimiento colectivo (metáfora fútbol + equipo).",
      480,
    );
  }

  if (hasAny(t, [/consultor(ia|ias)/, /conferencias?/]) && hasAny(t, [/contraten/, /contratar/])) {
    return truncateDirectorSignal(
      "Posicionamiento hacia contratación de consultorías y conferencias (no solo visibilidad genérica).",
      480,
    );
  }

  if (hasAny(t, [/futbol/, /deporte/]) && hasAny(t, [/conferencia/, /liderazgo/, /trabajo\s+en\s+equipo/])) {
    return truncateDirectorSignal(
      "Conferencia con metáfora deportiva o de equipo (territorio propio, sin IP ni marcas oficiales de terceros).",
      480,
    );
  }

  return null;
}

function buildRepairConfusionDirective(): string {
  return truncateDirectorSignal(
    `MODO REPARACIÓN (usuario no entendió):
- Abre reconociendo: "Tienes razón, lo dije enredado" o similar.
- Reformula en UNA frase simple y directa (sin jerga).
- NO repitas la misma idea con palabras más complejas.
- Cierra con next_best_question concreta (consultorías vs conferencias vs asesorías si aplica).
- Postura consultiva: usa "${CONSULTING_PREFERRED_PHRASES_ES[1]}" o "${CONSULTING_PREFERRED_PHRASES_ES[0]}", no "${CONSULTING_WEAK_PHRASES_ES[0]}".`,
    1200,
  );
}

function buildNameStrongIdeaDirective(insight: string, typoAvoid: string[]): string {
  const typoLine =
    typoAvoid.length > 0
      ? `No repitas errores del usuario (${typoAvoid.join(", ")}); reformula con la palabra correcta.`
      : "";

  return truncateDirectorSignal(
    `MODO NOMBRAR IDEA DEL USUARIO:
- Abre capturando su idea: "Ahí hay un eje fuerte: …" o "Mi lectura es que el eje es…"
- Eje a desarrollar: ${insight}
- Añade postura: qué NO harías / cómo lo venderías (conferencia, no solo "trabajo en equipo" genérico).
- ${typoLine}
- Evita: ${CONSULTING_WEAK_PHRASES_ES.slice(0, 5).join(", ")}.`,
    1200,
  );
}

function buildConferenceStructureDirective(hasNotes: boolean): string {
  const sections = CONFERENCE_NARRATIVE_SECTIONS_ES.map((s, i) => `${i + 1}. ${s}`).join("\n");

  return truncateDirectorSignal(
    `MODO ESTRUCTURA DE CONFERENCIA (con tensión narrativa, NO genérica):
- Di que das estructura PROVISIONAL; la versión buena sale de sus notas.
- Usa lista numerada con estas secciones (adapta títulos si hace falta, mantén arco narrativo):
${sections}
- ${hasNotes ? "Pide comparar con sus notas (pegar aquí o subir)." : "Pregunta si ya tiene notas para afinar."}
- Metáfora temática sí; sin logos ni marcas oficiales de terceros.
- Postura: "Yo la organizaría así" — no "podrías considerar".`,
    2000,
  );
}

function buildDefaultVoiceDirective(typoAvoid: string[]): string {
  const typoLine =
    typoAvoid.length > 0 ? `No repetir: ${typoAvoid.join(", ")}.` : "";

  return truncateDirectorSignal(
    `VOZ CONSULTOR SENIOR (siempre):
- Evitar por defecto: ${CONSULTING_WEAK_PHRASES_ES.join(", ")}.
- Preferir: ${CONSULTING_PREFERRED_PHRASES_ES.join(", ")}.
- Corregir typos del usuario de forma discreta (no repetirlos).
- ${typoLine}`,
    1200,
  );
}

/**
 * BRAIN-10: detecta modo de estilo consultivo y directivas para el renderer.
 */
export function detectConsultingStyle(
  input: ConsultingStyleDetectionInput,
): ConsultingStyleDetectionResult {
  const corpusText = `${input.conversation_excerpt}\n${input.user_message}`;
  const typo_avoid_terms = detectTypoAvoidTerms(corpusText);
  const strongIdea = detectStrongUserIdea(input.user_message, input.conversation_excerpt);
  const wantsConferenceSections = detectConferenceSectionsRequest(corpusText);
  const hasNotes = detectUserHasNotes(corpusText);
  const needsClarity = detectNeedsClarity(input.user_message);

  let consulting_style_mode: ConsultingStyleMode = "default";
  let consulting_style_directive = buildDefaultVoiceDirective(typo_avoid_terms);
  let user_insight_anchor: string | null = strongIdea;
  let allow_structured_sections_list = false;
  let preferred_closing_question: string | null = null;

  if (needsClarity) {
    consulting_style_mode = "repair_confusion";
    consulting_style_directive = buildRepairConfusionDirective();
    preferred_closing_question =
      "¿Quieres que te contraten más por consultorías, conferencias o asesorías?";
  } else if (wantsConferenceSections) {
    consulting_style_mode = "conference_structure_with_notes";
    consulting_style_directive = buildConferenceStructureDirective(hasNotes);
    allow_structured_sections_list = true;
    user_insight_anchor = strongIdea ?? user_insight_anchor;
    preferred_closing_question = hasNotes
      ? "¿Puedes pegar tus notas aquí para compararlas con esta estructura?"
      : "¿Tienes ya un esquema en notas que podamos contrastar?";
  } else if (strongIdea && input.user_message.length > 40) {
    consulting_style_mode = "name_strong_idea";
    consulting_style_directive = buildNameStrongIdeaDirective(strongIdea, typo_avoid_terms);
    user_insight_anchor = strongIdea;
  } else if (strongIdea) {
    consulting_style_directive = `${buildDefaultVoiceDirective(typo_avoid_terms)}\n\nEje en sesión: ${strongIdea}`;
    user_insight_anchor = strongIdea;
  }

  return {
    consulting_style_mode,
    consulting_style_directive,
    user_insight_anchor,
    typo_avoid_terms,
    allow_structured_sections_list,
    preferred_closing_question,
  };
}
