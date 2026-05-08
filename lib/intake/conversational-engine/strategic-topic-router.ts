import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import { detectReturnToAudienceTopicIntent } from "@/lib/intake/guided-intake-strategic-validation";
import type { StrategicDecisionTopicKey } from "@/lib/intake/decision-state";
import { miniStepToStrategicTopicKey } from "@/lib/intake/decision-state";

type TopicSignal = { topic: StrategicDecisionTopicKey; weight: number };

const TOPIC_SIGNALS: { topic: StrategicDecisionTopicKey; res: RegExp[] }[] = [
  {
    topic: "audience",
    res: [
      /\b(audiencia|p[uú]blico objetivo|p[uú]blico principal|a qui[eé]n hablarle|a quien hablarle|decisor|prioridad de p[uú]blico|qui[eé]n debe (ser )?convencido|stakeholder|buyer)\b/i,
    ],
  },
  {
    topic: "evidence",
    res: [
      /\b(evidencia|prueba|testimonio|dato|m[eé]trica|cifra|caso de [uú]so|referencia|estudio|benchmark)\b/i,
    ],
  },
  {
    topic: "problem",
    res: [
      /\b(el problema|la fricci[oó]n|la tensi[oó]n|la situaci[oó]n central|pain point|obst[aá]culo|cuellos? de botella)\b/i,
      /\b(qu[eé] problema|que problema|no encuentran|no logran|demora|riesgo operativo)\b/i,
    ],
  },
  {
    topic: "transformation",
    res: [
      /\b(beneficio|transformaci[oó]n|resultado|promesa de valor|cambio que buscan|valor percibido|outcome|impacto buscado)\b/i,
      /\b(el beneficio real|lo que cambia|la promesa)\b/i,
    ],
  },
];

function scoreTopic(topic: StrategicDecisionTopicKey, text: string): number {
  const row = TOPIC_SIGNALS.find((x) => x.topic === topic);
  if (!row) return 0;
  let s = 0;
  for (const re of row.res) {
    if (re.test(text)) s += 1;
  }
  return s;
}

export function rankStrategicTopicsInText(userText: string): TopicSignal[] {
  const t = userText.trim();
  if (t.length < 4) return [];
  const ranked: TopicSignal[] = (
    ["audience", "evidence", "problem", "transformation"] as const
  ).map((topic) => ({ topic, weight: scoreTopic(topic, t) }));
  return ranked.filter((x) => x.weight > 0).sort((a, b) => b.weight - a.weight);
}

/**
 * If the user clearly points at another strategic topic than the active mini-step,
 * returns that topic when confidence is high enough.
 */
export function resolveCrossStrategicTopicReference(params: {
  userText: string;
  currentMiniStep: GuidedMiniStepId;
}): StrategicDecisionTopicKey | null {
  const { userText, currentMiniStep } = params;
  const currentTopic = miniStepToStrategicTopicKey(currentMiniStep);
  const t = userText.trim();
  if (t.length < 6) return null;

  if (detectReturnToAudienceTopicIntent(userText)) {
    if (currentTopic !== "audience") return "audience";
    return null;
  }

  const ranked = rankStrategicTopicsInText(t);
  if (ranked.length === 0) return null;
  const best = ranked[0]!;
  if (best.weight < 1) return null;
  if (currentTopic && best.topic === currentTopic) return null;
  if (ranked.length > 1 && ranked[1]!.weight === best.weight) return null;
  return best.topic;
}

const META_REOPEN_ONLY_RES: RegExp[] = [
  /\bvolvamos a\b/i,
  /\bvolver a\b/i,
  /\bme gustar[ií]a definir mejor\b/i,
  /\bquiero (ajustar|cambiar|corregir|definir mejor)\b/i,
  /\bhay que revisar\b/i,
];

const SUBSTANTIVE_CORRECTION_RES: RegExp[] = [
  /\bpens[aá]ndolo bien\b/i,
  /\bmejor dicho\b/i,
  /\ben realidad\b/i,
  /\blo correcto es\b/i,
  /\bcorrigiendo\b/i,
  /\bel .* principal (es|son)\b/i,
  /\bla .* principal (es|son)\b/i,
];

export type CrossTopicSurfaceKind = "meta_reopen" | "substantive_correction";

/**
 * Distinguishes “take me back to that step” from “here is new content for another step”.
 */
export function classifyCrossTopicSurface(
  userText: string,
): CrossTopicSurfaceKind | null {
  const t = userText.trim();
  if (t.length < 8) return null;
  if (SUBSTANTIVE_CORRECTION_RES.some((re) => re.test(t))) return "substantive_correction";
  if (META_REOPEN_ONLY_RES.some((re) => re.test(t))) return "meta_reopen";
  if (t.length > 48 && /[.!?]/.test(t)) return "substantive_correction";
  return null;
}
