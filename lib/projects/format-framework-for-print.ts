/**
 * Construye HTML imprimible del Marco visible (solo lectura, sin JSON).
 * Usado para “Descargar PDF” vía ventana de impresión del navegador.
 */

export type FrameworkPrintPayload = Record<string, unknown> | string;

/** Acepta objeto o JSON en string (p. ej. serialización intermedia). */
export function normalizeFrameworkPayload(
  raw: unknown,
): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return {};
    try {
      const p = JSON.parse(t) as unknown;
      if (typeof p === "object" && p !== null && !Array.isArray(p)) {
        return p as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readRecord(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  return obj as Record<string, unknown>;
}

function readString(obj: unknown, key: string): string {
  const v = readRecord(obj)[key];
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return "";
}

function readStringArray(obj: unknown, key: string): string[] {
  const v = readRecord(obj)[key];
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === "string" && x.trim().length > 0) out.push(x);
    else if (typeof x === "number" && Number.isFinite(x)) out.push(String(x));
  }
  return out;
}

type Axis = {
  axis_title: string;
  strategic_meaning: string;
  narrative_use: string;
};

function readConceptualAxes(ns: unknown): Axis[] {
  const raw = readRecord(ns).conceptual_axes;
  if (!Array.isArray(raw)) return [];
  const axes: Axis[] = [];
  for (const item of raw) {
    if (typeof item === "string") continue;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const axis_title = typeof o.axis_title === "string" ? o.axis_title.trim() : "";
    const strategic_meaning =
      typeof o.strategic_meaning === "string" ? o.strategic_meaning.trim() : "";
    const narrative_use =
      typeof o.narrative_use === "string" ? o.narrative_use.trim() : "";
    if (axis_title || strategic_meaning || narrative_use) {
      axes.push({ axis_title, strategic_meaning, narrative_use });
    }
  }
  return axes;
}

function isNewVisibleFramework(fw: Record<string, unknown>): boolean {
  return (
    typeof fw.strategic_diagnosis === "object" &&
    fw.strategic_diagnosis !== null &&
    !Array.isArray(fw.strategic_diagnosis)
  );
}

function h2(t: string): string {
  return `<h2>${esc(t)}</h2>`;
}

function pBlock(label: string, body: string): string {
  const b = body.trim();
  if (!b) return "";
  return `<div class="block"><div class="lbl">${esc(label)}</div><p>${esc(b).replace(/\n/g, "<br/>")}</p></div>`;
}

