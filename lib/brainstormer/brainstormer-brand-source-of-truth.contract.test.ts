import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildBrainstormerOpenAIInput } from "@/lib/brainstormer/build-brainstormer-openai-input";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "../..");

/** Tablas que Brainstormer no debe consultar para armar contexto de marca. */
const FORBIDDEN_SUPABASE_TABLES = [
  "brand_responses",
  "brand_knowledge_updates",
  "brand_source_facts",
  "brand_documents",
  "brand_document_extractions",
  "brand_improvement_sessions",
  "brand_improvement_messages",
  "brand_section_improvements",
] as const;

const ALLOWED_BRAND_TABLES = new Set([
  "brands",
  "brand_knowledge_bases",
  "brand_limbic_bases",
  "brainstorm_sessions",
  "brainstorm_messages",
  "brainstorm_session_snapshots",
]);

function collectTsFiles(dir: string, acc: string[] = []): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return acc;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === "evaluation-fixtures") continue;
      collectTsFiles(full, acc);
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

function findForbiddenTableQueries(src: string): string[] {
  const hits: string[] = [];
  const re = /\.from\(\s*["']([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const table = m[1]!;
    if (FORBIDDEN_SUPABASE_TABLES.includes(table as (typeof FORBIDDEN_SUPABASE_TABLES)[number])) {
      hits.push(table);
    }
    if (table.startsWith("brand_") && !ALLOWED_BRAND_TABLES.has(table)) {
      hits.push(table);
    }
  }
  return hits;
}

describe("Brainstormer — contrato fuente de verdad de marca", () => {
  const scanRoots = [
    path.join(REPO_ROOT, "lib/brainstormer"),
    path.join(REPO_ROOT, "app/api/brainstormer"),
  ];

  for (const root of scanRoots) {
    it(`sin queries prohibidas en ${path.relative(REPO_ROOT, root)}`, () => {
      const files = collectTsFiles(root);
      const violations: string[] = [];
      for (const file of files) {
        const src = readFileSync(file, "utf8");
        const hits = findForbiddenTableQueries(src);
        if (hits.length > 0) {
          violations.push(`${path.relative(REPO_ROOT, file)}: ${[...new Set(hits)].join(", ")}`);
        }
      }
      expect(violations).toEqual([]);
    });
  }

  it("prepareBrainstormSessionContext persiste ids de bases usadas", () => {
    const src = readFileSync(
      path.join(__dirname, "create-brainstorm-session-context.ts"),
      "utf8",
    );
    expect(src).toContain("brand_knowledge_base_id_used");
    expect(src).toContain("brand_limbic_base_id_used");
    expect(src).toContain("loadActiveBrandContextForProject");
  });

  it("turnos resuelven contexto de marca vía resolveBrainstormBrandContextForTurn", () => {
    const turn = readFileSync(path.join(__dirname, "run-brainstormer-assistant-turn.ts"), "utf8");
    const resolveSrc = readFileSync(
      path.join(__dirname, "resolve-brainstorm-brand-context-for-turn.ts"),
      "utf8",
    );
    const audit = readFileSync(path.join(__dirname, "audit-brainstormer-context.ts"), "utf8");
    expect(turn).toContain("resolveBrainstormBrandContextForTurn");
    expect(resolveSrc).toContain("loadFrozenBrandPayloadsForBrainstormSession");
    expect(resolveSrc).toContain("loadActiveBrandContextForProject");
    expect(audit).toContain("loadFrozenBrandPayloadsForBrainstormSession");
  });

  it("debug-context expone frozen_base_alignment vía audit", () => {
    const route = readFileSync(
      path.join(REPO_ROOT, "app/api/brainstormer/sessions/[sessionId]/debug-context/route.ts"),
      "utf8",
    );
    const audit = readFileSync(path.join(__dirname, "audit-brainstormer-context.ts"), "utf8");
    expect(route).toContain("auditBrainstormerContextForSession");
    expect(audit).toContain("frozen_base_alignment:");
    expect(audit).toContain("knowledge_matches_current_active");
  });

  it("session-readiness delega en prepareBrainstormSessionContext", () => {
    const src = readFileSync(
      path.join(
        REPO_ROOT,
        "app/api/brainstormer/brands/[brandId]/session-readiness/route.ts",
      ),
      "utf8",
    );
    expect(src).toContain("prepareBrainstormSessionContext");
    expect(src).not.toMatch(/\.from\(\s*["']brand_knowledge_updates["']\s*\)/);
  });

  it("buildBrainstormerOpenAIInput solo serializa payloads de bases consolidadas", () => {
    const src = readFileSync(path.join(__dirname, "build-brainstormer-openai-input.ts"), "utf8");
    expect(src).toContain("knowledge_payload");
    expect(src).toContain("limbic_payload");
    expect(src).not.toMatch(/\.from\(\s*["']/);
  });

  it("actualización aprobada no consolidada no aparece en el prompt del turno", () => {
    const orphanUpdateText =
      "AUDITORIAS_ESTRATEGICAS_REPUTACION_DIGITAL_NO_EN_BASE_ACTIVA_xyz";
    const knowledge = {
      executive_reading: "Solo contenido ya consolidado en la base activa.",
    };
    const conversation_director = resolveConversationDirector({
      user_message: "hola",
      conversation_excerpt: "",
      session_progress: emptyBrainstormerSessionProgress(),
      brand_signals: {
        identity_or_positioning: [],
        audiences: [],
        offer_or_roles: [],
        differentiators: [],
        credibility_assets: [],
        tone_or_limbic_cues: [],
        guardrails: [],
      },
      user_message_count: 1,
    });
    const built = buildBrainstormerOpenAIInput({
      brand_name: "Marca test",
      session_title: "Sesión",
      brand_context_status: "ready",
      brand_context_has_pending_updates: true,
      brand_context_blocking_reasons: [],
      session_summary_progress: emptyBrainstormerSessionProgress(),
      conversation_excerpt: "",
      conversation_director,
      knowledge_payload: knowledge,
      limbic_payload: { symbolic_reading: "Atmósfera estable." },
      working_brief_block: "BRAINSTORMER WORKING BRIEF",
      conversation_contract_block: "BRAINSTORMER_CONVERSATION_CONTRACT",
      thinking_model_block: "LIMBI THINKING CANON",
      last_user_message: "hola",
    });
    expect(built.full_input).not.toContain(orphanUpdateText);
    expect(built.full_input).toContain("Solo contenido ya consolidado");
  });
});
