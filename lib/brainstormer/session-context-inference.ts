import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";
import { detectThirdPartyIpRisk } from "@/lib/brainstormer/third-party-ip-guardrail";
import type { BrainstormerSessionProgressPayload } from "@/lib/schemas/brainstormer-session";

export type SessionContextSignals = {
  wants_conferences: boolean;
  has_conference_deliverable: boolean;
  has_event_or_festival: boolean;
  football_metaphor: boolean;
  third_party_ip_risk: boolean;
  no_material: boolean;
  building_section: boolean;
  section_name: string | null;
  asks_credentials: boolean;
  asks_achievements: boolean;
  asks_logros: boolean;
};

const GENERIC_CHALLENGE_PATTERNS = [
  /^reto estrat[eé]gico en definici[oó]n\.?$/i,
  /^posicionamiento de marca\.?$/i,
  /^estrategia general\.?$/i,
  /^reto estrat[eé]gico\.?$/i,
];

const GENERIC_NEXT_STEP_PATTERNS = [
  /^¿cu[aá]l es la prioridad/i,
  /^¿seguimos profundizando/i,
  /^¿qu[eé] tipo de/i,
  /^¿cu[aá]l quieres/i,
  /^¿te gustar[ií]a/i,
  /^¿podr[ií]as/i,
  /^¿tienes ya/i,
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

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function isGenericChallengeText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return GENERIC_CHALLENGE_PATTERNS.some((p) => p.test(t));
}

export function isGenericNextStepText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return GENERIC_NEXT_STEP_PATTERNS.some((p) => p.test(t));
}

export function extractSessionContextSignals(
  corpus: string,
  director: ConversationDirectorDecision,
  userMessage = "",
): SessionContextSignals {
  const t = normalize(corpus);
  const u = normalize(userMessage || (corpus.split("\n").pop() ?? ""));

  return {
    wants_conferences: hasAny(t, [
      /\bconferencias?\b/,
      /\bconferencista\b/,
      /\bconseguir conferencias\b/,
      /\bcharlas?\b/,
      /\btalks?\b/,
    ]),
    has_conference_deliverable:
      director.current_deliverable_type === "conference" ||
      hasAny(t, [/\bconferencia\b/, /\bestructura de la conferencia\b/]),
    has_event_or_festival:
      hasAny(t, [/\bfestival\b/, /\bentradas\b/, /\bboletas\b/, /\bpromove(r|mos)\b/]) ||
      (hasAny(t, [/\bevento\b/, /\beventos\b/]) && !hasAny(t, [/\bconferencias?\b/])),
    football_metaphor: hasAny(t, [
      /\bfutbol\b/,
      /\bf[uú]tbol\b/,
      /\bfutboler/,
      /\bequipo de futbol\b/,
      /\bdirector t[eé]cnico\b/,
      /\bcancha\b/,
      /\bpartido\b/,
      /\bjugadas?\b/,
    ]),
    third_party_ip_risk: director.world_cup_ip_guardrail || detectThirdPartyIpRisk(t),
    no_material: director.user_has_no_material,
    building_section:
      director.should_generate_content_now || director.deliverable_build_depth === "section_draft",
    section_name: director.current_deliverable_section,
    asks_credentials: hasAny(u, [
      /\bpremios?\b/,
      /\blogros?\b/,
      /\bcredenciales?\b/,
      /\bcasos?\s+(de\s+)?exito\b/,
      /\breconocimientos?\b/,
      /\bexperiencia\s+profesional\b/,
      /\bque\s+he\s+ganado\b/,
      /\bque\s+tengo\s+en\s+la\s+base\b/,
    ]),
    asks_achievements: hasAny(t, [/\bpremios?\b/, /\blogros?\b/, /\btrofeos?\b/]),
    asks_logros: hasAny(u, [/\blogros?\b/, /\bpremios?\b/]),
  };
}

