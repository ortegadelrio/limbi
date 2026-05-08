import {
  AUDIENCE_TYPE_OPTIONS,
  CHALLENGE_TYPE_OPTIONS,
  NO_CLEAR_EVIDENCE,
  PROBLEM_CATEGORY_OPTIONS,
  TRANSFORMATION_TYPE_OPTIONS,
} from "@/lib/constants/wizard";
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

/**
 * Short conversational closing copy for the pilot (no paths, no JSON).
 * Modular paragraphs only; never interpolates missing audience as if known.
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

  const mainParagraphs: string[] = [];

  if (descStrong) {
    mainParagraphs.push(
      `Entendí que estás construyendo ${tipo}. Lo central que recogí: ${desc.length > 320 ? `${desc.slice(0, 317)}…` : desc}.`,
    );
  } else {
    mainParagraphs.push(`Entendí que estás construyendo ${tipo}.`);
  }

  if (problemStrong && problemText) {
    const probSt = ds?.problem?.status;
    const probCaveat =
      probSt === "provisional" ||
      probSt === "low_confidence" ||
      probSt === "reopened"
        ? "Por ahora queda como hipótesis: "
        : "";
    mainParagraphs.push(
      `${probCaveat}La situación o fricción que ubicaste: ${problemText}.`,
    );
  }

  if (transformStrong && transformText) {
    const trSt = ds?.transformation?.status;
    const trCaveat =
      trSt === "provisional" ||
      trSt === "low_confidence" ||
      trSt === "reopened"
        ? "Todavía falta confirmar el beneficio, pero como orientación: "
        : "";
    mainParagraphs.push(
      `${trCaveat}El cambio o beneficio que buscas comunicar: ${transformText}.`,
    );
  }

  if (audienceCommitted && audienceType) {
    mainParagraphs.push(
      `Hoy la comunicación tendría como protagonista principal a ${labelAudience(audienceType)}, en coherencia con lo que contaste.`,
    );
  } else if (
    audienceType &&
    (audienceType === "b2b" || audienceType === "professional_audience") &&
    !audiencePendingLimitationPresent(lim)
  ) {
    mainParagraphs.push(
      "Por el contexto, hay indicios de que la comunicación puede apuntar a un entorno empresarial u organizacional, pero todavía falta definir con precisión quién debe ser convencido primero y quiénes son decisores, usuarios o vetos dentro de esas capas.",
    );
  }

  const completionNext =
    "Ya tengo una base inicial para construir el Sistema Límbico. Ahora podemos seguir con las siguientes preguntas para completar contexto, audiencia, evidencia, pulso límbico y voz.";

  const body = `${completionNext}\n\n${mainParagraphs.join("\n\n")}`;

  const pending: string[] = [];

  if (!audienceCommitted) {
    if (audiencePendingLimitationPresent(lim)) {
      pending.push(
        "La audiencia principal todavía queda pendiente. Limbi deberá precisar después quién debe ser convencido primero y quiénes son decisores, influenciadores o beneficiarios.",
      );
      if (publicSocialAudienceContextHint(sb)) {
        pending.push(
          "Hay indicios de que una autoridad o ente institucional puede ser un actor habilitador o financiador, y que las personas impactadas pueden ser otra capa importante, pero falta definir a quién debe convencer primero la comunicación.",
        );
      }
    } else {
      pending.push(
        "Todavía falta precisar quién debe convencerse primero la comunicación y quiénes son decisores, vetos o influenciadores clave.",
      );
    }
  }

  if (!problemStrong) {
    pending.push(
      "El problema o tensión central queda pendiente de bajar a una formulación concreta y defendible.",
    );
  }

  if (!transformStrong && !skippedTransform) {
    pending.push(
      "El beneficio está encaminado, pero todavía conviene precisar qué cambio concreto debe percibir la audiencia cuando esto funciona bien.",
    );
  }

  if (evidenceIsThin(mergedResponses)) {
    pending.push(
      "La evidencia queda pendiente. Limbi deberá evitar claims fuertes hasta que existan pruebas, casos o referencias concretas.",
    );
  }

  const weakLine = pending.length > 0 ? pending.slice(0, 4).join("\n\n") : null;

  return {
    title:
      "Completamos la primera etapa: entender qué ofreces y qué problema ayuda a resolver.",
    body,
    weakLine,
  };
}