function listBlock(title: string, items: string[]): string {
  if (items.length === 0) return "";
  return `<div class="block"><div class="lbl">${esc(title)}</div><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
}

function section(title: string, inner: string): string {
  if (!inner.trim()) return "";
  return `<section>${h2(title)}${inner}</section>`;
}

function buildLegacyInner(fw: Record<string, unknown>): string {
  const ptm = readRecord(fw.perception_to_move);
  const secondary = readStringArray(fw, "secondary_messages");
  const avoid = readStringArray(fw, "what_to_avoid");
  const opportunities = readStringArray(fw, "content_opportunities");
  let html = "";
  html += pBlock("Qué estás comunicando realmente", readString(fw, "what_is_really_communicated"));
  html += pBlock("Audiencia", readString(fw, "audience_summary"));
  html += pBlock("Tensión principal", readString(fw, "central_tension"));
  html += section(
    "Percepción a mover",
    pBlock("Percepción actual", readString(ptm, "current_perception")) +
      pBlock("Percepción deseada", readString(ptm, "desired_perception")),
  );
  html += pBlock("Promesa narrativa", readString(fw, "narrative_promise"));
  html += pBlock("Territorio de comunicación", readString(fw, "communication_territory"));
  html += pBlock("Personalidad de voz", readString(fw, "voice_personality"));
  html += pBlock("Atmósfera emocional", readString(fw, "emotional_atmosphere"));
  html += pBlock("Idea fuerza", readString(fw, "big_idea"));
  html += pBlock("Mensaje principal", readString(fw, "main_message"));
  html += listBlock("Mensajes secundarios", secondary);
  html += listBlock("Qué evitar", avoid);
  html += listBlock("Oportunidades de contenido", opportunities);
  return html;
}

const NOT_FINAL =
  "Estas son oportunidades estratégicas, no piezas finales.";

function buildNewInner(fw: Record<string, unknown>): string {
  const sd = readRecord(fw.strategic_diagnosis);
  const aud = readRecord(fw.audience);
  const cm = readRecord(fw.conflict_map);
  const rm = readRecord(fw.risk_map);
  const ns = readRecord(fw.narrative_strategy);
  const ma = readRecord(fw.message_architecture);
  const cso = readRecord(fw.content_strategy_opportunities);
  const sig = readRecord(fw.success_signals);
  const axes = readConceptualAxes(ns);

  let html = "";
  const ex = readString(fw, "executive_summary").trim();
  if (ex) {
    html += section(
      "Resumen ejecutivo",
      `<p>${esc(ex).replace(/\n/g, "<br/>")}</p>`,
    );
  }

  html += section(
    "Diagnóstico estratégico",
    pBlock("Situación actual", readString(sd, "current_situation")) +
      pBlock("Problema de comunicación", readString(sd, "communication_problem")) +
      pBlock("Oportunidad estratégica", readString(sd, "strategic_opportunity")) +
      pBlock("Resultado esperado", readString(sd, "expected_result")),
  );

  html += section(
    "Audiencia y movimiento esperado",
    pBlock("A quién necesitamos mover", readString(aud, "who_we_need_to_move")) +
      pBlock("Estado actual", readString(aud, "current_state")) +
      pBlock("Estado deseado", readString(aud, "desired_state")) +
      pBlock("Acción esperada", readString(aud, "expected_action")),
  );

  html += section(
    "Mapa de conflictos",
    pBlock("Conflicto principal", readString(cm, "main_conflict")) +
      pBlock("Conflicto de percepción", readString(cm, "perception_conflict")) +
      pBlock("Conflicto emocional", readString(cm, "emotional_conflict")) +
      pBlock("Conflicto de categoría o mercado", readString(cm, "category_or_market_conflict")) +
      pBlock("Conflicto interno de comunicación", readString(cm, "internal_communication_conflict")),
  );

  html += section(
    "Mapa de riesgos",
    listBlock("Riesgos principales", readStringArray(rm, "main_risks")) +
      listBlock("Riesgos de credibilidad", readStringArray(rm, "credibility_risks")) +
      listBlock("Riesgos de tono", readStringArray(rm, "tone_risks")) +
      listBlock("Brechas de evidencia", readStringArray(rm, "evidence_gaps")) +
      listBlock("Qué podría salir mal", readStringArray(rm, "what_could_go_wrong")),
  );

  let axesHtml = "";
  if (axes.length > 0) {
    axesHtml = axes
      .map(
        (ax, i) =>
          `<div class="axis"><div class="lbl">${esc(ax.axis_title || `Eje ${i + 1}`)}</div>` +
          pBlock("Significado estratégico", ax.strategic_meaning) +
          pBlock("Uso narrativo", ax.narrative_use) +
          `</div>`,
      )
      .join("");
  }

  html += section(
    "Estrategia narrativa",
    pBlock("Promesa narrativa", readString(ns, "narrative_promise")) +
      pBlock("Territorio de comunicación", readString(ns, "communication_territory")) +
      (axesHtml ? `<div class="block"><div class="lbl">Ejes conceptuales</div>${axesHtml}</div>` : "") +
      pBlock("Atmósfera emocional", readString(ns, "emotional_atmosphere")) +
      pBlock("Personalidad de voz", readString(ns, "voice_personality")),
  );

  html += section(
    "Arquitectura de mensajes",
    pBlock("Mensaje principal", readString(ma, "main_message")) +
      listBlock("Mensajes de apoyo", readStringArray(ma, "supporting_messages")) +
      listBlock("Pruebas disponibles", readStringArray(ma, "proof_points")) +
      listBlock("Mensajes a evitar", readStringArray(ma, "messages_to_avoid")),
  );

  const csoWarning = readString(cso, "not_final_content_warning").trim() || NOT_FINAL;
  html += section(
    "Oportunidades estratégicas de contenido",
    `<p class="note">${esc(csoWarning)}</p>` +
      listBlock("Roles de contenido estratégicos", readStringArray(cso, "strategic_content_roles")) +
      listBlock("Oportunidades de contenido", readStringArray(cso, "content_opportunities")) +
      listBlock("Ángulos recomendados", readStringArray(cso, "recommended_angles")),
  );

  html += section(
    "Señales de éxito",
    listBlock("Indicadores de percepción", readStringArray(sig, "perception_indicators")) +
      listBlock("Indicadores de engagement", readStringArray(sig, "engagement_indicators")) +
      listBlock("Indicadores de conversión o acción", readStringArray(sig, "conversion_or_action_indicators")) +
      listBlock("Señales cualitativas", readStringArray(sig, "qualitative_signals")),
  );

  html += listBlock("Recomendaciones estratégicas", readStringArray(fw, "strategic_recommendations"));
  html += listBlock("Guardrails / qué evitar", readStringArray(fw, "guardrails"));

  return html;
}

export type FrameworkPrintMeta = {
  platformLine: string;
  systemLine: string;
  userLine: string;
  versionLine: string;
  statusLine: string;
  generatedLine: string;
};

const PRINT_CSS = `
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #1c1917; }
  header { border-bottom: 1px solid #d6d3d1; padding-bottom: 12px; margin-bottom: 18px; }
  header .brand { font-size: 10pt; color: #57534e; margin-bottom: 6px; }
  header h1 { font-size: 16pt; font-weight: 700; margin: 0 0 8px; letter-spacing: -0.02em; }
  header .meta { font-size: 9.5pt; color: #44403c; margin: 2px 0; }
  article { max-width: 100%; }
  h2 { font-size: 12pt; font-weight: 700; margin: 18px 0 8px; page-break-after: avoid; break-after: avoid; color: #0f172a; border-bottom: 1px solid #e7e5e4; padding-bottom: 4px; }
  section { page-break-inside: avoid; break-inside: avoid; margin-bottom: 8px; }
  .block { margin-bottom: 10px; page-break-inside: avoid; }
  .lbl { font-size: 8.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #78716c; margin-bottom: 4px; }
  p { margin: 0 0 8px; white-space: pre-wrap; }
  ul { margin: 4px 0 10px 18px; padding: 0; }
  li { margin-bottom: 4px; }
  .axis { margin-bottom: 12px; padding: 8px 0; border-bottom: 1px solid #f5f5f4; }
  .note { font-size: 9.5pt; color: #57534e; font-style: italic; margin-bottom: 10px; }
`;

export function buildFrameworkPrintDocumentHtml(
  fw: FrameworkPrintPayload,
  meta: FrameworkPrintMeta,
): string {
  const rec = normalizeFrameworkPayload(fw);
  const legacy = !isNewVisibleFramework(rec);
  const bodyInner = legacy ? buildLegacyInner(rec) : buildNewInner(rec);

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${esc(meta.systemLine)} — Marco</title><style>${PRINT_CSS}</style></head><body><header><div class="brand">${esc(meta.platformLine)}</div><h1>${esc(meta.systemLine)}</h1><p class="meta">${esc(meta.userLine)}</p><p class="meta">${esc(meta.versionLine)}</p><p class="meta">${esc(meta.statusLine)}</p><p class="meta">${esc(meta.generatedLine)}</p></header><article>${bodyInner}</article></body></html>`;
}

export function formatFrameworkGeneratedTimestamp(date: Date): string {
  try {
    return new Intl.DateTimeFormat("es", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
