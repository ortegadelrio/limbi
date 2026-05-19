/**
 * Guardrail genérico: IP, marcas, eventos y logos oficiales de terceros (no solo Mundial/FIFA).
 */

export const THIRD_PARTY_IP_GUARDRAIL_NOTE_ES =
  "Evitar logos, marcas o imaginería oficial de terceros (eventos deportivos, ligas, franquicias o marcas ajenas); crear estética propia inspirada en el territorio sin usar IP licenciada.";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/** Detecta riesgo de usar IP o marcas oficiales de terceros en la conversación. */
export function detectThirdPartyIpRisk(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    /\bfifa\b/,
    /\bmundial\b/,
    /\bworld\s*cup\b/,
    /\bcopa\s+del\s+mundo\b/,
    /\bolimpic(s|os)?\b/,
    /\bnfl\b|\bnba\b|\buefa\b|\bconmebol\b/,
    /\blogo\s+oficial\b/,
    /\bmarca\s+oficial\b/,
    /\bimagen\s+oficial\b/,
    /\blicencia\s+oficial\b/,
    /\bip\s+oficial\b/,
    /\bmarca\s+registrada\s+de\b/,
    /\bevento\s+oficial\b/,
    /\bestetica\s+oficial\b/,
  ]);
}

/** @deprecated Alias — usar detectThirdPartyIpRisk */
export function detectWorldCupIpGuardrail(text: string): boolean {
  return detectThirdPartyIpRisk(text);
}

export function textMentionsThirdPartyIp(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    /\bfifa\b/,
    /\bmundial\b/,
    /\bworld\s*cup\b/,
    /\bip\s+oficial\b/,
    /\blogo\s+oficial\b/,
    /\bmarca\s+oficial\b/,
    /\blicencia\s+oficial\b/,
    /\bestetica\s+oficial\b/,
    /\bterceros\b/,
    /\bip\s+de\s+terceros\b/,
    /\bmarca\s+registrada\b/,
    /\blicenciada\b/,
  ]);
}
