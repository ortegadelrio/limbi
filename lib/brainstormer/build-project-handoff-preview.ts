/**
 * Evalúa madurez de sesión y arma preview de handoff a Proyecto (sin crear proyecto en DB).
 */

import type { BrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";
import { priorHasConfirmedConcept } from "@/lib/brainstormer/turn-interpreter";
import type {
  BrainstormerSessionProgressPayload,
  ProjectHandoffPreview,
} from "@/lib/schemas/brainstormer-session";

export type ProjectHandoffReadiness = {
  ready: boolean;
  missing: string[];
  preview: ProjectHandoffPreview | null;
};

function hasCampaignMechanism(
  progress: BrainstormerSessionProgressPayload,
  brief: BrainstormerWorkingBrief,
): boolean {
  const routes = progress.recommended_routes.trim();
  const bridge = brief.conversion_bridge.trim();
  const ideas = progress.ideas_explored.trim();
  const stage = brief.campaign_stage;
  return (
    routes.length >= 24 ||
    bridge.length >= 40 ||
    /mecanismo|expectativa|producto falso|puente|sketch/i.test(ideas) ||
    stage === "expectativa" ||
    stage === "lanzamiento" ||
    stage === "conversion"
  );
}

function inferProjectType(
  progress: BrainstormerSessionProgressPayload,
  brief: BrainstormerWorkingBrief,
): ProjectHandoffPreview["project_type"] {
  const corpus = [
    progress.session_summary,
    progress.preliminary_objective,
    progress.current_challenge,
    brief.next_best_step,
  ]
    .join(" ")
    .toLowerCase();

  if (/adquisici|atraer clientes|tr[aá]fico|sitio.*listo/i.test(corpus)) {
    return "campaña digital / adquisición";
  }
  if (/lanzamiento|marca nueva|expectativa/i.test(corpus)) {
    return "lanzamiento";
  }
  return "campaña digital";
}

function buildSuggestedDeliverables(
  brief: BrainstormerWorkingBrief,
): string[] {
  const out: string[] = [];
  if (brief.campaign_stage === "expectativa" || /expectativa|sketch|producto falso/i.test(brief.conversion_bridge)) {
    out.push("Pieza de expectativa / producto falso");
  }
  if (brief.confirmed_conceptual_umbrella.trim()) {
    out.push("Concepto rector y mensaje conector");
  }
  out.push("Landing o página de conversión");
  out.push("Plan de activación digital");
  return [...new Set(out)].slice(0, 8);
}

export function evaluateProjectHandoffReadiness(args: {
  progress: BrainstormerSessionProgressPayload;
  working_brief: BrainstormerWorkingBrief;
  brand_name: string;
}): ProjectHandoffReadiness {
  const { progress, working_brief: brief } = args;
  const missing: string[] = [];

  if (!progress.current_challenge.trim()) {
    missing.push("definir el reto o challenge de la sesión");
  }
  if (!progress.preliminary_objective.trim()) {
    missing.push("aclarar el objetivo inicial de la campaña");
  }
  if (!args.brand_name.trim()) {
    missing.push("asociar la sesión a una marca");
  }
  if (!priorHasConfirmedConcept(brief)) {
    missing.push("cerrar el paraguas conceptual o una dirección estratégica clara");
  }
  if (!hasCampaignMechanism(progress, brief)) {
    missing.push("definir al menos una ruta o mecanismo de campaña (expectativa, puente, conversión)");
  }
  const nextClear =
    progress.next_step.trim() || brief.next_best_step.trim() || progress.recommended_routes.trim();
  if (!nextClear) {
    missing.push("acordar el próximo paso concreto");
  }

  if (missing.length > 0) {
    return { ready: false, missing: missing.slice(0, 4), preview: null };
  }

  const umbrella = brief.confirmed_conceptual_umbrella.trim();
  const preview: ProjectHandoffPreview = {
    project_type: inferProjectType(progress, brief),
    objective: progress.preliminary_objective.trim(),
    confirmed_umbrella: umbrella,
    audience_initial: progress.audience_notes.trim() || "Por definir en cuestionario de proyecto",
    campaign_mechanism:
      progress.recommended_routes.trim().slice(0, 800) ||
      brief.conversion_bridge.trim().slice(0, 800) ||
      progress.ideas_explored.trim().slice(0, 400),
    conversion_bridge: brief.conversion_bridge.trim(),
    suggested_deliverables: buildSuggestedDeliverables(brief),
    pending_questions: progress.open_questions.trim()
      ? progress.open_questions.split(/\n+/).map((q) => q.trim()).filter(Boolean).slice(0, 6)
      : [],
  };

  return { ready: true, missing: [], preview };
}

export function formatProjectHandoffReadyMessage(args: {
  brand_name: string;
  preview: ProjectHandoffPreview;
}): string {
  const { brand_name, preview } = args;
  const umbrellaPart = preview.confirmed_umbrella
    ? `, con el paraguas «${preview.confirmed_umbrella}»`
    : "";
  const mechanismHint =
    /producto falso|inesperad|puente/i.test(preview.campaign_mechanism) ||
    /producto falso|inesperad/i.test(preview.conversion_bridge)
      ? ", el mecanismo de productos inverosímiles como gancho y el puente hacia productos reales en la página"
      : preview.campaign_mechanism
        ? ` y el mecanismo «${preview.campaign_mechanism.slice(0, 120)}${preview.campaign_mechanism.length > 120 ? "…" : ""}»`
        : "";

  return (
    `Sí. Ya tenemos suficiente para pasarlo a Proyecto. Te preparo el resumen para pasarlo a Proyecto.\n\n` +
    `Yo llevaría esta sesión como una ${preview.project_type} para ${brand_name}${umbrellaPart}${mechanismHint}.`
  );
}

export function formatProjectHandoffIncompleteMessage(missing: string[]): string {
  const questions = missing.slice(0, 2);
  if (questions.length === 1) {
    return `Antes de pasar a Proyecto, necesitamos ${questions[0]}. ¿Lo cerramos en este hilo?`;
  }
  return (
    `Antes de pasar a Proyecto, falta cerrar dos cosas: ${questions[0]} y ${questions[1]}. ` +
    `¿Empezamos por la primera?`
  );
}
