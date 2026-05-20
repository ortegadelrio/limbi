import { truncateDirectorSignal } from "@/lib/brainstormer/conversation-director/truncate-director-signal";
import {
  detectThirdPartyIpRisk,
  THIRD_PARTY_IP_GUARDRAIL_NOTE_ES,
} from "@/lib/brainstormer/third-party-ip-guardrail";
import type {
  ConversationDirectorChallengeType,
  ConversationDirectorUserIntent,
  ConversationDirectorWorkMode,
  DetectedDeliverableType,
} from "@/lib/brainstormer/conversation-director/types";
import type { ResolveConversationDirectorInput } from "@/lib/brainstormer/conversation-director/types";

export type WorkModeDetectionInput = {
  user_message: string;
  conversation_excerpt: string;
  user_intent: ConversationDirectorUserIntent;
  challenge_type: ConversationDirectorChallengeType;
  session_progress: ResolveConversationDirectorInput["session_progress"];
};

export type WorkModeDetectionResult = {
  work_mode: ConversationDirectorWorkMode;
  concrete_deliverable_detected: boolean;
  detected_deliverable_type: DetectedDeliverableType | null;
  should_request_user_material: boolean;
  requested_material_reason: string | null;
  transition_message: string | null;
  world_cup_ip_guardrail: boolean;
  multi_deliverable_project_shape: boolean;
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function corpus(input: WorkModeDetectionInput): string {
  return normalize(`${input.conversation_excerpt}\n${input.user_message}`);
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/** @deprecated Usar detectThirdPartyIpRisk desde third-party-ip-guardrail */
export function detectWorldCupIpGuardrail(text: string): boolean {
  return detectThirdPartyIpRisk(text);
}

export function detectUserMaterialReference(text: string): {
  mentions_material: boolean;
  material_kind: string | null;
  material_already_in_message: boolean;
} {
  const t = normalize(text);
  const mentions_material = hasAny(t, [
    /\bword\b/,
    /\bdocx?\b/,
    /\bpdf\b/,
    /\bbrief\b/,
    /\barchivo\b/,
    /\bdocumento\b/,
    /\bexcel\b/,
    /\bppt\b/,
    /\bpresentacion\b/,
    /\bte\s+lo\s+paso\b/,
    /\bte\s+comparto\b/,
    /\bsubir(el)?\b/,
    /\badjunt(ar|o)\b/,
  ]);

  let material_kind: string | null = null;
  if (/\bword\b|docx?/.test(t)) material_kind = "Word";
  else if (/\bpdf\b/.test(t)) material_kind = "PDF";
  else if (/\bbrief\b/.test(t)) material_kind = "brief";
  else if (/\barchivo\b|\bdocumento\b/.test(t)) material_kind = "archivo";

  const material_already_in_message =
    mentions_material &&
    (t.length > 900 ||
      hasAny(t, [
        /\bcontenido\s+base\b/,
        /\baqui\s+esta\b/,
        /\bpego\b/,
        /\bte\s+dejo\b/,
        /\btemas\s*:/,
        /\bmodulo\s+\d/,
      ]));

  return { mentions_material, material_kind, material_already_in_message };
}

export function detectDeliverableType(text: string): {
  detected: boolean;
  type: DetectedDeliverableType | null;
} {
  const t = normalize(text);

  if (hasAny(t, [/\blanding\b/, /\bpagina\s+de\s+aterrizaje\b/, /\bhome\s+page\b/])) {
    return { detected: true, type: "landing_page" };
  }
  if (hasAny(t, [/\bpauta\b/, /\bmedios\s+pagos\b/, /\bpaid\s+media\b/, /\banuncios\b/, /\bmeta\s+ads\b/])) {
    return { detected: true, type: "paid_media_plan" };
  }
  if (hasAny(t, [/\bguion\b/, /\bscript\b/, /\bspot\b/])) {
    return { detected: true, type: "audiovisual_script" };
  }
  if (hasAny(t, [/\bpresentacion\b/, /\bdeck\b/, /\bppt\b/, /\bpowerpoint\b/])) {
    return { detected: true, type: "presentation" };
  }
  if (hasAny(t, [/\bplan\s+de\s+contenido\b/, /\bcalendario\s+editorial\b/, /\bcontenidos\s+para\s+redes\b/])) {
    return { detected: true, type: "content_plan" };
  }
  if (hasAny(t, [/\bconcepto\s+de\s+activacion\b/])) {
    return { detected: true, type: "activation_concept" };
  }
  if (
    hasAny(t, [
      /\bplan\s+de\s+campana\b/,
      /\bcampana\s+360\b/,
      /\bdocumento\s+de\s+campana\b/,
      /\bdeck\s+de\s+campana\b/,
    ])
  ) {
    return { detected: true, type: "campaign_plan" };
  }
  if (
    hasAny(t, [
      /\bconstru(ir|yendo)\b/,
      /\barmar\b/,
      /\bredactar\b/,
      /\bescribir\b/,
      /\btextos?\s+(de|para)\b/,
      /\bcopys?\b/,
      /\bpieza\b/,
      /\bcreativos?\b/,
    ]) &&
    hasAny(t, [/\blanding\b/, /\btexto\b/, /\bcorreo\b/, /\bpost\b/])
  ) {
    return { detected: true, type: "other" };
  }

  return { detected: false, type: null };
}

function deliverableLabel(type: DetectedDeliverableType): string | null {
  switch (type) {
    case "landing_page":
      return "una landing";
    case "paid_media_plan":
      return "un plan de pauta";
    case "campaign_plan":
      return "un plan de campaña";
    case "content_plan":
      return "un plan de contenido";
    case "audiovisual_script":
      return "un guion";
    case "activation_concept":
      return "un concepto de activación";
    case "presentation":
      return "una presentación";
    case "other":
      return "un entregable concreto";
    default:
      return null;
  }
}

function inferProjectSummaryFromCorpus(t: string): string | null {
  const parts: string[] = [];

  if (hasAny(t, [/\bconferencia\b/, /\bcharla\b/, /\btalk\b/])) {
    parts.push("una conferencia");
    if (hasAny(t, [/\bliderazgo\b/, /\btrabajo\s+en\s+equipo\b/])) {
      parts.push("de liderazgo y trabajo en equipo");
    }
  }
  if (hasAny(t, [/\bfutbol\b/, /\bfutbolero\b/, /\bmundial\b/])) {
    parts.push("inspirada en fútbol");
  }
  if (hasAny(t, [/\bceos?\b/, /\bcaribe\b/, /\bcolombia\b/])) {
    parts.push("dirigida a CEOs del Caribe colombiano");
  }
  if (hasAny(t, [/\bconsultor(ia|ias)\b/])) {
    parts.push("para vender consultoría");
  }

  if (parts.length === 0) return null;
  return parts.join(" ");
}

function buildTransitionMessage(args: {
  work_mode: ConversationDirectorWorkMode;
  deliverable_type: DetectedDeliverableType | null;
  project_summary: string | null;
  material_kind: string | null;
  world_cup_ip_guardrail: boolean;
  multi_deliverable: boolean;
}): string | null {
  if (args.work_mode !== "deliverable_building" && args.work_mode !== "project_seed") {
    return null;
  }

  const deliverable = args.deliverable_type
    ? deliverableLabel(args.deliverable_type) ?? "un entregable concreto"
    : "un entregable concreto";

  const summary = args.project_summary
    ? `Ya tenemos un proyecto concreto: ${deliverable} ${args.project_summary}.`
    : `Esto ya dejó de ser solo exploración: pasamos a construir ${deliverable}.`;

  const parts: string[] = [];

  if (args.work_mode === "project_seed" || args.multi_deliverable) {
    parts.push("Esto ya dejó de ser solo posicionamiento estratégico.");
    parts.push(
      args.project_summary
        ? `Ya tenemos un proyecto preliminar: ${deliverable} ${args.project_summary}.`
        : `Ya tenemos un proyecto preliminar: ${deliverable}.`,
    );
  } else {
    parts.push(summary);
  }

  if (args.material_kind) {
    parts.push(
      `Antes de escribir textos finales, necesito leer el contenido que tienes en ${args.material_kind}.`,
    );
  } else if (args.work_mode === "deliverable_building") {
    parts.push("Antes de redactar piezas finales, necesito el insumo base (brief o contenidos).");
  }

  if (args.world_cup_ip_guardrail) {
    parts.push(THIRD_PARTY_IP_GUARDRAIL_NOTE_ES);
  }

  const unique = [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
  return truncateDirectorSignal(unique.join(" "), 1200);
}

/**
 * BRAIN-9: detecta modo de trabajo y transición exploración → entregable/proyecto.
 */
export function detectWorkModeAndTransition(
  input: WorkModeDetectionInput,
): WorkModeDetectionResult {
  const t = corpus(input);
  const world_cup_ip_guardrail = detectThirdPartyIpRisk(t);
  const material = detectUserMaterialReference(t);
  const deliverable = detectDeliverableType(t);

  const has_landing = /\blanding\b/.test(t);
  const has_pauta = /\bpauta\b/.test(t);
  const multi_deliverable_project_shape = has_landing && has_pauta;

  const concrete_deliverable_detected =
    deliverable.detected ||
    multi_deliverable_project_shape ||
    (input.user_intent !== "ask_for_research" &&
      hasAny(t, [
        /\bconstru(ir|yendo)\s+la\s+landing\b/,
        /\barmar\s+la\s+landing\b/,
        /\bescribir\s+la\s+landing\b/,
      ]));

  let detected_deliverable_type: DetectedDeliverableType | null = deliverable.type;
  if (multi_deliverable_project_shape && detected_deliverable_type === null) {
    detected_deliverable_type = "landing_page";
  }

  let work_mode: ConversationDirectorWorkMode = "exploration";

  if (input.user_intent === "ask_for_research") {
    work_mode = "research_needed";
  } else if (multi_deliverable_project_shape || input.user_intent === "wants_project") {
    work_mode = "project_seed";
  } else if (concrete_deliverable_detected) {
    work_mode = "deliverable_building";
  } else if (
    input.session_progress.current_challenge.trim().length > 0 ||
    input.session_progress.preliminary_objective.trim().length > 0
  ) {
    work_mode = "strategic_focus";
  }

  const building_copy_request = hasAny(t, [
    /\bconstru(ir|yendo)\b/,
    /\barmar\b/,
    /\bredactar\b/,
    /\bescribir\b/,
    /\btextos?\s+(de|para)\b/,
    /\bayud(a|ame)\s+a\b/,
  ]);

  const ideation_phase = hasAny(t, [
    /\blanzar\b/,
    /\blanzamiento\b/,
    /\bcampana\b/,
    /\bexpectativa\b/,
    /\bprelanzamiento\b/,
    /\bconcepto\b/,
    /\bestrategia\b/,
    /\balgo diferente\b/,
    /\bparaguas\b/,
    /\bruta(s)? creativ/,
  ]) &&
    !hasAny(t, [
      /\bguion final\b/,
      /\bcopy final\b/,
      /\bdocumento completo\b/,
      /\bredactar la pieza final\b/,
      /\bversion final\b/,
      /\btexto definitivo\b/,
    ]);

  const needs_material_for_build =
    (work_mode === "deliverable_building" || work_mode === "project_seed") &&
    building_copy_request &&
    !material.material_already_in_message;

  const should_request_user_material = needs_material_for_build && !ideation_phase;

  let requested_material_reason: string | null = null;
  if (should_request_user_material && material.mentions_material) {
    const kind = material.material_kind ?? "archivo";
    requested_material_reason = truncateDirectorSignal(
      `El usuario indicó que tiene contenido en ${kind} pero aún no lo compartió en el chat; hace falta leerlo antes de redactar la landing o piezas finales.`,
      1000,
    );
  } else if (should_request_user_material) {
    requested_material_reason = truncateDirectorSignal(
      "Hay un entregable concreto en construcción; conviene pedir brief o contenido base antes de proponer textos finales.",
      1000,
    );
  }

  const project_summary = inferProjectSummaryFromCorpus(t);
  const transition_message = buildTransitionMessage({
    work_mode,
    deliverable_type: detected_deliverable_type,
    project_summary,
    material_kind: material.material_kind,
    world_cup_ip_guardrail,
    multi_deliverable: multi_deliverable_project_shape,
  });

  return {
    work_mode,
    concrete_deliverable_detected,
    detected_deliverable_type,
    should_request_user_material,
    requested_material_reason,
    transition_message,
    world_cup_ip_guardrail,
    multi_deliverable_project_shape,
  };
}