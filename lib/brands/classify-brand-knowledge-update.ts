import type {
  BrandKnowledgeUpdateClassification,
  BrandKnowledgeUpdateImportanceLevel,
  BrandKnowledgeUpdateSectionKey,
} from "@/lib/brands/brand-knowledge-update-types";

type SectionRule = {
  key: BrandKnowledgeUpdateSectionKey;
  patterns: RegExp[];
  weight?: number;
};

const SECTION_RULES: SectionRule[] = [
  {
    key: "restrictions",
    patterns: [
      /\bya no queremos\b/i,
      /\bno queremos\b/i,
      /\bno usar\b/i,
      /\bno decir\b/i,
      /\bprohibid/i,
      /\bnunca\b/i,
      /\bevitar\b/i,
      /\bno sonar\b/i,
    ],
    weight: 3,
  },
  {
    key: "voice_tone",
    patterns: [
      /\btono\b/i,
      /\bvoz\b/i,
      /\binstitucional/i,
      /\bformal(es)?\b/i,
      /\binformal(es)?\b/i,
      /\bsonar\b/i,
      /\bestilo\b/i,
    ],
    weight: 2,
  },
  {
    key: "credibility",
    patterns: [
      /\bpremio/i,
      /\breconocim/i,
      /\bcertific/i,
      /\bacredit/i,
      /\bgalard[oó]n/i,
      /\bganamos\b/i,
      /\bganó\b/i,
    ],
    weight: 2,
  },
  {
    key: "evidence",
    patterns: [/\bcaso de [ée]xito/i, /\btestimonio/i, /\bprueba\b/i, /\bevidencia\b/i],
  },
  {
    key: "offer",
    patterns: [
      /\bofrecemos\b/i,
      /\boferta\b/i,
      /\bservicio/i,
      /\bproducto/i,
      /\bauditor[ií]a/i,
      /\blanzamos\b/i,
      /\bnuevo servicio\b/i,
    ],
    weight: 2,
  },
  {
    key: "value_proposition",
    patterns: [/\bpropuesta de valor\b/i, /\bbeneficio/i, /\bvalor que aport/i],
  },
  {
    key: "audience",
    patterns: [/\baudiencia/i, /\bcliente/i, /\bp[uú]blico\b/i, /\bsegmento\b/i],
  },
  {
    key: "differentiators",
    patterns: [/\bdiferenciador/i, /\b[uú]nico\b/i, /\bexclusiv/i],
  },
  {
    key: "identity",
    patterns: [/\bsomos\b/i, /\bidentidad\b/i, /\bmisi[oó]n\b/i, /\bvisi[oó]n\b/i],
  },
  {
    key: "limbic",
    patterns: [/\bl[ií]mbic/i, /\bs[ií]mbol/i, /\barquetipo/i, /\bemocion/i],
  },
];

const CRITICAL_PATTERNS = [
  /\bya no queremos\b/i,
  /\bprohibid/i,
  /\bnunca\b/i,
  /\bobligatori/i,
  /\bcr[ií]tic/i,
];

const HIGH_PATTERNS = [
  /\bpremio/i,
  /\bofrecemos\b/i,
  /\bnuevo servicio\b/i,
  /\bganamos\b/i,
  /\blanzamos\b/i,
  /\bauditor[ií]a/i,
];

function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function buildInterpretedSummary(raw: string): string {
  const normalized = normalizeText(raw);
  if (normalized.length <= 280) return normalized;
  return `${normalized.slice(0, 277).trimEnd()}…`;
}

function scoreSection(text: string): BrandKnowledgeUpdateSectionKey {
  let bestKey: BrandKnowledgeUpdateSectionKey = "other";
  let bestScore = 0;

  for (const rule of SECTION_RULES) {
    let hits = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) hits += 1;
    }
    if (hits === 0) continue;
    const score = hits * (rule.weight ?? 1);
    if (score > bestScore) {
      bestScore = score;
      bestKey = rule.key;
    }
  }

  return bestKey;
}

function scoreImportance(
  text: string,
  sectionKey: BrandKnowledgeUpdateSectionKey,
): BrandKnowledgeUpdateImportanceLevel {
  if (CRITICAL_PATTERNS.some((p) => p.test(text))) return "critical";
  if (HIGH_PATTERNS.some((p) => p.test(text))) return "high";
  if (sectionKey === "restrictions" || sectionKey === "voice_tone") return "high";
  return "medium";
}

function resolveMustInclude(
  importance: BrandKnowledgeUpdateImportanceLevel,
  sectionKey: BrandKnowledgeUpdateSectionKey,
): boolean {
  if (importance === "critical") return true;
  if (importance === "high") {
    return (
      sectionKey === "offer" ||
      sectionKey === "credibility" ||
      sectionKey === "restrictions" ||
      sectionKey === "value_proposition"
    );
  }
  return false;
}

/** Clasificación determinística MVP (sin inventar datos: resume el texto del usuario). */
export function classifyBrandKnowledgeUpdate(
  rawText: string,
): BrandKnowledgeUpdateClassification {
  const normalized = normalizeText(rawText);
  const section_key = scoreSection(normalized);
  const importance_level = scoreImportance(normalized, section_key);
  return {
    interpreted_summary: buildInterpretedSummary(normalized),
    section_key,
    importance_level,
    must_include: resolveMustInclude(importance_level, section_key),
  };
}
