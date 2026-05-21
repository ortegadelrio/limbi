/**
 * Evita que Brainstormer invente nombres de marca cuando la sesión ya tiene brand_name.
 */

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

const NAMING_REQUEST_PATTERNS: readonly RegExp[] = [
  /\bnaming\b/i,
  /\bnombre\s+de\s+marca\b/i,
  /\bllamar(a|la|le)\s+(a\s+)?la\s+marca\b/i,
  /\bpropuesta\s+de\s+nombre\b/i,
  /\bcomo\s+se\s+llamar[ií]a\b/i,
  /\bqu[eé]\s+nombre\s+le\s+ponemos\b/i,
  /\bbuscar\s+nombre\b/i,
  /\brenombrar\b/i,
];

const INVENTED_NAMING_PATTERNS: readonly RegExp[] = [
  /\bimagina\s+lanzar\s+una\s+marca\s+llamada\s+["«']?([A-Za-zÁÉÍÓÚÑ][\wáéíóúñÑ-]{2,40})/i,
  /\buna\s+marca\s+llamada\s+["«']?([A-Za-zÁÉÍÓÚÑ][\wáéíóúñÑ-]{2,40})/i,
  /\bmarca\s+podr[ií]a\s+llamarse\s+["«']?([A-Za-zÁÉÍÓÚÑ][\wáéíóúñÑ-]{2,40})/i,
  /\bpropongo\s+llamarla\s+["«']?([A-Za-zÁÉÍÓÚÑ][\wáéíóúñÑ-]{2,40})/i,
  /\bnombre\s+de\s+marca\s*:\s*["«']?([A-Za-zÁÉÍÓÚÑ][\wáéíóúñÑ-]{2,40})/i,
  /\bllamada\s+["«']?([A-Za-zÁÉÍÓÚÑ][\wáéíóúñÑ-]{2,40})/i,
];

export function userRequestsBrandNaming(userMessage: string | undefined): boolean {
  if (!userMessage?.trim()) return false;
  const t = normalize(userMessage);
  return NAMING_REQUEST_PATTERNS.some((p) => p.test(t));
}

function namesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Detecta naming inventado distinto a la marca de la sesión. */
export function findInventedBrandNamingIssues(
  message: string,
  brandName: string | undefined,
  userMessage?: string,
): string[] {
  const issues: string[] = [];
  const brand = brandName?.trim();
  if (!brand || userRequestsBrandNaming(userMessage)) return issues;

  for (const p of INVENTED_NAMING_PATTERNS) {
    const m = message.match(p);
    const proposed = m?.[1]?.trim();
    if (proposed && !namesMatch(proposed, brand)) {
      if (!issues.some((i) => i.includes(proposed))) {
        issues.push(`Propone marca «${proposed}» distinta de la sesión («${brand}») sin pedido de naming.`);
      }
      break;
    }
  }

  return issues;
}

export function responseInventsBrandName(
  message: string,
  brandName: string | undefined,
  userMessage?: string,
): boolean {
  return findInventedBrandNamingIssues(message, brandName, userMessage).length > 0;
}
