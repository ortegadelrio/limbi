export type BrainstormerDetectedBrandSignals = {
  identity_or_positioning: string[];
  audiences: string[];
  offer_or_roles: string[];
  differentiators: string[];
  credibility_assets: string[];
  tone_or_limbic_cues: string[];
  guardrails: string[];
};

const BRAND_SIGNALS_PREAMBLE_ES =
  "Antes de responder, usa estas señales detectadas de la Base de Marca activa. No son una fuente nueva; son una extracción operativa del JSON consolidado congelado en esta sesión. Detecta la INTENCIÓN del reto (posicionamiento, venta, campaña, contenido, activación) y prioriza las secciones relevantes. En posicionamiento: formula primero una hipótesis estratégica con evidencia de la base; no abras solo con un menú de opciones.";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function clip(s: string, max = 220): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
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

function extractCredibilityAssets(payload: Record<string, unknown> | null): string[] {
  const cred = asRecord(payload?.credibility_architecture);
  if (!cred) return [];
  const keys = [
    "authority_signals",
    "institutional_roles",
    "industry_leadership_assets",
    "founder_credentials",
    "business_ecosystem",
    "reputation_proof_points",
  ] as const;
  const out: string[] = [];
  for (const k of keys) {
    const arr = cred[k];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item === "string" && item.trim()) out.push(clip(item, 160));
      }
    }
  }
  return out.slice(0, 12);
}

function extractOfferOrRoles(payload: Record<string, unknown> | null): string[] {
  const out: string[] = [];
  const offerSec = sectionInterpretation(payload, "offer");
  if (offerSec) out.push(clip(offerSec));
  const offerArch = asRecord(payload?.offer_architecture);
  if (offerArch) {
    const summary = typeof offerArch.offer_summary === "string" ? offerArch.offer_summary.trim() : "";
    if (summary) out.push(clip(summary));
    const catalog = offerArch.service_catalog;
    if (Array.isArray(catalog)) {
      for (const row of catalog) {
        const r = asRecord(row);
        const name = typeof r?.name === "string" ? r.name.trim() : "";
        if (name) out.push(name);
      }
    }
  }
  return [...new Set(out)].slice(0, 12);
}

function extractHighlightsStrengths(payload: Record<string, unknown> | null): string[] {
  const fh = asRecord(payload?.final_highlights);
  if (!fh) return [];
  const strengths = fh.key_strengths;
  if (!Array.isArray(strengths)) return [];
  return strengths
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => clip(s, 140))
    .slice(0, 6);
}

function formatBullets(items: string[], emptyLabel: string): string {
  if (items.length === 0) return `- ${emptyLabel}`;
  return items.map((item) => `- ${item}`).join("\n");
}

/** Territorios de percepción (no catálogo comercial): combina señales existentes sin inventar. */
export function derivePossiblePositioningTerritories(
  signals: BrainstormerDetectedBrandSignals,
  knowledge: Record<string, unknown> | null,
): string[] {
  const offerLower = new Set(signals.offer_or_roles.map((o) => o.toLowerCase().trim()));
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (raw: string) => {
    const t = clip(raw, 140);
    if (t.length < 12) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    if (offerLower.has(key)) return;
    const isOnlyCatalogName = [...offerLower].some(
      (o) => o.length > 2 && o.length < 40 && (key === o || key.includes(o)),
    );
    if (isOnlyCatalogName && t.length < 50) return;
    seen.add(key);
    out.push(t);
  };

  for (const x of signals.identity_or_positioning) add(x);
  for (const x of signals.differentiators) add(x);

  const pillars = knowledge?.strategic_pillars;
  if (Array.isArray(pillars)) {
    for (const p of pillars) {
      const r = asRecord(p);
      const title = typeof r?.title === "string" ? r.title.trim() : "";
      if (title) add(title);
    }
  }

  for (const x of extractHighlightsStrengths(knowledge)) add(x);

  for (const x of signals.credibility_assets) {
    if (x.length > 45 || /años|experiencia|reputación|autoridad|liderazgo|gremio|industria/i.test(x)) {
      add(x);
    }
  }

  for (const x of signals.tone_or_limbic_cues) {
    if (/autoridad|storytelling|liderazgo|reputación|estrateg/i.test(x)) add(x);
  }

  return out.slice(0, 8);
}

/** Activos con nombre propio (ecosistema, marcas, proyectos) para mencionar en posicionamiento sin confundirlos con territorios. */
export function deriveNamedCredibilityAssets(
  signals: BrainstormerDetectedBrandSignals,
): string[] {
  const territories = new Set(
    derivePossiblePositioningTerritories(signals, null).map((t) => t.toLowerCase()),
  );
  return signals.credibility_assets
    .filter((c) => {
      const t = c.trim();
      if (t.length < 2 || t.length > 80) return false;
      if (territories.has(t.toLowerCase())) return false;
      return true;
    })
    .slice(0, 10);
}

