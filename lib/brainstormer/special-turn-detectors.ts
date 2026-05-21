/**
 * Detección determinística de turnos especiales (investigación externa, handoff a proyecto).
 */

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function hasAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/** Frases explícitas de pedido de investigación externa. */
const EXTERNAL_RESEARCH_STRONG_PATTERNS: readonly RegExp[] = [
  /\bbusca\s+referentes\b/,
  /\binvestiga\s+referentes\b/,
  /\bbusca\s+campa[nñ]as\s+parecidas\b/,
  /\bmira\s+competidores\b/,
  /\bque\s+ejemplos\s+existen\b/,
  /\bbusca\s+tendencias\b/,
  /\binvestiga\s+esta\s+categor[ií]a\b/,
  /\bvalida\s+si\s+esta\s+idea\s+ya\s+existe\b/,
  /\bbusca\s+casos\s+similares\b/,
  /\bque\s+estan\s+haciendo\s+marcas\s+parecidas\b/,
  /\bqu[eé]\s+est[aá]n\s+haciendo\s+marcas\s+parecidas\b/,
  /\bbuscame\s+inspiraci[oó]n\b/,
  /\bb[uú]scame\s+inspiraci[oó]n\b/,
  /\bmira\s+que\s+hay\s+en\s+internet\b/,
  /\binvestiga\s+en\s+internet\b/,
  /\bbusca\s+en\s+internet\b/,
  /\bbuscar\s+referentes\b/,
  /\binvestigar\s+referentes\b/,
  /\bbenchmark\s+externo\b/,
  /\bbusca\s+en\s+la\s+web\b/,
  /\binvestiga\s+competencia\b/,
  /\bbusca\s+competencia\b/,
  /\bquienes\s+son\s+(mis\s+)?competidores\b/,
  /\bcu[aá]les\s+son\s+(mis\s+)?competidores\b/,
  /\binvestiga\w*\s+.{0,120}\bcompetidores\b/,
  /\b(busca|b[uú]scame)\w*\s+.{0,80}\bcompetidores\b/,
  /\bantes\s+de\s+comenzar\b.*\binvestiga\w*\b/,
  /\bquisiera\s+que\b.*\binvestiga\w*\b/,
];

const EXTERNAL_RESEARCH_VERB_PATTERNS: readonly RegExp[] = [
  /\bbusca\b/,
  /\bbuscame\b/,
  /\bb[uú]scame\b/,
  /\binvestiga\w*\b/,
  /\bbusca\s+en\s+internet\b/,
  /\bbuscar\s+en\s+internet\b/,
  /\bmira\s+en\s+internet\b/,
  /\bmira\s+en\s+la\s+web\b/,
];

const EXTERNAL_RESEARCH_TOPIC_PATTERNS: readonly RegExp[] = [
  /\bcompetidores\b/,
  /\breferentes\b/,
  /\btendencias\b/,
  /\bcasos\s+similares\b/,
  /\bquienes\s+son\s+(mis\s+)?competidores\b/,
  /\bcu[aá]les\s+son\s+(mis\s+)?competidores\b/,
  /\bque\s+estan\s+haciendo\s+marcas\b/,
  /\bbenchmark\b/,
  /\binspiraci[oó]n\b/,
  /\bcompetencia\b/,
];

const PROJECT_HANDOFF_PATTERNS: readonly RegExp[] = [
  /\bpaso\s+al\s+m[oó]dulo\s+de\s+proyectos\b/,
  /\bpasemos\s+a\s+proyecto\b/,
  /\bconvirtamos\s+esto\s+en\s+proyecto\b/,
  /\bcreamos\s+el\s+proyecto\b/,
  /\bllevar\s+esto\s+a\s+proyecto\b/,
  /\bya\s+podemos\s+crear\s+el\s+proyecto\b/,
  /\besto\s+ya\s+est[aá]\s+listo\s+para\s+proyecto\b/,
  /\barmemos\s+el\s+proyecto\b/,
  /\blo\s+trabajo\s+como\s+proyecto\b/,
  /\bpasar\s+a\s+proyecto\b/,
  /\bpasamos\s+a\s+proyecto\b/,
  /\bcrear\s+el\s+proyecto\b/,
  /\bmodulo\s+de\s+proyectos\b/,
  /\bm[oó]dulo\s+de\s+proyectos\b/,
  /\bexcelente,?\s+paso\s+al\b.*\bproyecto/i,
];

/**
 * Prioridad sobre lanzamiento/adquisición cuando el mensaje mezcla contexto + pedido de investigación.
 */
export function isExternalResearchRequest(userMessage: string): boolean {
  const msg = userMessage.trim();
  if (!msg) return false;

  const t = normalize(msg);
  if (hasAny(t, EXTERNAL_RESEARCH_STRONG_PATTERNS)) return true;

  const hasVerb = hasAny(t, EXTERNAL_RESEARCH_VERB_PATTERNS);
  const hasTopic = hasAny(t, EXTERNAL_RESEARCH_TOPIC_PATTERNS);
  const wantsInternet = /\b(en\s+)?internet\b/.test(t) || /\ben\s+la\s+web\b/.test(t);

  if (hasVerb && (hasTopic || wantsInternet)) return true;

  if (
    hasAny(t, [
      /\bquienes\s+son\s+(mis\s+)?competidores\b/,
      /\bcu[aá]les\s+son\s+(mis\s+)?competidores\b/,
    ]) &&
    (hasVerb || wantsInternet)
  ) {
    return true;
  }

  return false;
}

export function isProjectHandoffRequest(userMessage: string): boolean {
  const msg = userMessage.trim();
  if (!msg) return false;
  return hasAny(normalize(msg), PROJECT_HANDOFF_PATTERNS);
}

export function extractResearchQuery(userMessage: string, brandName: string): string {
  const trimmed = userMessage.trim();

  const competitorQ = trimmed.match(
    /\b(?:qu[ií]enes|cu[aá]les)\s+son\s+(?:mis\s+)?competidores\b/i,
  );
  if (competitorQ) {
    return `Competidores de ${brandName} en su categoría`.slice(0, 500);
  }

  const investigaBlock = trimmed.match(
    /\binvestiga(?:me|mos|r)?\s+(.+?)(?:\.|$)/i,
  );
  if (investigaBlock?.[1]) {
    return investigaBlock[1].trim().slice(0, 500);
  }

  const sobre = trimmed.match(/\bsobre\s+(.+?)\s*$/i);
  if (sobre?.[1]) return sobre[1].trim().slice(0, 500);

  return `${trimmed} (${brandName})`.slice(0, 500);
}
