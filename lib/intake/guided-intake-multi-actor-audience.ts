import type { AudienceRecommendationPendingV1 } from "@/lib/intake/orchestrator";
import { detectStrategicHelpOrHowToRequest } from "@/lib/intake/conversational-engine/strategic-help-request";

/** Roles for ranking and copy only; not exposed as API fields. */
export type ActorAudienceRole =
  | "experiencer"
  | "payer"
  | "decision_maker"
  | "authorizer"
  | "organizer"
  | "influencer"
  | "blocker"
  | "enabler"
  | "funder"
  | "beneficiary"
  | "user"
  | "buyer"
  | "recommender";

export type ClassifiedActor = {
  label: string;
  roles: ActorAudienceRole[];
};

export type ResolvedAudienceStrategicTurn = {
  interviewer_message: string;
  /** When null, the only surface question is inside `interviewer_message` (one-question-at-a-time). */
  next_question: string | null;
  suggested_chips: string[];
  audience_recommendation_pending: AudienceRecommendationPendingV1 | null;
};

const BANNED_STANDALONE_ACTOR_PHRASES =
  /\b(equipos internos|consumidores finales|usuarios generales|público amplio|el público en general|todo el mundo)\b/i;

const NON_AUDIENCE_LINE_LEX = /problema|reto|objetivo|evidencia|dato|mercado abstracto/i;

/** Single-token or short phrase topics / mechanisms — not people/institutions as audiences. */
const NON_ACTOR_TOPIC_RE =
  /^(subsidios?|seguridad|confianza|financiaci[oó]n|m[aá]s ventas|mejor experiencia|experiencia|ventas|incentivos?|presupuesto abstracto|transparencia|innovaci[oó]n|servicio|servicios)$/i;

const OPINION_OR_REQUEST_RE =
  /\b(opinas|recomendarías|recomiendas|sugieres|harías|me recomiendas|qué opinas|qué me recomiendas|a quién me recomendarías|cuál me recomiendas|qué me sugieres|tú qué harías|qué ves mejor|te parece|crees que|recomi[eé]nd(ame|anos|emos|arías)|tengo dudas|muchas dudas|tengo una duda|no estoy seguro|no estoy segura)\b/i;

const HEDGE_LEADING =
  /^(creería\s+que|yo\s+creo\s+que|pienso\s+que|me\s+parece\s+que|considero\s+que|(?:yo\s+)?dir[ií]a\s+que|diria\s+que|supongo\s+que)\s+/i;

const TAIL_QUESTION_OR_REQUEST =
  /[,.\s]*\b(tú\s+qué\s+opinas|qué\s+opinas|qué\s+me\s+recomiendas|a\s+quién\s+me\s+recomendarías|cuál\s+me\s+recomiendas|qué\s+me\s+sugieres|tú\s+qué\s+harías|qué\s+ves\s+mejor)\??\s*$/i;

const PURPOSE_OR_REASON_IN_LABEL =
  /\b(para\s+que|porque|con\s+el\s+fin\s+de|ya\s+que|me\s+parece\s+que|creería\s+que)\b/i;

const MAX_ACTOR_LABEL_CHARS = 44;
const MAX_ACTOR_WORDS = 6;

const ROLE_LEXICON: { role: ActorAudienceRole; re: RegExp }[] = [
  {
    role: "organizer",
    re: /\b(colegios?|escuelas?|instituci[oó]n|gobierno|ayuntamiento|patrocinadores?|sponsors?|organizadores?|eventos?|ferias?|retailers?)\b/i,
  },
  { role: "funder", re: /\b(patrocinadores?|donantes?|subvenci[oó]n|financiador)\b/i },
  { role: "payer", re: /\b(pagan?|pago|presupuesto|financi|comprador|compradores?|aseguradoras?)\b/i },
  { role: "authorizer", re: /\b(autoriz|permiso|aprueb|validaci[oó]n|compliance|visto bueno)\b/i },
  {
    role: "experiencer",
    re: /\b(asistentes?|pacientes?|beneficiarios?|adolescentes?|estudiantes?|hijos|menores|p[úu]blico asistente|finalistas?)\b/i,
  },
  { role: "user", re: /\busuarios?\s+del\b/i },
  { role: "buyer", re: /\b(compradores?|gerentes?\s+comerciales|adquisiciones)\b/i },
  { role: "recommender", re: /\b(médicos?|medicos?|recomiendan?|prescriptores?)\b/i },
  { role: "enabler", re: /\b(gerentes?|equipo(s)? de ventas|operaciones|implementaci[oó]n)\b/i },
  { role: "decision_maker", re: /\b(directores?|direcci[oó]n|comit[eé]|tomadores? de decisi[oó]n)\b/i },
  { role: "influencer", re: /\b(influenc|referentes?)\b/i },
  { role: "blocker", re: /\b(veto|bloquea|resistencia|oposici[oó]n)\b/i },
  { role: "beneficiary", re: /\b(beneficiarios?)\b/i },
];

