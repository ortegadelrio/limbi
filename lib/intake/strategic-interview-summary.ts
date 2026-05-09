import {
  AUDIENCE_TYPE_OPTIONS,
  CHALLENGE_TYPE_OPTIONS,
  NO_CLEAR_EVIDENCE,
  PROBLEM_CATEGORY_OPTIONS,
  TRANSFORMATION_TYPE_OPTIONS,
} from "@/lib/constants/wizard";
import { formatEvidenceTypeSlugsForUserFacingSummary } from "@/lib/intake/evidence-public-labels";
import { readInterviewTrace } from "@/lib/intake/orchestrator";
import { GUIDED_INTAKE_AUDIENCE_PENDING_LIM } from "@/lib/intake/strategic-interview-apply";

export type StrategicInterviewPilotSummary = {
  title: string;
  body: string;
  weakLine: string | null;
};

function readSb(r: Record<string, unknown>): Record<string, unknown> {
  const sb = r.strategic_base;
  if (sb && typeof sb === "object" && !Array.isArray(sb)) {
    return sb as Record<string, unknown>;
  }
  return {};
}

function readAb(r: Record<string, unknown>): Record<string, unknown> {
  const ab = r.audience_base;
  if (ab && typeof ab === "object" && !Array.isArray(ab)) {
    return ab as Record<string, unknown>;
  }
  return {};
}

function readEb(r: Record<string, unknown>): Record<string, unknown> {
  const eb = r.evidence_base;
  if (eb && typeof eb === "object" && !Array.isArray(eb)) {
    return eb as Record<string, unknown>;
  }
  return {};
}

