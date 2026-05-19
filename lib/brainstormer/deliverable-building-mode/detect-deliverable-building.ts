import {
  CONFERENCE_NARRATIVE_SECTIONS_ES,
} from "@/lib/brainstormer/consulting-style/consulting-voice-contract";
import type {
  CurrentDeliverableType,
  DeliverableBuildDepth,
  DeliverableBuildingDetectionInput,
  DeliverableBuildingDetectionResult,
} from "@/lib/brainstormer/deliverable-building-mode/types";
import { truncateDirectorSignal } from "@/lib/brainstormer/conversation-director/truncate-director-signal";

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

function corpus(input: DeliverableBuildingDetectionInput): string {
  return normalize(`${input.conversation_excerpt}\n${input.user_message}`);
}

export function detectUserDeclaredNoMaterial(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    /\bno tengo notas\b/,
    /\bno tengo nada\b/,
    /\bno tengo material\b/,
    /\bno tengo insumos\b/,
    /\bno tengo contenido\b/,
    /\bpartamos de cero\b/,
    /\barranquemos de cero\b/,
    /\bempezar de cero\b/,
    /\bsin notas\b/,
    /\bnada de notas\b/,
  ]);
}

export function detectContentGenerationRequest(userMessage: string): boolean {
  const t = normalize(userMessage);
  return hasAny(t, [
    /\bdesarrolla(mela|la|lo)?\b/,
    /\bdesarrollo\b/,
    /\bdesarróllamela\b/,
    /\bdesarrollamela\b/,
    /\bescribemelo\b/,
    /\bescribelo\b/,
    /\bescribeme\b/,
    /\bayudame a construirlo\b/,
    /\bconstruyelo\b/,
    /\bconstruyemelo\b/,
    /\bredacta(mela|lo)?\b/,
    /\bcomencemos por el primero\b/,
    /\bempecemos por el primero\b/,
    /\bpor el primero\b/,
    /\bel primer(o|a)\s+(punto|seccion)\b/,
    /\bseccion\s+1\b/,
    /\bnada,?\s*desarr/,
  ]);
}

function assistantBlocks(excerpt: string): string[] {
  return excerpt
    .split(/\n\n+/)
    .filter((b) => /^assistant:/i.test(b.trim()))
    .map((b) => b.replace(/^assistant:\s*/i, ""));
}

function bestAssistantOutline(excerpt: string): string {
  const blocks = assistantBlocks(excerpt);
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i] ?? "";
    if (/^\s*\d+[.)]\s+/m.test(block)) return block;
  }
  return blocks[blocks.length - 1] ?? "";
}

function parseNumberedSections(assistantText: string): string[] {
  const sections: string[] = [];
  const lines = assistantText.split(/\n/);
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)[.)]\s+(.+)/);
    if (m?.[2]) {
      sections.push(m[2].trim());
    }
  }
  if (sections.length > 0) return sections;

  return [...CONFERENCE_NARRATIVE_SECTIONS_ES];
}

export function extractCurrentDeliverableSection(
  userMessage: string,
  conversationExcerpt: string,
): string | null {
  const u = normalize(userMessage);
  const assistant = bestAssistantOutline(conversationExcerpt);
  const sections = parseNumberedSections(assistant);

  if (hasAny(u, [/\bprimero\b/, /\b1\b/, /\bseccion\s+1\b/, /\bcomencemos por el/])) {
    return sections[0] ?? CONFERENCE_NARRATIVE_SECTIONS_ES[0] ?? null;
  }
  if (hasAny(u, [/\bsegundo\b/, /\b2\b/, /\bseccion\s+2\b/])) {
    return sections[1] ?? CONFERENCE_NARRATIVE_SECTIONS_ES[1] ?? null;
  }
  if (hasAny(u, [/\btercero\b/, /\b3\b/])) {
    return sections[2] ?? CONFERENCE_NARRATIVE_SECTIONS_ES[2] ?? null;
  }

  if (detectContentGenerationRequest(userMessage) && sections.length > 0) {
    const lastUser = conversationExcerpt.split(/\n\n+/).filter((b) => /^user:/i.test(b.trim()));
    const prevUser = lastUser.length >= 2 ? normalize(lastUser[lastUser.length - 2] ?? "") : "";
    if (hasAny(prevUser, [/\bprimero\b/, /\bcomencemos por/])) {
      return sections[0] ?? null;
    }
    return sections[0] ?? null;
  }

  return null;
}