const ROLE_PRIORITY: Record<ActorAudienceRole, number> = {
  organizer: 5,
  authorizer: 5,
  payer: 4,
  funder: 4,
  enabler: 4,
  decision_maker: 4,
  buyer: 4,
  recommender: 3,
  influencer: 3,
  user: 3,
  experiencer: 2,
  beneficiary: 2,
  blocker: 0,
};

const ROLE_LABEL_ES: Record<ActorAudienceRole, string> = {
  experiencer: "quienes viven la experiencia o el uso",
  payer: "quienes pagan o financian",
  decision_maker: "quienes deciden la compra o el avance",
  authorizer: "quienes autorizan o validan",
  organizer: "quienes organizan, habilitan volumen o canal",
  influencer: "quienes influyen en la decisión",
  blocker: "posibles vetos o fricción",
  enabler: "quienes habilitan operación o adopción interna",
  funder: "quienes aportan recursos o financiamiento",
  beneficiary: "quienes reciben el beneficio directo",
  user: "quienes usan la herramienta o el servicio en el día a día",
  buyer: "quienes compran o formalizan la adquisición",
  recommender: "quienes recomiendan o validan profesionalmente",
};

const AMBIGUOUS_ACTOR_RES: RegExp[] = [
  /\b(los|las)\s+señores?\b/i,
  /\bseñores?\b/i,
  /\bla gente\b/i,
  /\bellos\b/i,
  /\b(los|las)\s+usuarios\b(?! del\b)/i,
  /\bla comunidad\b/i,
  /\b(los|las)\s+j[oó]venes?\b/i,
  /\bpersonas interesadas\b/i,
  /\bpúblico general\b/i,
  /\bpublico general\b/i,
  /\btodos\b/i,
  /\b(los|las)\s+clientes\b(?!\s+de\s+)/i,
];

