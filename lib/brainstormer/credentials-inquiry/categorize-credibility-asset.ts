import type {
  CategorizedCredential,
  CredentialUtilityCategory,
} from "@/lib/brainstormer/credentials-inquiry/types";
import type { ConversationDirectorChallengeType } from "@/lib/brainstormer/conversation-director/types";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function scoreCategory(text: string, patterns: RegExp[]): number {
  const t = normalize(text);
  return patterns.reduce((n, p) => (p.test(t) ? n + 1 : 0), 0);
}

/** Clasifica un activo de credibilidad por utilidad estratégica (heurística genérica). */
export function categorizeCredibilityAsset(asset: string): CredentialUtilityCategory {
  const t = normalize(asset);

  const scores: Record<CredentialUtilityCategory, number> = {
    sector_authority: scoreCategory(t, [
      /\bjunta\b/,
      /\bgremio\b/,
      /\basociaci[oó]n\b/,
      /\binstitucional\b/,
      /\bsector\b/,
      /\bpresidente\b/,
      /\bvicepresidente\b/,
    ]),
    strategy_proof: scoreCategory(t, [
      /\bestrateg/i,
      /\bmarketing\b/,
      /\bcomunicaci[oó]n\b/,
      /\bpremio\b/,
      /\baward\b/,
      /\bcaso\b/,
      /\bconsultor/i,
    ]),
    creative_proof: scoreCategory(t, [
      /\bcreativ/i,
      /\bagencia\b/,
      /\bcampaña\b/,
      /\bdiseño\b/,
      /\bpublicidad\b/,
    ]),
    audiovisual_proof: scoreCategory(t, [
      /\baudiovisual\b/,
      /\bcine\b/,
      /\bvideo\b/,
      /\bproducci[oó]n\b/,
      /\bfestival\b.*\bcine\b/,
      /\bnarrativa\b/,
    ]),
    industry_leadership: scoreCategory(t, [
      /\bliderazgo\b/,
      /\bfundador\b/,
      /\bfundadora\b/,
      /\bceo\b/,
      /\bdirector\b/,
      /\bmentor\b/,
    ]),
    industry_building: scoreCategory(t, [
      /\bcongreso\b/,
      /\bevento\s+sectorial\b/,
      /\becosistema\b/,
      /\bindustria\b/,
      /\bcomunidad\b/,
      /\bplataforma\b/,
    ]),
  };

  let best: CredentialUtilityCategory = "strategy_proof";
  let bestScore = -1;
  for (const [cat, sc] of Object.entries(scores) as [CredentialUtilityCategory, number][]) {
    if (sc > bestScore) {
      bestScore = sc;
      best = cat;
    }
  }
  return best;
}

const CATEGORY_LABEL_ES: Record<CredentialUtilityCategory, string> = {
  sector_authority: "autoridad sectorial",
  strategy_proof: "prueba de estrategia",
  creative_proof: "prueba creativa",
  audiovisual_proof: "prueba audiovisual",
  industry_leadership: "liderazgo gremial o de industria",
  industry_building: "construcción de industria",
};

const CHALLENGE_PRIORITY: Record<
  ConversationDirectorChallengeType,
  CredentialUtilityCategory[]
> = {
  positioning: ["sector_authority", "strategy_proof", "industry_leadership", "creative_proof"],
  event_promotion: ["strategy_proof", "sector_authority", "industry_building", "audiovisual_proof"],
  sales: ["strategy_proof", "creative_proof", "sector_authority"],
  campaign: ["creative_proof", "strategy_proof", "audiovisual_proof"],
  content: ["creative_proof", "audiovisual_proof", "strategy_proof"],
  activation: ["creative_proof", "industry_building", "strategy_proof"],
  audiovisual: ["audiovisual_proof", "creative_proof", "strategy_proof"],
  general_strategy: ["strategy_proof", "sector_authority", "industry_leadership"],
  unknown: ["strategy_proof", "sector_authority", "creative_proof"],
};

function rationaleForCategory(
  category: CredentialUtilityCategory,
  challengeType: ConversationDirectorChallengeType,
): string {
  switch (category) {
    case "sector_authority":
      return "Refuerza legitimidad ante pares y compradores del sector.";
    case "strategy_proof":
      return challengeType === "event_promotion" || challengeType === "positioning"
        ? "Demuestra que sabes diseñar estrategias que compiten, no solo ejecutar piezas."
        : "Sostiene decisiones estratégicas con evidencia reconocible.";
    case "creative_proof":
      return "Muestra capacidad de ejecución creativa y resultados tangibles.";
    case "audiovisual_proof":
      return "Respalda storytelling y narrativa; conviene como apoyo, no siempre como eje principal.";
    case "industry_leadership":
      return "Posiciona liderazgo y trayectoria más allá de un solo proyecto.";
    case "industry_building":
      return "Prueba que construyes categoría o comunidad, no solo participas en ella.";
  }
}

/** Prioriza activos de credibilidad según el reto (máx. `limit`). */
export function prioritizeCredibilityAssets(
  assets: string[],
  challengeType: ConversationDirectorChallengeType,
  limit = 5,
): CategorizedCredential[] {
  const priority = CHALLENGE_PRIORITY[challengeType] ?? CHALLENGE_PRIORITY.unknown;
  const categorized = assets.map((asset) => {
    const category = categorizeCredibilityAsset(asset);
    return {
      asset,
      category,
      rationale: rationaleForCategory(category, challengeType),
    };
  });

  categorized.sort((a, b) => {
    const pa = priority.indexOf(a.category);
    const pb = priority.indexOf(b.category);
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
  });

  return categorized.slice(0, limit);
}

export function categoryLabelEs(category: CredentialUtilityCategory): string {
  return CATEGORY_LABEL_ES[category];
}