/** Extrae señales legibles del JSON consolidado (knowledge + limbic). */
export function extractDetectedBrandSignalsFromPayloads(
  knowledge: Record<string, unknown> | null,
  limbic: Record<string, unknown> | null,
): BrainstormerDetectedBrandSignals {
  const identity: string[] = [];
  const exec = typeof knowledge?.executive_reading === "string" ? knowledge.executive_reading : "";
  const curator =
    typeof knowledge?.curator_reading === "string" ? knowledge.curator_reading : "";
  if (exec.trim()) identity.push(clip(exec));
  else if (curator.trim()) identity.push(clip(curator));
  const idSec = sectionInterpretation(knowledge, "identity");
  if (idSec) identity.push(clip(idSec));
  const vpSec = sectionInterpretation(knowledge, "value_proposition");
  if (vpSec) identity.push(clip(vpSec));
  const pillars = knowledge?.strategic_pillars;
  if (Array.isArray(pillars)) {
    for (const p of pillars) {
      const r = asRecord(p);
      const title = typeof r?.title === "string" ? r.title.trim() : "";
      if (title) identity.push(title);
    }
  }

  const audiences: string[] = [];
  const audSec = sectionInterpretation(knowledge, "audiences");
  if (audSec) audiences.push(clip(audSec));

  const differentiators: string[] = [];
  const diffSec = sectionInterpretation(knowledge, "differentiators");
  if (diffSec) differentiators.push(clip(diffSec));

  const tone: string[] = [];
  const voiceSec = sectionInterpretation(knowledge, "voice_tone");
  if (voiceSec) tone.push(clip(voiceSec));
  if (limbic) {
    const sym = typeof limbic.symbolic_reading === "string" ? limbic.symbolic_reading : "";
    if (sym.trim()) tone.push(clip(sym, 180));
    const atm =
      typeof limbic.atmosphere_and_metaphor === "string" ? limbic.atmosphere_and_metaphor : "";
    if (atm.trim()) tone.push(clip(atm, 140));
  }

  const guardrails: string[] = [];
  const restr =
    typeof knowledge?.restrictions_and_alerts === "string" ? knowledge.restrictions_and_alerts : "";
  if (restr.trim()) guardrails.push(clip(restr));
  const restrSec = sectionInterpretation(knowledge, "restrictions");
  if (restrSec) guardrails.push(clip(restrSec));

  const fh = asRecord(knowledge?.final_highlights);
  const tensions = fh?.strategic_tensions;
  if (Array.isArray(tensions)) {
    for (const t of tensions) {
      if (typeof t === "string" && t.trim()) guardrails.push(clip(`Tensión: ${t}`, 160));
    }
  }

  return {
    identity_or_positioning: identity.slice(0, 8),
    audiences: audiences.slice(0, 6),
    offer_or_roles: extractOfferOrRoles(knowledge),
    differentiators: differentiators.slice(0, 6),
    credibility_assets: extractCredibilityAssets(knowledge),
    tone_or_limbic_cues: tone.slice(0, 6),
    guardrails: guardrails.slice(0, 6),
  };
}

/** Bloque compacto para el prompt de OpenAI (índice operativo sobre el JSON profundo). */
export function formatBrandSignalsFromActiveBaseBlock(
  signals: BrainstormerDetectedBrandSignals,
  knowledge: Record<string, unknown> | null = null,
): string {
  const positioningTerritories = derivePossiblePositioningTerritories(signals, knowledge);
  const namedAssets = deriveNamedCredibilityAssets(signals);

  return `${BRAND_SIGNALS_PREAMBLE_ES}

BRAND_SIGNALS_FROM_ACTIVE_BASE

Narrativa de identidad (base):
${formatBullets(signals.identity_or_positioning, "(ver JSON de conocimiento)")}

Possible positioning territories (derivado de identidad, diferenciadores, credenciales y tono — NO es catálogo de servicios):
${formatBullets(positioningTerritories, "(derivar del JSON; evitar solo nombres de servicios)")}

Audiencias:
${formatBullets(signals.audiences, "(ver JSON de conocimiento)")}

Oferta / roles comerciales (formatos, servicios, catálogo — usar sobre todo en retos de venta, no como única lectura de posicionamiento):
${formatBullets(signals.offer_or_roles, "(ver JSON de conocimiento)")}

Diferenciales distintivos:
${formatBullets(signals.differentiators, "(ver JSON de conocimiento)")}

Credenciales de autoridad (trayectoria, reputación, roles institucionales):
${formatBullets(
    signals.credibility_assets.filter((c) => c.length > 40 || /años|experiencia|reputación|autoridad/i.test(c)),
    "(ver JSON de conocimiento)",
  )}

Activos con nombre propio / ecosistema (mencionar como prueba, no como único eje de posicionamiento):
${formatBullets(namedAssets, "(ver credibilidad / catálogo en JSON)")}

Tono / Base Límbica:
${formatBullets(signals.tone_or_limbic_cues, "(ver JSON límbico)")}

Guardrails / riesgos de percepción (dispersión, temas a evitar):
${formatBullets(signals.guardrails, "(ver JSON de conocimiento)")}`;
}