export function inferSessionChallenge(
  signals: SessionContextSignals,
  director: ConversationDirectorDecision,
  progress: BrainstormerSessionProgressPayload,
): string | null {
  if (hasText(progress.current_challenge) && !isGenericChallengeText(progress.current_challenge)) {
    return progress.current_challenge.trim();
  }

  if (signals.wants_conferences && signals.has_conference_deliverable) {
    return "Diseñar una conferencia para conseguir más contrataciones como conferencista.";
  }

  if (signals.wants_conferences && director.challenge_type === "positioning") {
    return "Mejorar posicionamiento de marca para conseguir más conferencias.";
  }

  if (signals.has_conference_deliverable && !signals.wants_conferences) {
    return "Construir y empaquetar una conferencia vendible con narrativa clara.";
  }

  if (signals.wants_conferences) {
    return "Diseñar y empaquetar una conferencia para conseguir más contrataciones.";
  }

  if (director.challenge_type === "sales") {
    return "Impulsar ventas o conversión del entregable prioritario.";
  }
  if (director.challenge_type === "campaign") {
    return "Definir y estructurar una campaña o lanzamiento.";
  }
  if (director.challenge_type === "event_promotion" || signals.has_event_or_festival) {
    return "Promover un evento o experiencia con objetivo de asistencia o venta.";
  }
  if (director.challenge_type === "content") {
    return "Planificar contenido o piezas editoriales alineadas a la marca.";
  }
  if (director.challenge_type === "activation") {
    return "Diseñar una activación de marca con experiencia concreta.";
  }
  if (director.challenge_type === "audiovisual") {
    return "Desarrollar pieza o narrativa audiovisual con objetivo claro.";
  }
  if (director.challenge_type === "positioning") {
    return "Aclarar posicionamiento y prioridad de audiencia u oferta.";
  }

  return null;
}

export function inferSessionDirection(
  signals: SessionContextSignals,
  progress: BrainstormerSessionProgressPayload,
): string | null {
  if (hasText(progress.preliminary_objective) && !textMentionsThirdPartyIpOnly(progress.preliminary_objective)) {
    return progress.preliminary_objective.trim();
  }

  if (signals.football_metaphor) {
    return "Usar la analogía entre estrategia de marketing y equipo de fútbol (territorio propio, sin IP de terceros).";
  }

  if (signals.has_conference_deliverable && signals.wants_conferences) {
    return "Empaquetar la conferencia como prueba de criterio estratégico, no solo como charla inspiracional.";
  }

  return null;
}

function textMentionsThirdPartyIpOnly(text: string): boolean {
  const t = text.trim();
  if (t.length < 20) return false;
  return /^evitar|sin\s+ip|no\s+usar/i.test(t) && /fifa|mundial|oficial|terceros/i.test(t);
}

export function inferSessionDecisions(
  signals: SessionContextSignals,
  director: ConversationDirectorDecision,
): string[] {
  const decisions: string[] = [];

  if (signals.football_metaphor && signals.has_conference_deliverable) {
    decisions.push(
      "Marco narrativo: rival/audiencia, jugadores/canales, juego/estrategia, jugadas/tácticas.",
    );
  }

  if (signals.no_material) {
    decisions.push("Construir desde cero sin notas previas del usuario.");
  }

  if (director.user_selected_previous_option && director.selected_option_focus === "get_conferences") {
    decisions.push("Objetivo priorizado: conseguir más conferencias.");
  } else if (director.user_selected_previous_option && director.selected_option_focus === "sell_consulting") {
    decisions.push("Objetivo priorizado: vender consultoría.");
  } else if (director.user_selected_previous_option && director.selected_option_focus === "public_authority") {
    decisions.push("Objetivo priorizado: fortalecer autoridad pública.");
  }

  if (signals.wants_conferences && !signals.has_conference_deliverable) {
    decisions.push("Enfoque en empaquetar oferta de conferencia vendible.");
  }

  return decisions;
}

export function inferSessionNextStep(
  signals: SessionContextSignals,
  director: ConversationDirectorDecision,
  progress: BrainstormerSessionProgressPayload,
): string | null {
  if (hasText(progress.next_step) && !isGenericNextStepText(progress.next_step)) {
    return progress.next_step.trim();
  }

  if (signals.asks_credentials || signals.asks_logros || signals.asks_achievements) {
    return "Seleccionar los logros y casos de la base que servirán como prueba de autoridad para este entregable.";
  }

  if (signals.building_section && signals.section_name) {
    return `Desarrollar la sección «${signals.section_name}».`;
  }

  if (signals.has_conference_deliverable && signals.no_material) {
    return "Definir estructura de la conferencia y desarrollar la primera sección con narrativa completa.";
  }

  if (signals.has_conference_deliverable) {
    return "Cerrar estructura de secciones y desarrollar la primera en profundidad.";
  }

  if (director.work_mode === "deliverable_building" && director.detected_deliverable_type === "landing_page") {
    return "Ordenar mensaje y secciones de la landing antes de redactar copy final.";
  }

  if (director.should_request_user_material && !signals.no_material) {
    return "Compartir brief o insumos base antes de redactar piezas finales.";
  }

  return null;
}
