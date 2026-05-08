/**
 * Detects when the user signals they are not ready to close a strategic decision
 * (Spanish-first patterns; reusable, not tied to any vertical).
 */
const ACTIVE_DOUBT_RES: RegExp[] = [
  /\bno estoy seguro\b/i,
  /\bno s[eé] si\b/i,
  /\bno se si\b/i,
  /\btengo dudas\b/i,
  /\bno estoy convencido\b/i,
  /\bno lo tengo claro\b/i,
  /\bno lo tengo nada claro\b/i,
  /\bme gustar[ií]a pensarlo mejor\b/i,
  /\bpensarlo mejor\b/i,
  /\bno s[eé] si priorizar/i,
  /\bpuede ser,?\s*pero no s[eé]\b/i,
  /\bpuede ser pero no se\b/i,
  /\btodav[ií]a no estoy seguro\b/i,
  /\ba[uú]n no estoy seguro\b/i,
  /\bno tengo claro si\b/i,
  /\bestoy indeciso\b/i,
  /\bno me decido\b/i,
  /\bquiero pensarlo\b/i,
];

const ADVISORY_HOOK_RES: RegExp[] = [
  /\b¿?t[uú] qu[eé] opinas\b/i,
  /\bqu[eé] opinas\b/i,
  /\b¿?cu[aá]l me recomiendas\b/i,
  /\bcual me recomiendas\b/i,
  /\b¿?a qui[eé]n crees\b/i,
  /\ba quien crees\b/i,
  /\b¿?qu[eé] me recomiendas\b/i,
];

export function detectActiveStrategicDoubt(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 6) return false;
  if (ACTIVE_DOUBT_RES.some((re) => re.test(t))) return true;
  if (ADVISORY_HOOK_RES.some((re) => re.test(t))) return true;
  return false;
}
