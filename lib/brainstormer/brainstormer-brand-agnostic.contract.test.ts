import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director/resolve-conversation-director";
import { EVALUATION_BRAND_PROFILES } from "@/lib/brainstormer/evaluation-fixtures/brand-profiles";
import { enrichSessionProgressFromDirector } from "@/lib/brainstormer/enrich-session-progress-from-director";
import { buildOperationalSummarySections } from "@/lib/brainstormer/operational-summary";
import { detectThirdPartyIpRisk } from "@/lib/brainstormer/third-party-ip-guardrail";
import { detectCredentialsInquiry, prioritizeCredibilityAssets } from "@/lib/brainstormer/credentials-inquiry";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FORBIDDEN_IN_PRODUCTION = [
  "Ortegadelrio",
  "Pópuli",
  "Populi",
  "Perrenque",
  "COMARKA",
  "UNEMEC",
  "Mundial 2026",
] as const;

function collectTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "evaluation-fixtures" || name === "node_modules") continue;
      collectTsFiles(full, acc);
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("Brainstormer — agnóstico de marca (auditoría)", () => {
  it("código productivo en lib/brainstormer no hardcodea marcas de fixture Ortegadelrio", () => {
    const root = path.join(__dirname);
    const files = collectTsFiles(root);
    const violations: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const term of FORBIDDEN_IN_PRODUCTION) {
        if (src.includes(term)) {
          violations.push(`${path.relative(root, file)}: ${term}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("renderer y work-mode usan guardrail genérico de IP de terceros", () => {
    const renderer = readFileSync(
      path.join(__dirname, "conversational-renderer/build-renderer-system-instructions.ts"),
      "utf8",
    );
    const hints = readFileSync(
      path.join(__dirname, "conversational-renderer/work-mode-render-hints.ts"),
      "utf8",
    );
    expect(renderer).toMatch(/third-party official IP/i);
    expect(hints).toMatch(/third-party events, leagues or brands/i);
    expect(renderer).not.toMatch(/Mundial 2026/);
  });
});

describe("Brainstormer — perfiles de evaluación multi-marca", () => {
  const baseProgress = () => emptyBrainstormerSessionProgress();

  for (const profile of EVALUATION_BRAND_PROFILES) {
    it(`${profile.kind}: clasifica reto sin asumir conferencias`, () => {
      const d = resolveConversationDirector({
        user_message: profile.user_opening,
        conversation_excerpt: `user: ${profile.user_opening}`,
        session_progress: {
          session_summary: "",
          current_challenge: "",
          preliminary_objective: "",
          project_readiness: "low",
          should_suggest_project_conversion: false,
        },
        brand_signals: {
          identity_or_positioning: profile.identity_or_positioning,
          audiences: profile.audiences,
          offer_or_roles: profile.offer_or_roles,
          differentiators: [],
          credibility_assets: profile.credibility_assets,
          tone_or_limbic_cues: [],
          guardrails: [],
        },
        user_message_count: 1,
      });

      expect(d.challenge_type).not.toBe("unknown");
      const enriched = enrichSessionProgressFromDirector(
        baseProgress(),
        d,
        {
          conversation_excerpt: `user: ${profile.user_opening}`,
          user_message: profile.user_opening,
        },
      );
      expect(enriched.current_challenge).toMatch(profile.expected_challenge_pattern);
    });
  }

  it("producto: venta no activa modo conferencia", () => {
    const profile = EVALUATION_BRAND_PROFILES.find((p) => p.id === "product")!;
    const d = resolveConversationDirector({
      user_message: profile.user_opening,
      conversation_excerpt: profile.user_opening,
      session_progress: {
        session_summary: "",
        current_challenge: "",
        preliminary_objective: "",
        project_readiness: "low",
        should_suggest_project_conversion: false,
      },
      brand_signals: {
        identity_or_positioning: profile.identity_or_positioning,
        audiences: profile.audiences,
        offer_or_roles: profile.offer_or_roles,
        differentiators: [],
        credibility_assets: profile.credibility_assets,
        tone_or_limbic_cues: [],
        guardrails: [],
      },
      user_message_count: 1,
    });
    expect(d.challenge_type).toBe("sales");
    expect(d.current_deliverable_type).not.toBe("conference");
  });

  it("cualquier marca: IP de terceros activa guardrail sin requerir Mundial", () => {
    expect(detectThirdPartyIpRisk("usar logo oficial de la liga")).toBe(true);
    expect(detectThirdPartyIpRisk("estrategia de contenido orgánico")).toBe(false);
  });
});

describe("Brainstormer — credenciales desde señales de marca", () => {
  it("detecta pregunta por premios y prioriza activos de la base", () => {
    expect(detectCredentialsInquiry("¿Los premios que he ganado?")).toBe(true);
    const assets = ["Premio nacional de marketing", "Fundador de plataforma sectorial"];
    const prioritized = prioritizeCredibilityAssets(assets, "event_promotion", 3);
    expect(prioritized.length).toBeGreaterThan(0);
    expect(prioritized.every((p) => assets.some((a) => a === p.asset))).toBe(true);
  });
});

describe("Resumen operativo — deduplicación y síntesis", () => {
  it("no duplica guardrail de IP en decisiones", () => {
    const progress = emptyBrainstormerSessionProgress();
    progress.ideas_explored =
      "- Evitar logos de terceros.\n- Evitar logos, marcas o imaginería oficial de terceros.";
    progress.current_challenge = "Reto estratégico en definición";
    const corpus = `user: Quiero conferencias con metáfora de fútbol
user: conseguir conferencias
user: estructura de conferencia
user: sin usar logo oficial del evento`;

    const d = resolveConversationDirector({
      user_message: "desarróllamela",
      conversation_excerpt: corpus,
      session_progress: {
        session_summary: "",
        current_challenge: progress.current_challenge,
        preliminary_objective: "",
        project_readiness: "medium",
        should_suggest_project_conversion: false,
      },
      brand_signals: {
        identity_or_positioning: ["Estrategia y conferencias"],
        audiences: [],
        offer_or_roles: ["Conferencias"],
        differentiators: [],
        credibility_assets: [],
        tone_or_limbic_cues: [],
        guardrails: [],
      },
      user_message_count: 5,
    });

    const enriched = enrichSessionProgressFromDirector(progress, d, {
      conversation_excerpt: corpus,
      user_message: "desarróllamela",
    });

    expect(enriched.current_challenge).not.toMatch(/en definici[oó]n/i);
    expect(enriched.current_challenge).toMatch(/conferencia/i);
    expect(enriched.preliminary_objective).toMatch(/fútbol|futbol|metáfora/i);

    const ipMatches = enriched.ideas_explored.match(/terceros|oficial|fifa|mundial/gi) ?? [];
    const sections = buildOperationalSummarySections(enriched);
    const decisions = sections.find((s) => s.label === "Decisiones tomadas");
    expect(decisions).toBeDefined();
    const bullets = (decisions?.value ?? "").split("\n").filter((l) => l.trim());
    const ipBullets = bullets.filter((b) => /terceros|oficial|licenciada|fifa/i.test(b));
    expect(ipBullets.length).toBeLessThanOrEqual(1);
    expect(ipMatches.length).toBeLessThanOrEqual(3);
  });

  it("siguiente paso contextual al preguntar por logros", () => {
    const progress = emptyBrainstormerSessionProgress();
    const d = resolveConversationDirector({
      user_message: "¿Los premios que he ganado?",
      conversation_excerpt: "user: conferencia de marketing\nuser: ¿Los premios que he ganado?",
      session_progress: {
        session_summary: "",
        current_challenge: "",
        preliminary_objective: "",
        project_readiness: "low",
        should_suggest_project_conversion: false,
      },
      brand_signals: {
        identity_or_positioning: [],
        audiences: [],
        offer_or_roles: [],
        differentiators: [],
        credibility_assets: ["Premio de estrategia 2024"],
        tone_or_limbic_cues: [],
        guardrails: [],
      },
      user_message_count: 2,
    });

    const enriched = enrichSessionProgressFromDirector(progress, d, {
      conversation_excerpt: "user: ¿Los premios que he ganado?",
      user_message: "¿Los premios que he ganado?",
      brand_signals: {
        identity_or_positioning: [],
        audiences: [],
        offer_or_roles: [],
        differentiators: [],
        credibility_assets: ["Premio de estrategia 2024"],
        tone_or_limbic_cues: [],
        guardrails: [],
      },
    });

    expect(d.user_intent).toBe("ask_credentials");
    expect(enriched.next_step).toMatch(/logros|casos|autoridad/i);
    expect(enriched.next_step).not.toMatch(/^¿cuál es la prioridad/i);
  });
});