function naturalActorLabel(normalizedLower: string): string {
  return normalizedLower.replace(/\s+/g, " ").trim().toLowerCase();
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function isAmbiguousActorLabel(label: string): boolean {
  const t = label.toLowerCase();
  return AMBIGUOUS_ACTOR_RES.some((re) => re.test(t));
}

function isValidActorCandidate(normalizedLower: string): boolean {
  const t = normalizedLower.trim().toLowerCase();
  if (t.length < 3 || t.length > MAX_ACTOR_LABEL_CHARS) return false;
  if (/\?/.test(t)) return false;
  if (OPINION_OR_REQUEST_RE.test(t)) return false;
  if (PURPOSE_OR_REASON_IN_LABEL.test(t)) return false;
  if (NON_ACTOR_TOPIC_RE.test(t)) return false;
  if (BANNED_STANDALONE_ACTOR_PHRASES.test(t)) return false;
  if (wordCount(t) > MAX_ACTOR_WORDS) return false;
  if (/^¿/.test(t)) return false;
  if (/^\s*pero\b/i.test(t)) return false;
  if (/^que\s+(son|son las|son los|están|estan|hacen)\b/i.test(t)) return false;
  if (/\b(recomi[eé]nd|recomend)\w*\b/i.test(t)) return false;
  if (/\bdudas?\b/i.test(t)) return false;
  /** Reject clause-like spans (“los X usan Y …”) mistaken for audience labels. */
  if (
    wordCount(t) >= 4 &&
    /\b(usar|usan|recomiendan|recomienda|autorizan|autoriza|deciden|decide|organizan|organiza)\b/i.test(t)
  ) {
    return false;
  }
  if (/\b(viajan|viaja|necesitan|deben)\s+\w+\b/i.test(t) && wordCount(t) <= 5) return false;
  if (/\bviajes\b/i.test(t) && !/\bviajeros?\b/i.test(t)) return false;
  if (/^(casa|casas|hogar|día|dia|ahora|hoy)$/i.test(t)) return false;
  return true;
}

function stripLeadingArticles(s: string): string {
  return s.replace(/^(a|al|para|con|de)\s+(los|las|el|la)\s+/i, "").trim();
}

function stripPorqueClause(s: string): string {
  return s.replace(/\s+porque\b[\s\S]*$/i, "").trim();
}

function stripPurposeClause(s: string): string {
  return s.replace(/\s+para\s+que\b[\s\S]*$/i, "").trim();
}

function stripTrailingMetaPeroClause(s: string): string {
  const m = s.match(/\s*,?\s*pero\b([\s\S]*)$/i);
  if (!m) return s;
  const tail = (m[1] ?? "").trim().toLowerCase();
  /** Keep factual contrast (“…, pero los médicos…”) — only drop meta tails (“pero recomiéndame”). */
  if (/^(los|las|el|la|un|una|unos|unas)\b/u.test(tail)) return s;
  if (
    /\b(recomi|dudas|opinas|sugieres|crees|ay[uú]dame|no estoy seguro|no estoy segura|qu[eé]\s+me\s+recomiendas)\b/i.test(
      tail,
    )
  ) {
    return s.replace(/\s*,?\s*pero\b[\s\S]*$/i, "").trim();
  }
  return s;
}

function preprocessLine(line: string): string {
  let s = line.trim();
  s = stripTrailingMetaPeroClause(s);
  s = s.replace(TAIL_QUESTION_OR_REQUEST, "").trim();
  s = s.replace(HEDGE_LEADING, "").trim();
  s = s.replace(/^\s*¿+\s*/, "").trim();
  return s;
}

function normalizeCore(s: string): string {
  let t = s.replace(/\s+/g, " ").trim().toLowerCase();
  t = t.replace(/^y\s+(?=[a-záéíóúñ])/i, "").trim();
  t = t.replace(/\b(también|tampoco)\b\s+/gi, "").trim();
  t = stripPurposeClause(stripPorqueClause(t));
  t = stripLeadingArticles(t);
  return t.trim();
}

function classifyRolesForPhrase(phraseLower: string): ActorAudienceRole[] {
  const roles = new Set<ActorAudienceRole>();
  for (const { role, re } of ROLE_LEXICON) {
    if (re.test(phraseLower)) roles.add(role);
  }
  return [...roles];
}

function enrichRolesFromBlob(actor: ClassifiedActor, blobLower: string): ClassifiedActor {
  const label = actor.label.toLowerCase();
  const roles = new Set(actor.roles);
  if (/\b(padres|madres|mamás|papás)\b/.test(label)) {
    if (/autoriz|permiso|aprueb|validar|confianza/.test(blobLower)) roles.add("authorizer");
    if (/pagan|pago|financi/.test(blobLower)) roles.add("payer");
  }
  if (/\b(adolescentes|estudiantes|menores|hijos)\b/.test(label)) {
    roles.add("experiencer");
  }
  if (/\b(gerentes|directores?|comit[eé])\b/.test(label)) {
    roles.add("decision_maker");
  }
  if (/\b(médicos?|medicos?)\b/.test(label) && /recomiendan?/.test(blobLower)) {
    roles.add("recommender");
  }
  if (/\b(pacientes?)\b/.test(label)) {
    roles.add("experiencer");
    roles.add("user");
  }
  if (/\b(aseguradoras?)\b/.test(label)) {
    roles.add("authorizer");
    roles.add("payer");
  }
  return { label: actor.label, roles: [...roles] };
}

function scoreActor(actor: ClassifiedActor, blobLower: string): number {
  let s = 0;
  for (const r of actor.roles) s += ROLE_PRIORITY[r];
  if (/volumen|mayor|escala|institucional|contrat|grandes/.test(blobLower) && actor.roles.includes("organizer")) {
    s += 2;
  }
  if (
    actor.roles.includes("organizer") &&
    /grandes|volumen|mayor|escala|institucional/.test(blobLower)
  ) {
    s += 4;
  }
  if (/confianza|autoriz|seguridad|validar|permiso|tranquilidad/.test(blobLower)) {
    if (actor.roles.includes("authorizer") || actor.roles.includes("payer")) s += 2;
  }
  if (/deseo|engagement|experiencia|diversi[oó]n/.test(blobLower) && actor.roles.includes("experiencer")) {
    s += 1;
  }
  if (actor.roles.length === 1 && actor.roles[0] === "experiencer") {
    s -= 3;
  }
  return s;
}

const PRIMARY_TIEBREAK_ORDER: ActorAudienceRole[] = [
  "organizer",
  "funder",
  "enabler",
  "authorizer",
  "payer",
  "buyer",
  "decision_maker",
  "recommender",
  "influencer",
  "user",
  "beneficiary",
  "experiencer",
  "blocker",
];

function tieBreakPrimary(a: ClassifiedActor, b: ClassifiedActor): number {
  const ra = PRIMARY_TIEBREAK_ORDER.findIndex((r) => a.roles.includes(r));
  const rb = PRIMARY_TIEBREAK_ORDER.findIndex((r) => b.roles.includes(r));
  const xa = ra === -1 ? 99 : ra;
  const xb = rb === -1 ? 99 : rb;
  return xa - xb;
}

function pickOrdering(actors: ClassifiedActor[], blobLower: string): ClassifiedActor[] {
  return [...actors].sort((a, b) => {
    const sa = scoreActor(a, blobLower);
    const sb = scoreActor(b, blobLower);
    if (Math.abs(sa - sb) > 2) return sb - sa;
    const t = tieBreakPrimary(a, b);
    if (t !== 0) return t;
    return sb - sa;
  });
}

function dedupeLabels(labels: string[]): string[] {
  const norm = [...new Set(labels.map((x) => x.toLowerCase().trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  const kept: string[] = [];
  for (const p of norm) {
    const subsumedIdx = kept.findIndex((k) => p.includes(k) && k !== p);
    if (subsumedIdx >= 0) kept.splice(subsumedIdx, 1);
    if (kept.some((k) => k.includes(p) && k !== p)) continue;
    kept.push(p);
  }
  return kept;
}

export type ExtractActorsResult = {
  clean: ClassifiedActor[];
  ambiguous: string[];
};

/** Help, doubt, or recommendation-in-the-same-line: do not mine prior trace lines for actors. */
/** Narrative fields already captured in strategic_base — safe nominal mining on guidance turns (excludes the live user line). */
export function confirmedStrategicActorContext(strategicBase: Record<string, unknown>): string {
  const prob =
    typeof strategicBase.problem_description_optional === "string"
      ? strategicBase.problem_description_optional.trim()
      : "";
  const desc =
    typeof strategicBase.simple_description === "string"
      ? strategicBase.simple_description.trim()
      : "";
  return [desc, prob].filter(Boolean).join("\n");
}

export function isAudienceGuidanceSeekingTurn(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 6) return false;
  if (detectStrategicHelpOrHowToRequest(t)) return true;
  if (/\b(tengo dudas|muchas dudas|tengo una duda|no estoy seguro|no estoy segura)\b/i.test(t)) {
    return true;
  }
  if (/\brecomi[eé]nd(ame|anos|emos|arías|aciones)\b/i.test(t)) return true;
  return false;
}

function actorSourceText(params: {
  userText: string;
  traceUserTurns: { role: string; summary: string }[];
  strategicBase?: Record<string, unknown>;
}): string {
  const { userText, traceUserTurns, strategicBase } = params;
  if (isAudienceGuidanceSeekingTurn(userText)) {
    let s = userText.trim();
    s = (s.split(/\s*,\s*pero\b/i)[0] ?? s).trim();
    s = (s.split(/\s+pero\s+/i)[0] ?? s).trim();
    const confirmed = strategicBase ? confirmedStrategicActorContext(strategicBase) : "";
    if (confirmed.length > 0) return `${s}\n${confirmed}`.trim();
    return s;
  }
  const userLines = traceUserTurns
    .filter((t) => t.role === "user")
    .slice(-6)
    .map((t) => t.summary)
    .join("\n");
  return `${userLines}\n${userText}`.trim();
}

/**
 * Extracts clean audience labels and ambiguous spans from user/trace text.
 * Does not title-case; labels are lowercase for natural rendering.
 */
export function extractActorsForAudienceRecommendation(
  sourceOriginal: string,
  blobLower: string,
): ExtractActorsResult {
  const rawClean: string[] = [];
  const ambiguous: string[] = [];
  const lines = sourceOriginal.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const pushCandidate = (raw: string) => {
    const core = normalizeCore(raw);
    if (!core || !isValidActorCandidate(core)) return;
    if (isAmbiguousActorLabel(core)) {
      if (!ambiguous.includes(core)) ambiguous.push(core);
      return;
    }
    rawClean.push(core);
  };

  for (const line of lines) {
    if (/^\s*¿/.test(line) && line.length < 80 && OPINION_OR_REQUEST_RE.test(line.toLowerCase())) {
      continue;
    }
    const pre = preprocessLine(line);
    if (!pre || OPINION_OR_REQUEST_RE.test(pre)) continue;
    const lower = pre.toLowerCase();
    if (NON_AUDIENCE_LINE_LEX.test(lower) && !/\b(gobierno|padres|colegios|pacientes|médicos)\b/i.test(lower)) {
      continue;
    }

    const reAlInstitución =
      /\bal\s+((?:[^\s,.;!?…]+\s+){0,4}[^\s,.;!?…]+)(?=\s+y\s+también\s+a\s+(?:los|las|el|la)\s+|\s+y\s+a\s+(?:los|las|el|la)\s+|,\s*y\s+|\s*$)/gi;
    const reAdaLosNp =
      /\b(?:a|para)\s+(?:los|las|el|la)\s+((?:[^\s,.;!?…]+\s+){0,5}[^\s,.;!?…]+)(?=\s+y\s+también\s+a\s+(?:los|las|el|la)\s+|\s+y\s+a\s+(?:los|las|el|la)\s+|,\s*y\s+|\s*$)/gi;
    let m: RegExpExecArray | null;
    while ((m = reAlInstitución.exec(lower)) !== null) {
      pushCandidate(m[1]!);
    }
    while ((m = reAdaLosNp.exec(lower)) !== null) {
      pushCandidate(m[1]!);
    }

    const yTambien =
      /\s+y\s+también\s+a\s+(?:los|las|el|la)\s+((?:[^\s,.;!?…]+\s+){0,5}[^\s,.;!?…]+)/gi;
    while ((m = yTambien.exec(lower)) !== null) {
      pushCandidate(m[1]!);
    }

    const commaY = /,\s*y\s+((?:[^\s,.;!?…]+\s+){0,5}[^\s,.;!?…]+)/gi;
    while ((m = commaY.exec(lower)) !== null) {
      pushCandidate(m[1]!);
    }

    const commaParts = pre.split(",").map((p) => p.trim()).filter((p) => p.length >= 4);
    if (commaParts.length >= 2) {
      for (const c of commaParts) {
        let cLow = c.toLowerCase().trim();
        if (/^y\s+/i.test(cLow)) cLow = cLow.replace(/^y\s+/i, "").trim();
        cLow = stripPorqueClause(stripPurposeClause(cLow));
        cLow = stripLeadingArticles(cLow);
        if (!cLow || /^porque\b/i.test(cLow)) continue;
        if (NON_AUDIENCE_LINE_LEX.test(cLow)) continue;
        pushCandidate(cLow);
      }
    }

    const simpleY = /^(.{4,42})\s+y\s+(.{4,42})\.?$/i;
    const sm = lower.match(simpleY);
    if (sm && !/porque|para que/.test(lower) && commaParts.length < 2) {
      pushCandidate(sm[1]!);
      pushCandidate(sm[2]!);
    }

    const reLosLasNp = /\b(los|las)\s+([\wáéíóúñ]{4,22})\b/g;
    const verbSoon =
      /(?:\s+\w+){0,6}\s+(usan|usan el|recomiendan|autorizan|autoriz|deciden|pagan|arman|organiz|viven|tienen|son|van|necesitan)\b/i;
    while ((m = reLosLasNp.exec(lower)) !== null) {
      const tail = lower.slice(m.index + m[0].length, m.index + m[0].length + 48);
      if (!verbSoon.test(tail)) continue;
      pushCandidate(`${m[1]} ${m[2]}`.trim().toLowerCase());
    }
  }

  const deduped = dedupeLabels(rawClean);
  const clean: ClassifiedActor[] = deduped.map((label) => {
    const display = naturalActorLabel(label);
    const roles = classifyRolesForPhrase(display);
    return enrichRolesFromBlob({ label: display, roles }, blobLower);
  });

  return { clean, ambiguous: [...new Set(ambiguous.map((a) => naturalActorLabel(a)))] };
}

/** @deprecated use extractActorsForAudienceRecommendation */
export function extractClassifiedActorsFromText(
  sourceOriginal: string,
  blobLower: string,
): ClassifiedActor[] {
  return extractActorsForAudienceRecommendation(sourceOriginal, blobLower).clean;
}

export function detectMultiActorRecommendationContext(
  userText: string,
  traceUserTurns: { role: string; summary: string }[],
  strategicBaseLowerBlob: string,
  strategicBase?: Record<string, unknown>,
): boolean {
  const source = actorSourceText({ userText, traceUserTurns, strategicBase });
  const blobLower = `${source.toLowerCase()}\n${strategicBaseLowerBlob}`.toLowerCase();
  const { clean, ambiguous } = extractActorsForAudienceRecommendation(source, blobLower);
  return clean.length >= 2 && ambiguous.length === 0;
}

function formatRoles(actor: ClassifiedActor): string {
  if (actor.roles.length === 0) return "un rol que habría que afinar con más contexto";
  return actor.roles.map((r) => ROLE_LABEL_ES[r]).join("; ");
}

function buildDescriptionDraft(
  ordered: ClassifiedActor[],
  primary: ClassifiedActor,
  secondary: ClassifiedActor,
): string {
  const others = ordered.filter((a) => a.label !== primary.label && a.label !== secondary.label);
  const tail =
    others.length > 0
      ? ` Otros actores mencionados (${others.map((o) => o.label).join(", ")}): conviene darles capas de mensaje acorde a su rol, sin mezclar promesas incompatibles.`
      : "";
  return (
    `Prioridad principal (${primary.label}): comunicación orientada a ${formatRoles(primary)}. ` +
    `Audiencia clave complementaria (${secondary.label}): ${formatRoles(secondary)}.${tail}`
  );
}

function inferAudienceTypeHint(actors: ClassifiedActor[]): "b2b" | "b2c" | "mixed" {
  const has = (r: ActorAudienceRole) => actors.some((a) => a.roles.includes(r));
  const b2bStrong =
    has("organizer") ||
    has("enabler") ||
    has("decision_maker") ||
    has("buyer") ||
    has("funder");
  const consumerish =
    (has("experiencer") || has("user") || has("beneficiary")) &&
    (has("payer") || has("authorizer"));
  if (b2bStrong && consumerish) return "mixed";
  if (consumerish && !b2bStrong) return "b2c";
  if (b2bStrong) return "b2b";
  return "mixed";
}

export type ProvisionalAudienceRecommendation = {
  interviewer_message: string;
  pending: AudienceRecommendationPendingV1;
};

export function buildProvisionalAudienceRecommendation(params: {
  userText: string;
  traceUserTurns: { role: string; summary: string }[];
  strategicBaseLowerBlob: string;
  strategicBase?: Record<string, unknown>;
}): ProvisionalAudienceRecommendation | null {
  const { userText, traceUserTurns, strategicBaseLowerBlob, strategicBase } = params;
  const source = actorSourceText({ userText, traceUserTurns, strategicBase });
  const blobLower = `${source.toLowerCase()}\n${strategicBaseLowerBlob}`.toLowerCase();

  const { clean: actors, ambiguous } = extractActorsForAudienceRecommendation(source, blobLower);
  if (ambiguous.length > 0) return null;
  if (actors.length < 2) return null;

  const ordered = pickOrdering(actors, blobLower);
  const primary = ordered[0]!;
  const secondary = ordered[1]!;
  const tertiary = ordered[2];

  const lines: string[] = [];
  lines.push(
    "Con la información que tenemos hasta ahora, mi recomendación provisional (no es pieza final de comunicación) sería:",
    "",
  );

  lines.push(
    `– Prioridad principal "${primary.label}": suele concentrar autorización, confianza o pago cuando ese rol aparece en lo ya contado.`,
    `– Capa complementaria "${secondary.label}": suele asociarse a deseo, uso o vivencia cuando convive con la primera.`,
    "",
    "No invento actores nuevos: solo ordeno y aclaro capas con lo que ya está en tu respuesta y en el contexto confirmado hasta aquí.",
    "",
    `¿Lo dejamos así: "${primary.label}" como foco principal de mensaje y "${secondary.label}" como segunda capa, sin mezclar promesas incompatibles?`,
  );
  if (tertiary) {
    lines.push(
      "",
      `Si también quieres dar peso explícito a "${tertiary.label}", lo alineamos en el tono sin contradecir lo que le prometes al foco principal.`,
    );
  }

  const interviewer_message = lines.join("\n").trim();

  const audience_description_draft = buildDescriptionDraft(ordered, primary, secondary);
  const audience_type_hint = inferAudienceTypeHint(actors);

  const pending: AudienceRecommendationPendingV1 = {
    version: 1,
    primary_label: primary.label,
    secondary_label: secondary.label,
    ...(tertiary ? { tertiary_label: tertiary.label } : {}),
    audience_description_draft,
    audience_type_hint,
  };

  return { interviewer_message, pending };
}

function buildAmbiguousClarificationCopy(params: {
  cleanActors: ClassifiedActor[];
  ambiguousLabels: string[];
}): { interviewer_message: string } {
  const { cleanActors, ambiguousLabels } = params;
  const ambQuoted = ambiguousLabels.map((a) => `"${a}"`).join(" y ");
  let intro =
    "Con la información que tenemos hasta ahora, conviene afinar a quién(es) apunta la comunicación antes de cerrar una prioridad.";
  if (cleanActors.length > 0) {
    const c0 = cleanActors[0]!;
    intro = `Con la información que tenemos hasta ahora, ${c0.label} parece un actor clave porque podría habilitar, financiar o legitimar la iniciativa en función de lo que comentaste.`;
  }
  const body =
    ambiguousLabels.length === 1
      ? `Cuando dices ${ambQuoted}, necesito precisar a quién te refieres: ¿adultos mayores, beneficiarios, líderes comunitarios, usuarios del servicio u otro grupo?`
      : `Pero necesito aclarar a quién te refieres con ${ambQuoted} antes de guardar una recomendación de audiencia. ¿Puedes nombrar cada grupo con una etiqueta concreta (por ejemplo “beneficiarios”, “adultos mayores”, “líderes comunitarios”)?`;
  const interviewer_message = `${intro}\n\n${body}`.trim();
  return { interviewer_message };
}

/**
 * Audience step: provisional recommendation (with confirm + pending), ambiguous clarification, or null (caller fallback).
 */
export function resolveAudienceMultiActorStrategicTurn(params: {
  userText: string;
  traceUserTurns: { role: string; summary: string }[];
  strategicBaseLowerBlob: string;
  strategicBase?: Record<string, unknown>;
  bankQuestion: string | null;
}): ResolvedAudienceStrategicTurn | null {
  const { userText, traceUserTurns, strategicBaseLowerBlob, bankQuestion, strategicBase } =
    params;
  const source = actorSourceText({ userText, traceUserTurns, strategicBase });
  const blobLower = `${source.toLowerCase()}\n${strategicBaseLowerBlob}`.toLowerCase();
  const { clean, ambiguous } = extractActorsForAudienceRecommendation(source, blobLower);

  if (ambiguous.length > 0) {
    const { interviewer_message } = buildAmbiguousClarificationCopy({
      cleanActors: clean,
      ambiguousLabels: ambiguous,
    });
    void bankQuestion;
    return {
      interviewer_message,
      next_question: null,
      suggested_chips: [],
      audience_recommendation_pending: null,
    };
  }

  const provisional = buildProvisionalAudienceRecommendation({
    userText,
    traceUserTurns,
    strategicBaseLowerBlob,
    strategicBase,
  });
  if (!provisional) return null;

  const confirmBlock = buildAudienceRecommendationConfirmation(provisional.pending);
  return {
    interviewer_message: `${provisional.interviewer_message}\n\n${confirmBlock}`.trim(),
    next_question: null,
    suggested_chips: [],
    audience_recommendation_pending: provisional.pending,
  };
}

export function buildAudienceRecommendationConfirmation(pending: {
  primary_label: string;
  secondary_label: string;
  tertiary_label?: string;
}): string {
  const t = pending.tertiary_label?.trim();
  if (t && t.length > 0) {
    return `¿Confirmas dejar como prioridad principal a “${pending.primary_label}”, como audiencia clave secundaria a “${pending.secondary_label}” y dar también un rol explícito en el mensaje a “${t}”? Responde en una frase corta (por ejemplo “sí, confirmo” o “no, prefiero otro orden”).`;
  }
  return `¿Confirmas dejar como prioridad principal a “${pending.primary_label}” y como audiencia clave secundaria a “${pending.secondary_label}”? Responde en una frase corta (por ejemplo “sí, confirmo” o “no, prefiero otro orden”).`;
}
