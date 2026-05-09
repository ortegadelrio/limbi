/**
 * User asks Limbi to choose or recommend (not a meta-definition of the prompt).
 * Used by the conversational engine and clarification detector.
 */
const RECOMMENDATION_OR_DELEGATE_CHOICE_RES: RegExp[] = [
  /\bme recomendarías\b/i,
  /\bme recomiendas\b/i,
  /\bcuál me recomiendas\b/i,
  /\bcual me recomiendas\b/i,
  /\bcuál debería priorizar\b/i,
  /\bcual debería priorizar\b/i,
  /\ba quién debería convencer primero\b/i,
  /\ba quien debería convencer primero\b/i,
  /\bqué público ves más importante\b/i,
  /\bque publico ves mas importante\b/i,
  /\bqué me sugieres\b/i,
  /\bque me sugieres\b/i,
  /\bcuál crees que es mejor\b/i,
  /\bcual crees que es mejor\b/i,
  /\btú qué harías\b/i,
  /\btu que harías\b/i,
  /\bqué harías tú\b/i,
  /\bque harías tu\b/i,
  /\ba quién priorizar\b/i,
  /\ba quien priorizar\b/i,
  /\bquién me recomiendas\b/i,
  /\bquien me recomiendas\b/i,
  /\bcu[aá]l consideras\b/i,
  /\bcual consideras\b/i,
  /\bde acuerdo a tu experiencia\b/i,
  /\bseg[uú]n tu experiencia\b/i,
  /\bcomo experto en marketing\b/i,
  /\bno\s+s[eé]\s+dime\b/i,
  /\bno\s+se\s+dime\b/i,
  /\bqu[eé]\s+deber[ií]a\s+poner\b/i,
  /\bqu[eé]\s+deber[ií]a\s+responder\b/i,
  /\bdime\s+t[uú]\s+cu[aá]l\b/i,
  /\bdime\s+cu[aá]l\s+es\s+mejor\b/i,
  /\bcu[aá]l\s+consideras\s+t[uú]\b/i,
  /\bcual\s+consideras\s+tu\b/i,
  /\ba quién me recomiendas\b/i,
  /\ba quien me recomiendas\b/i,
  /\bqu[eé]\s+me\s+recomiendas\b/i,
  /\bque\s+me\s+recomiendas\b/i,
  /\bqu[eé]\s+audiencia\s+pongo\b/i,
  /\bque\s+audiencia\s+pongo\b/i,
  /\bqu[eé]\s+p[uú]blico\s+pongo\b/i,
  /\bay[uú]dame\s+a\s+definir\s+(la\s+)?audiencia\b/i,
];

/** True when the user is asking Limbi for a final choice or recommendation, not prompt gloss. */
export function isStrategicRecommendationOrDelegateAsk(t: string): boolean {
  const s = t.trim();
  if (s.length < 6) return false;
  return RECOMMENDATION_OR_DELEGATE_CHOICE_RES.some((re) => re.test(s));
}