function readLimitations(sb: Record<string, unknown>): string[] {
  const lim = sb.guided_intake_limitations_optional;
  if (!Array.isArray(lim)) return [];
  return lim.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function labelChallenge(challengeType: string | null, other: boolean): string {
  if (other || !challengeType) return "un reto que estás definiendo paso a paso";
  const hit = CHALLENGE_TYPE_OPTIONS.find((o) => o.value === challengeType);
  return hit?.label.toLowerCase() ?? "un reto estratégico";
}

function labelAudience(audienceType: string): string {
  const hit = AUDIENCE_TYPE_OPTIONS.find((o) => o.value === audienceType);
  return hit ? hit.label.toLowerCase() : audienceType;
}

/** Audience slug is usable in closing copy only when user-confirmed, not skipped, and confident enough. */
export function audienceIsCommittedForPilotSummary(
  mergedResponses: Record<string, unknown>,
  confidence: Record<string, number>,
): boolean {
  const trace = readInterviewTrace(mergedResponses);
  const audDecision = trace?.decision_states?.audience;
  if (audDecision?.status && audDecision.status !== "confirmed") {
    return false;
  }
  const ab = readAb(mergedResponses);
  const sb = readSb(mergedResponses);
  const lim = readLimitations(sb);
  const aud =
    typeof ab.audience_type === "string" ? ab.audience_type.trim() : "";
  if (!aud) return false;
  if (
    lim.some((s) => s.includes(GUIDED_INTAKE_AUDIENCE_PENDING_LIM)) ||
    /guided_intake:audience_pending/i.test(lim.join(" "))
  ) {
    return false;
  }
  const c = confidence["audience_base.audience_type"] ?? 0.75;
  /** Pilot summaries only treat wizard audience as “confirmed” when confidence is high enough. */
  if (c < 0.82) return false;
  return true;
}

function fieldConf(
  confidence: Record<string, number>,
  path: string,
  fallback = 0.75,
): number {
  return confidence[path] ?? fallback;
}

function problemClauseForSummary(
  sb: Record<string, unknown>,
  confidence: Record<string, number>,
): { clause: string | null; strong: boolean } {
  const desc =
    typeof sb.problem_description_optional === "string"
      ? sb.problem_description_optional.trim()
      : "";
  if (desc.length >= 8) {
    const clause = desc.length > 220 ? `${desc.slice(0, 217)}…` : desc;
    return { clause, strong: true };
  }
  const cat =
    typeof sb.problem_category === "string" ? sb.problem_category.trim() : "";
  const opt = PROBLEM_CATEGORY_OPTIONS.find((o) => o.value === cat);
  if (
    opt &&
    fieldConf(confidence, "strategic_base.problem_category", 0.8) >= 0.55
  ) {
    return { clause: opt.label.toLowerCase(), strong: true };
  }
  return { clause: null, strong: false };
}

function strongTransformClause(sb: Record<string, unknown>): string | null {
  const to =
    typeof sb.transformation_to === "string" ? sb.transformation_to.trim() : "";
  if (to.length >= 12) {
    return to.length > 220 ? `${to.slice(0, 217)}…` : to;
  }
  const tt =
    typeof sb.transformation_type === "string" ? sb.transformation_type.trim() : "";
  const tOpt = TRANSFORMATION_TYPE_OPTIONS.find((o) => o.value === tt);
  if (tOpt && to.length >= 6) {
    return `${tOpt.label.toLowerCase()}: ${to}`;
  }
  if (tOpt) return tOpt.label.toLowerCase();
  return null;
}

function audiencePendingLimitationPresent(lim: string[]): boolean {
  return lim.some(
    (s) =>
      s.includes(GUIDED_INTAKE_AUDIENCE_PENDING_LIM) ||
      /guided_intake:audience_pending/i.test(s),
  );
}

/** Pattern: institutional / social-program cues — only used to add cautious pending copy, not as facts. */
function publicSocialAudienceContextHint(sb: Record<string, unknown>): boolean {
  const blob = [
    typeof sb.simple_description === "string" ? sb.simple_description : "",
    typeof sb.problem_description_optional === "string"
      ? sb.problem_description_optional
      : "",
  ]
    .join("\n")
    .toLowerCase();
  return /\b(gobierno|municipal|instituci[oó]n p[uú]blica|programa social|beneficiario|subsidio|pol[ií]tica p[uú]blica|servicio p[uú]blico)\b/i.test(
    blob,
  );
}

function evidenceIsThin(mergedResponses: Record<string, unknown>): boolean {
  const eb = readEb(mergedResponses);
  const types = Array.isArray(eb.evidence_types)
    ? (eb.evidence_types as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  if (types.length === 0) return true;
  if (types.length === 1 && types[0] === NO_CLEAR_EVIDENCE) return true;
  return false;
}

function snippetIdentifiedActors(ab: Record<string, unknown>): string | null {
  const raw =
    typeof ab.audience_description_optional === "string"
      ? ab.audience_description_optional.trim()
      : "";
  if (raw.length < 5) return null;
  const collapsed = raw
    .split(/\n/)
    .filter((ln) => !/^\(Integrado desde el paso de evidencia/i.test(ln.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (collapsed.length < 5) return null;
  return collapsed.length > 260 ? `${collapsed.slice(0, 257)}…` : collapsed;
}

/** When the structured field is empty, reuse recent user turn summaries (user-facing text only). */
function snippetFallbackActorsFromTrace(mergedResponses: Record<string, unknown>): string | null {
  const tr = readInterviewTrace(mergedResponses);
  if (!tr?.turns?.length) return null;
  const userSummaries: string[] = [];
  for (let i = tr.turns.length - 1; i >= 0 && userSummaries.length < 2; i--) {
    const t = tr.turns[i]!;
    if (t.role !== "user") continue;
    const s = t.summary.trim();
    if (s.length < 6) continue;
    userSummaries.unshift(s);
  }
  if (userSummaries.length === 0) return null;
  const blob = userSummaries.join(" ").replace(/\s+/g, " ").trim();
  if (blob.length < 10) return null;
  return blob.length > 260 ? `${blob.slice(0, 257)}…` : blob;
}

function hasConcreteEvidenceMention(mergedResponses: Record<string, unknown>): boolean {
  if (!evidenceIsThin(mergedResponses)) return true;
  const eb = readEb(mergedResponses);
  const det = eb.evidence_details;
  if (det && typeof det === "object" && !Array.isArray(det)) {
    for (const v of Object.values(det as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim().length > 8) return true;
    }
  }
  return false;
}

function evidenceMentionedSummaryLine(mergedResponses: Record<string, unknown>): string {
  const eb = readEb(mergedResponses);
  const detailLines: string[] = [];
  const det = eb.evidence_details;
  if (det && typeof det === "object" && !Array.isArray(det)) {
    for (const v of Object.values(det as Record<string, unknown>)) {
      if (typeof v !== "string" || v.trim().length < 8) continue;
      const s = v.trim();
      detailLines.push(s.length > 200 ? `${s.slice(0, 197)}…` : s);
    }
  }
  if (detailLines.length > 0) {
    return `Evidencia mencionada: ${detailLines.slice(0, 2).join(" · ")}.`;
  }
  const types = Array.isArray(eb.evidence_types)
    ? (eb.evidence_types as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const filtered = types.filter((t) => t && t !== NO_CLEAR_EVIDENCE);
  if (filtered.length > 0) {
    const human = formatEvidenceTypeSlugsForUserFacingSummary(filtered);
    return human.length > 0
      ? `Evidencia mencionada (orientación): ${human}.`
      : "Evidencia mencionada en el cuestionario.";
  }
  return "Evidencia: aún sin pruebas concretas registradas; se puede profundizar en el diagnóstico.";
}

/**
 * Vista previa diagnóstica al cerrar la primera captura (sin JSON ni rutas internas).
 */
export function buildStrategicInterviewPilotSummary(
  mergedResponses: Record<string, unknown>,
  projectChallengeType: string | null,
  traceOtherChallenge: boolean,
  confidence: Record<string, number>,
): StrategicInterviewPilotSummary {
  const interviewTrace = readInterviewTrace(mergedResponses);
  const ds = interviewTrace?.decision_states;
  const sb = readSb(mergedResponses);
  const ab = readAb(mergedResponses);
  const lim = readLimitations(sb);
  const audienceCommitted = audienceIsCommittedForPilotSummary(
    mergedResponses,
    confidence,
  );
  const audienceType =
    typeof ab.audience_type === "string" ? ab.audience_type.trim() : "";
  const identifiedActors =
    snippetIdentifiedActors(ab) ?? snippetFallbackActorsFromTrace(mergedResponses);

  const skippedTransform = lim.some((s) =>
    /transform|transformation|transformación/i.test(s),
  );

  const tipo = labelChallenge(projectChallengeType, traceOtherChallenge);
  const desc =
    typeof sb.simple_description === "string"
      ? sb.simple_description.trim()
      : "";
  const descStrong = desc.length >= 12;
  const { clause: problemText, strong: problemStrong } = problemClauseForSummary(
    sb,
    confidence,
  );
  const transformText = strongTransformClause(sb);
  const transformStrong =
    transformText !== null &&
    !skippedTransform &&
    fieldConf(confidence, "strategic_base.transformation_type", 0.75) >= 0.55;

  const lines: string[] = [];
  lines.push("Vista previa diagnóstica.");
  lines.push("");
  lines.push(
    "Ahora Limbi puede hacer un diagnóstico inicial para ver qué está fuerte, qué falta y dónde conviene profundizar. Antes de construir el Sistema Límbico, suele convenir fortalecer algunos puntos: el diagnóstico te ayudará a priorizar el siguiente foco.",
  );
  lines.push("");
  lines.push("1. Lo que entendí");
  if (descStrong) {
    lines.push(
      `Construyes ${tipo}. Lo central registrado: ${desc.length > 320 ? `${desc.slice(0, 317)}…` : desc}.`,
    );
  } else {
    lines.push(`Construyes ${tipo}. Falta aún más detalle sobre la esencia de la oferta.`);
  }

  lines.push("");
  lines.push("2. Fricción o tensión principal");
  if (problemStrong && problemText) {
    const probSt = ds?.problem?.status;
    const probCaveat =
      probSt === "provisional" ||
      probSt === "low_confidence" ||
      probSt === "reopened"
        ? "Hipótesis registrada: "
        : "";
    lines.push(`${probCaveat}${problemText}`);
  } else {
    lines.push("Pendiente de bajar a una formulación concreta y defendible.");
  }

  lines.push("");
  lines.push("3. Beneficio o transformación deseada");
  if (transformStrong && transformText) {
    const trSt = ds?.transformation?.status;
    const trCaveat =
      trSt === "provisional" ||
      trSt === "low_confidence" ||
      trSt === "reopened"
        ? "Borrador: "
        : "";
    lines.push(`${trCaveat}${transformText}`);
  } else if (skippedTransform) {
    lines.push("Marcado como pendiente en el cuestionario.");
  } else {
    lines.push("Aún falta precisar el cambio concreto que debe percibirse cuando esto funciona bien.");
  }

  lines.push("");
  lines.push("4. Audiencia y actores");
  if (identifiedActors) {
    lines.push(
      audienceCommitted && audienceType
        ? `Actores identificados: ${identifiedActors} Prioridad consignada en captura; en el diagnóstico se contrastará la jerarquía del mensaje.`
        : `Actores identificados: ${identifiedActors} Falta definir prioridad en el diagnóstico.`,
    );
  } else if (audienceCommitted && audienceType) {
    lines.push(
      `Prioridad de audiencia alineada con lo confirmado: ${labelAudience(audienceType)}.`,
    );
  } else if (
    audienceType &&
    (audienceType === "b2b" || audienceType === "professional_audience") &&
    !audiencePendingLimitationPresent(lim)
  ) {
    lines.push(
      "Hay indicios de contexto organizacional; falta nombrar actores concretos y su orden de importancia para el mensaje.",
    );
  } else {
    lines.push("No constan aún actores descritos con suficiente detalle para priorizar.");
  }

  lines.push("");
  lines.push("5. Evidencia");
  lines.push(evidenceMentionedSummaryLine(mergedResponses));

  lines.push("");
  lines.push("6. Huecos o puntos a precisar");
  const gaps: string[] = [];
  if (!audienceCommitted) {
    if (identifiedActors) {
      gaps.push("Cerrar la prioridad entre los actores ya nombrados.");
    } else if (audiencePendingLimitationPresent(lim)) {
      gaps.push(
        "Confirmar audiencia o aportar actores concretos (compradores, usuarios, autorizadores, influencias o vetos).",
      );
      if (publicSocialAudienceContextHint(sb) && !identifiedActors) {
        gaps.push(
          "En contexto institucional o social, precisar quién habilita recursos y quién recibe el impacto, sin mezclar roles.",
        );
      }
    } else {
      gaps.push(
        "Describir actores concretos y quién debe recibir primero el mensaje frente a quién valida o paga.",
      );
    }
  }
  if (!problemStrong) {
    gaps.push("Profundizar la tensión central con hechos o situaciones medibles.");
  }
  if (!transformStrong && !skippedTransform) {
    gaps.push("Concretar el beneficio observable o la transformación prometida.");
  }
  if (!hasConcreteEvidenceMention(mergedResponses)) {
    gaps.push("Sumar pruebas (trayectoria, casos, cifras o referencias) que sostengan lo que quieres afirmar.");
  }
  const gapBlock =
    gaps.length > 0 ? gaps.map((g) => `• ${g}`).join("\n") : "• Nada crítico adicional; seguirá afinándose en el diagnóstico.";

  lines.push(gapBlock);

  lines.push("");
  lines.push("7. Próximo paso del diagnóstico");
  lines.push(
    "Limbi contrastará coherencia entre audiencia, promesa y pruebas, y te devolverá prioridades, riesgos y recomendaciones accionables.",
  );

  const body = lines.join("\n");

  return {
    title: "Completamos la primera captura del reto.",
    body,
    weakLine: null,
  };
}
