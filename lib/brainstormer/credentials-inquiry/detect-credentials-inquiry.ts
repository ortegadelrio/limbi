import type { ConversationDirectorChallengeType } from "@/lib/brainstormer/conversation-director/types";
import type { BrainstormerDetectedBrandSignals } from "@/lib/brainstormer/brand-signals-from-active-base";
import { truncateDirectorSignal } from "@/lib/brainstormer/conversation-director/truncate-director-signal";
import {
  categoryLabelEs,
  prioritizeCredibilityAssets,
} from "@/lib/brainstormer/credentials-inquiry/categorize-credibility-asset";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function detectCredentialsInquiry(userMessage: string): boolean {
  const t = normalize(userMessage);
  return [
    /\bpremios?\b/,
    /\blogros?\b/,
    /\bcredenciales?\b/,
    /\bcasos?\b/,
    /\breconocimientos?\b/,
    /\bexperiencia\s+profesional\b/,
    /\bque\s+he\s+ganado\b/,
    /\bque\s+tengo\s+en\s+la\s+base\b/,
    /\bque\s+dice\s+la\s+base\b/,
    /\bevidencia\b/,
    /\bprueba\s+de\s+autoridad\b/,
  ].some((p) => p.test(t));
}

export function buildCredentialsInquiryDirective(args: {
  user_message: string;
  challenge_type: ConversationDirectorChallengeType;
  brand_signals: BrainstormerDetectedBrandSignals;
  current_deliverable_type: string | null;
}): string | null {
  if (!detectCredentialsInquiry(args.user_message)) return null;

  const assets = [
    ...args.brand_signals.credibility_assets,
    ...args.brand_signals.differentiators.filter((d) =>
      /\bpremio|reconoc|lider|fundador|años|experiencia/i.test(d),
    ),
  ].filter((a, i, arr) => arr.indexOf(a) === i);

  if (assets.length === 0) {
    return truncateDirectorSignal(
      `MODO CREDENCIALES (BRAIN):
- El usuario pregunta por premios/logros/credenciales.
- En credibility_assets de BRAND_SIGNALS no hay ítems detectados: dilo con honestidad y pide concretar qué reconocimientos quiere usar.
- No inventes premios, años ni clientes.`,
      2000,
    );
  }

  const prioritized = prioritizeCredibilityAssets(assets, args.challenge_type, 5);
  const deliverableHint = args.current_deliverable_type
    ? `Entregable en curso: ${args.current_deliverable_type}.`
    : "";

  const lines = prioritized.map(
    (c) =>
      `• ${c.asset} (${categoryLabelEs(c.category)}): ${c.rationale}`,
  );

  return truncateDirectorSignal(
    `MODO CREDENCIALES (BRAIN) — respuesta consultiva, NO genérica:
- El usuario pregunta por premios/logros/credenciales. Usa SOLO activos listados abajo (de BRAND_SIGNALS / credibility_assets).
- NO listar todo el catálogo. Prioriza 3–5 con intención estratégica para el reto actual.
- Explica POR QUÉ cada uno sirve para ESTE momento (no como trofeos decorativos).
- Tono: "Sí, pero los usaría con intención…" — postura de consultor senior.
- Separar mentalmente: autoridad sectorial, prueba de estrategia, prueba creativa, prueba audiovisual, liderazgo gremial, construcción de industria.
- PROHIBIDO: inventar premios, clientes o cifras que no estén en la base.
${deliverableHint}

Activos priorizados para este turno:
${lines.join("\n")}`,
    2000,
  );
}