export function inferCurrentDeliverableType(
  text: string,
): CurrentDeliverableType | null {
  const t = normalize(text);
  if (hasAny(t, [/\bconferencia\b/, /\bcharla\b/, /\btalk\b/, /\bsecciones de la conferencia\b/])) {
    return "conference";
  }
  if (hasAny(t, [/\blanding\b/])) return "landing_page";
  if (hasAny(t, [/\bplan de campana\b/, /\bcampana\b/])) return "campaign_plan";
  if (hasAny(t, [/\bplan de contenido\b/, /\bcontenido editorial\b/])) return "content_plan";
  if (hasAny(t, [/\bestructura\b/, /\bdesarrolla/, /\bconstruir\b/])) return "conference";
  return null;
}

function buildSectionDraftDirective(section: string | null, deliverableType: CurrentDeliverableType | null): string {
  const sectionLabel = section ?? "la sección en curso";
  const typeLabel = deliverableType === "conference" ? "conferencia" : "entregable";

  return truncateDirectorSignal(
    `MODO CONSTRUCCIÓN DE ENTREGABLE (BRAIN-12) — BORRADOR REAL:
- El usuario pidió desarrollar contenido AHORA. Entrega un BORRADOR de sección en assistant_message (150–280 palabras), no solo consejos.
- Tipo: ${typeLabel}. Sección: "${sectionLabel}".
- Estructura: título ### con nombre de sección + 3–5 párrafos en prosa (metáfora futbolera si aplica al hilo de la sesión).
- Tono: consultor/creativo senior que ESCRIBE, no asistente que sugiere "podrías".
- PROHIBIDO: FODA, matrices, "sería útil", "podrías considerar", "¿te gustaría profundizar?" tras el borrador.
- PROHIBIDO: volver a pedir notas o archivos si user_has_no_material.
- Puedes cerrar el borrador con UNA pregunta al público dentro del texto si encaja.
- Después del borrador, UNA sola pregunta en next_best_question sobre tono o siguiente sección (no profundizar genérico).`,
    2000,
  );
}

function buildOutlineDirective(): string {
  return truncateDirectorSignal(
    `MODO CONSTRUCCIÓN — ESQUEMA:
- Entregar estructura narrativa con tensión (no intro-desarrollo-cierre genérico).
- Si user_has_no_material: construir desde cero con la base de marca + hilo de sesión; NO pedir notas.`,
    1200,
  );
}

/**
 * BRAIN-12: detecta construcción de entregable, material ausente y pedido de borrador.
 */
export function detectDeliverableBuilding(
  input: DeliverableBuildingDetectionInput,
): DeliverableBuildingDetectionResult {
  const full = corpus(input);
  const user_has_no_material = detectUserDeclaredNoMaterial(full);
  const should_generate_content_now = detectContentGenerationRequest(input.user_message);
  const current_deliverable_type = inferCurrentDeliverableType(full);
  const current_deliverable_section = extractCurrentDeliverableSection(
    input.user_message,
    input.conversation_excerpt,
  );

  let deliverable_build_depth: DeliverableBuildDepth = "outline";
  if (should_generate_content_now) {
    deliverable_build_depth = "section_draft";
  } else if (hasAny(normalize(input.user_message), [/\bborrador completo\b/, /\btodo el guion\b/])) {
    deliverable_build_depth = "full_draft";
  }

  let deliverable_building_directive: string | null = null;
  let preferred_next_question: string | null = null;

  if (user_has_no_material && !should_generate_content_now) {
    deliverable_building_directive = truncateDirectorSignal(
      "El usuario declaró que NO tiene notas/insumos. No vuelvas a pedir Word, PDF ni pegar notas. Construye desde la base de marca y el hilo acordado.",
      1200,
    );
  }

  if (should_generate_content_now) {
    deliverable_building_directive = buildSectionDraftDirective(
      current_deliverable_section,
      current_deliverable_type,
    );
    preferred_next_question =
      "¿Quieres que la siguiente sección la construya con este mismo tono: estratégico, claro y con metáfora futbolera?";
  } else if (
    hasAny(normalize(input.user_message), [
      /\bestructura\b/,
      /\bsecciones\b/,
      /\bpuntos\b/,
    ])
  ) {
    deliverable_building_directive = buildOutlineDirective();
  }

  return {
    user_has_no_material,
    current_deliverable_type,
    current_deliverable_section,
    deliverable_build_depth,
    should_generate_content_now,
    deliverable_building_directive,
    preferred_next_question,
  };
}
