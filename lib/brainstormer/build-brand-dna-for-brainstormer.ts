import { extractDetectedBrandSignalsFromPayloads } from "@/lib/brainstormer/brand-signals-from-active-base";
import { BRAINSTORMER_BRAND_DNA_MAX_CHARS } from "@/lib/brainstormer/brainstormer-prompt-limits";
import type { BrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";

export const BRAND_DNA_PROMPT_HEADER = "BRAND_DNA_FOR_BRAINSTORMER" as const;

/** Frases cliché que no deben aparecer literales en el DNA (evitar priming). */
export const BRAND_DNA_LITERAL_CLICHE_PATTERNS: readonly RegExp[] = [
  /descubre\s+lo\s+inesperado/gi,
  /explora\s+lo\s+extraordinario/gi,
  /viaje\s+de\s+descubrimiento/gi,
  /aventura\s+de\s+lo\s+extraordinario/gi,
  /momentos\s+m[aá]gicos/gi,
  /experiencia\s+[uú]nica/gi,
  /aventura\s+de\s+descubrimiento/gi,
];

export const BRAND_DNA_WEAK_TERRITORY_FAMILY_ES =
  "familia genérica de descubrimiento vacío, aventura aspiracional, curiosidad decorativa y sorpresa sin sustento";

export type BrandDnaForBrainstormerFields = {
  brand_truth: string;
  desired_effect: string;
  differentiated_value: string;
  audience: string;
  tone: string;
  evidence_allowed: string;
  strategic_guardrails: string;
  weak_territories_to_avoid: string;
  conversion_mechanism: string;
  approved_session_decisions: string;
};

export type BuildBrandDnaForBrainstormerArgs = {
  knowledge_payload: Record<string, unknown> | null;
  limbic_payload: Record<string, unknown> | null;
  working_brief?: BrainstormerWorkingBrief | null;
};

export type BuildBrandDnaForBrainstormerResult = {
  fields: BrandDnaForBrainstormerFields;
  block: string;
  character_count: number;
  truncated_to_fit: boolean;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function clip(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** Quita frases cliché literales y recorta espacios. */
export function sanitizeBrandDnaText(text: string, max: number): string {
  let s = text;
  for (const p of BRAND_DNA_LITERAL_CLICHE_PATTERNS) {
    s = s.replace(p, "");
  }
  return clip(s.replace(/\s*\|\s*\s*/g, " | ").replace(/\s+/g, " ").trim(), max);
}

function sectionInterpretation(
  payload: Record<string, unknown> | null,
  sectionKey: string,
): string | null {
  if (!payload) return null;
  const sections = payload.section_interpretations;
  if (!Array.isArray(sections)) return null;
  for (const row of sections) {
    const r = asRecord(row);
    if (r?.section_key === sectionKey) {
      const headline = typeof r.headline === "string" ? r.headline.trim() : "";
      const interpretation = typeof r.interpretation === "string" ? r.interpretation.trim() : "";
      const combined = [headline, interpretation].filter(Boolean).join(" — ");
      return combined.length > 0 ? combined : null;
    }
  }
  return null;
}

function buildBrandTruth(knowledge: Record<string, unknown> | null): string {
  const parts: string[] = [];
  const exec = typeof knowledge?.executive_reading === "string" ? knowledge.executive_reading.trim() : "";
  const curator = typeof knowledge?.curator_reading === "string" ? knowledge.curator_reading.trim() : "";
  if (exec) parts.push(exec);
  else if (curator) parts.push(curator);
  const idSec = sectionInterpretation(knowledge, "identity");
  if (idSec) parts.push(idSec);
  const line = [...new Set(parts)].join(" | ");
  return sanitizeBrandDnaText(
    line ||
      "Verdad de marca: derivar de identidad y propuesta en la base activa (sin clichés de categoría).",
    340,
  );
}

function buildDesiredEffect(
  knowledge: Record<string, unknown> | null,
  brief: BrainstormerWorkingBrief | null | undefined,
): string {
  if (brief?.confirmed_conceptual_umbrella.trim()) {
    return clip(
      `«${brief.confirmed_conceptual_umbrella.trim()}» = deseo inesperado: no entras por necesidad racional; de pronto quieres algo que no buscabas.`,
      280,
    );
  }
  const vp = sectionInterpretation(knowledge, "value_proposition");
  const sanitized = vp ? sanitizeBrandDnaText(vp, 200) : "";
  if (/no sab[ií]as|deseo inesperado|mundano/i.test(sanitized)) {
    return clip(
      `${sanitized} Efecto: deseo inesperado (no narrativa de descubrimiento genérico).`,
      280,
    );
  }
  return "Efecto deseado: deseo inesperado — querer algo mundano sin haberlo buscado (no claim de curiosidad/aventura).";
}

function buildDifferentiatedValue(knowledge: Record<string, unknown> | null): string {
  const points: string[] = [];
  const diffSec = sectionInterpretation(knowledge, "differentiators");
  if (diffSec) points.push(sanitizeBrandDnaText(diffSec, 140));
  const fh = asRecord(knowledge?.final_highlights);
  const strengths = fh?.key_strengths;
  if (Array.isArray(strengths)) {
    for (const s of strengths) {
      if (typeof s === "string" && s.trim()) points.push(sanitizeBrandDnaText(s.trim(), 120));
    }
  }
  const unique = [...new Set(points.filter(Boolean))].slice(0, 3);
  return unique.length > 0 ? unique.join("; ") : "(derivar de diferenciadores en base)";
}

function buildAudience(knowledge: Record<string, unknown> | null): string {
  const aud = sectionInterpretation(knowledge, "audiences");
  return sanitizeBrandDnaText(aud ?? "(derivar de audiencias en base)", 180);
}

function buildTone(
  knowledge: Record<string, unknown> | null,
  limbic: Record<string, unknown> | null,
): string {
  const parts: string[] = [];
  const voice = sectionInterpretation(knowledge, "voice_tone");
  if (voice) parts.push(sanitizeBrandDnaText(voice, 160));
  const sym = typeof limbic?.symbolic_reading === "string" ? limbic.symbolic_reading.trim() : "";
  if (sym) parts.push(sanitizeBrandDnaText(sym, 160));
  return clip(parts.join(" | ") || "Tono: directo, irónico, sin épica de aventura.", 200);
}

function buildEvidenceAllowed(knowledge: Record<string, unknown> | null): string {
  const signals = extractDetectedBrandSignalsFromPayloads(knowledge, null);
  const items = signals.credibility_assets
    .filter((c) => c.length > 8)
    .filter(
      (c) =>
        c.length > 35 ||
        /años|experiencia|reputación|autoridad|columnista|premio|caso|gremio|industria/i.test(c),
    )
    .slice(0, 5)
    .map((c) => sanitizeBrandDnaText(c, 100));
  if (items.length === 0) return "Solo pruebas ya en la base; no inventar casos ni cifras.";
  return clip(items.join("; "), 240);
}

function buildStrategicGuardrails(knowledge: Record<string, unknown> | null): string {
  const parts: string[] = [];
  const restr =
    typeof knowledge?.restrictions_and_alerts === "string"
      ? sanitizeBrandDnaText(knowledge.restrictions_and_alerts, 200)
      : "";
  if (restr) parts.push(restr);
  const fh = asRecord(knowledge?.final_highlights);
  const tensions = fh?.strategic_tensions;
  if (Array.isArray(tensions)) {
    for (const t of tensions.slice(0, 2)) {
      if (typeof t === "string" && t.trim()) {
        parts.push(`Tensión (insumo interno): ${sanitizeBrandDnaText(t.trim(), 120)}`);
      }
    }
  }
  const line =
    parts.length > 0
      ? parts.join(" | ")
      : "Respetar límites de la base; tensiones = insumo, no copy público.";
  return clip(line, 240);
}

function buildConversionMechanism(knowledge: Record<string, unknown> | null): string {
  const diff = sectionInterpretation(knowledge, "differentiators");
  const offerArch = asRecord(knowledge?.offer_architecture);
  const summary =
    typeof offerArch?.offer_summary === "string"
      ? sanitizeBrandDnaText(offerArch.offer_summary, 120)
      : "";
  const hints = [diff, summary].filter(Boolean).join("; ");
  if (/producto falso|landing|CTA|compra|e-?commerce/i.test(hints)) {
    return clip(
      `${hints} Mecanismo: gancho creativo o producto falso → deseo inesperado → producto real → landing → CTA → compra.`,
      260,
    );
  }
  return "Gancho creativo o producto falso → deseo inesperado → producto real → landing → CTA → compra.";
}

function buildWeakTerritories(
  brief: BrainstormerWorkingBrief | null | undefined,
): string {
  const rejected = (brief?.rejected_paths ?? [])
    .slice(-2)
    .map((r) => sanitizeBrandDnaText(r, 50))
    .filter(Boolean);
  const base = `Evitar ${BRAND_DNA_WEAK_TERRITORY_FAMILY_ES}.`;
  if (rejected.length === 0) return base;
  return clip(`${base} Rechazado en sesión: ${rejected.join("; ")}.`, 200);
}

function buildApprovedSessionDecisions(brief: BrainstormerWorkingBrief | null | undefined): string {
  if (!brief) return "(ninguna aún)";
  const parts: string[] = [];
  if (brief.confirmed_conceptual_umbrella.trim()) {
    parts.push(`paraguas: ${brief.confirmed_conceptual_umbrella.trim()}`);
  }
  if (brief.confirmed_decisions.length) {
    parts.push(`decisiones: ${brief.confirmed_decisions.slice(-3).join(" | ")}`);
  }
  if (brief.campaign_stage !== "unknown") {
    parts.push(`etapa: ${brief.campaign_stage}`);
  }
  if (brief.conversion_bridge.trim()) {
    parts.push(`puente: ${clip(brief.conversion_bridge, 100)}`);
  }
  return parts.length > 0 ? clip(parts.join("; "), 280) : "(ninguna aún)";
}

export function buildBrandDnaFields(
  args: BuildBrandDnaForBrainstormerArgs,
): BrandDnaForBrainstormerFields {
  const knowledge = args.knowledge_payload;
  const limbic = args.limbic_payload;
  return {
    brand_truth: buildBrandTruth(knowledge),
    desired_effect: buildDesiredEffect(knowledge, args.working_brief),
    differentiated_value: buildDifferentiatedValue(knowledge),
    audience: buildAudience(knowledge),
    tone: buildTone(knowledge, limbic),
    evidence_allowed: buildEvidenceAllowed(knowledge),
    strategic_guardrails: buildStrategicGuardrails(knowledge),
    weak_territories_to_avoid: buildWeakTerritories(args.working_brief),
    conversion_mechanism: buildConversionMechanism(knowledge),
    approved_session_decisions: buildApprovedSessionDecisions(args.working_brief),
  };
}

function formatDnaLines(fields: BrandDnaForBrainstormerFields): string[] {
  return [
    `${BRAND_DNA_PROMPT_HEADER}`,
    "Fuente: Base de Marca activa + Base Límbica (resumen operativo; no inventar pruebas).",
    `brand_truth: ${fields.brand_truth}`,
    `desired_effect: ${fields.desired_effect}`,
    `differentiated_value: ${fields.differentiated_value}`,
    `audience: ${fields.audience}`,
    `tone: ${fields.tone}`,
    `evidence_allowed: ${fields.evidence_allowed}`,
    `strategic_guardrails: ${fields.strategic_guardrails}`,
    `weak_territories_to_avoid: ${fields.weak_territories_to_avoid}`,
    `conversion_mechanism: ${fields.conversion_mechanism}`,
    `approved_session_decisions: ${fields.approved_session_decisions}`,
  ];
}

function truncateBlockToMax(lines: string[], maxChars: number): { text: string; truncated: boolean } {
  const full = lines.join("\n");
  if (full.length <= maxChars) return { text: full, truncated: false };

  const header = lines.slice(0, 2);
  const fieldLines = lines.slice(2);
  let budget = maxChars - header.join("\n").length - 1;
  const kept: string[] = [];
  for (const line of fieldLines) {
    if (budget <= 20) break;
    if (line.length <= budget) {
      kept.push(line);
      budget -= line.length + 1;
    } else {
      kept.push(`${line.slice(0, Math.max(0, budget - 1))}…`);
      budget = 0;
    }
  }
  return { text: [...header, ...kept].join("\n"), truncated: true };
}

export function buildBrandDnaForBrainstormer(
  args: BuildBrandDnaForBrainstormerArgs,
  maxChars: number = BRAINSTORMER_BRAND_DNA_MAX_CHARS,
): BuildBrandDnaForBrainstormerResult {
  const fields = buildBrandDnaFields(args);
  const { text, truncated } = truncateBlockToMax(formatDnaLines(fields), maxChars);
  return {
    fields,
    block: text,
    character_count: text.length,
    truncated_to_fit: truncated,
  };
}

/** Comprueba si el bloque DNA contiene frases cliché literales (tests / auditoría). */
export function brandDnaContainsLiteralClichePhrases(block: string): boolean {
  const lower = block.toLowerCase();
  return (
    lower.includes("descubre lo inesperado") ||
    lower.includes("explora lo extraordinario") ||
    lower.includes("viaje de descubrimiento") ||
    lower.includes("aventura de lo extraordinario") ||
    lower.includes("momentos mágicos") ||
    lower.includes("momentos magicos") ||
    lower.includes("experiencia única") ||
    lower.includes("experiencia unica")
  );
}
