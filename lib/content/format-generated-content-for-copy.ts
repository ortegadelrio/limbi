import type { ContentGenerationType } from "@/lib/content/build-input";

const DIVIDER = "\n\n---\n\n";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function formatShortPitchItem(o: Record<string, unknown>, index: number): string {
  const title = str(o.title);
  const pitch = str(o.pitch);
  const intention = str(o.strategic_intention);
  const use = str(o.best_use);
  const head = title ? `${index}. ${title}` : `${index}.`;
  const lines = [
    head,
    `Pitch: ${pitch || "—"}`,
    `Intención estratégica: ${intention || "—"}`,
    `Uso recomendado: ${use || "—"}`,
  ];
  return lines.join("\n");
}

function formatCaptionItem(o: Record<string, unknown>, index: number): string {
  const lines = [
    `${index}.`,
    `Caption: ${str(o.caption) || "—"}`,
    `Tono: ${str(o.tone) || "—"}`,
    `Intención estratégica: ${str(o.strategic_intention) || "—"}`,
    `Canal sugerido: ${str(o.suggested_channel) || "—"}`,
  ];
  return lines.join("\n");
}

function formatIdeaItem(o: Record<string, unknown>, index: number): string {
  const lines = [
    `${index}.`,
    `Idea: ${str(o.idea_title) || "—"}`,
    `Descripción: ${str(o.idea_description) || "—"}`,
    `Rol estratégico: ${str(o.strategic_role) || "—"}`,
    `Formato posible: ${str(o.possible_format) || "—"}`,
    `Por qué funciona: ${str(o.why_it_works) || "—"}`,
  ];
  return lines.join("\n");
}

function formatGraphicItem(o: Record<string, unknown>, index: number): string {
  const lines = [
    `${index}.`,
    `Frase: ${str(o.phrase) || "—"}`,
    `Intención: ${str(o.intention) || "—"}`,
    `Contexto visual: ${str(o.visual_context) || "—"}`,
    `Uso recomendado: ${str(o.usage_note) || "—"}`,
  ];
  return lines.join("\n");
}

const SECTION_TITLE: Record<ContentGenerationType, string> = {
  short_pitch: "PITCH CORTO",
  captions: "CAPTIONS",
  content_ideas: "IDEAS DE CONTENIDO",
  graphic_phrases: "FRASES GRÁFICAS",
};

function itemToRecord(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  return item as Record<string, unknown>;
}

/**
 * Texto plano listo para portapapeles (sin JSON ni metadatos internos).
 */
export function formatGeneratedContentForCopy(
  contentType: ContentGenerationType,
  items: unknown[],
): string {
  const title = SECTION_TITLE[contentType];
  const blocks: string[] = [];
  let i = 0;
  for (const raw of items) {
    const o = itemToRecord(raw);
    if (!o) continue;
    i += 1;
    switch (contentType) {
      case "short_pitch":
        blocks.push(formatShortPitchItem(o, i));
        break;
      case "captions":
        blocks.push(formatCaptionItem(o, i));
        break;
      case "content_ideas":
        blocks.push(formatIdeaItem(o, i));
        break;
      case "graphic_phrases":
        blocks.push(formatGraphicItem(o, i));
        break;
      default:
        break;
    }
  }
  if (blocks.length === 0) return "";
  return `${title}\n\n${blocks.join(DIVIDER)}`;
}
