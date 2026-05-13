import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { brandBaseConsolidationRawOutputSchema } from "@/lib/schemas/brand-base-consolidation";
import {
  assessKnowledgePayloadForProjectContract,
  assessLimbicPayloadForProjectContract,
  BRAND_CONTEXT_INTERPRETIVE_RULES_FOR_PROJECTS_ES,
  deriveActiveBrandContextBlockingReasons,
  pickSourceTraceFromSnapshot,
} from "@/lib/brands/load-active-brand-context-for-project";

describe("deriveActiveBrandContextBlockingReasons", () => {
  it("lista ausencia de bases y staleness en orden estable", () => {
    expect(
      deriveActiveBrandContextBlockingReasons({
        has_knowledge: false,
        has_limbic: false,
        knowledge_stale: false,
        limbic_stale: false,
        pending_source_facts_review: false,
        diagnosis_stale: false,
      }),
    ).toEqual(["no_active_knowledge_base", "no_active_limbic_base"]);
  });

  it("marca bases stale solo cuando existen", () => {
    expect(
      deriveActiveBrandContextBlockingReasons({
        has_knowledge: false,
        has_limbic: true,
        knowledge_stale: true,
        limbic_stale: true,
        pending_source_facts_review: false,
        diagnosis_stale: false,
      }),
    ).toEqual(["no_active_knowledge_base", "limbic_base_stale"]);
  });

  it("prioriza hallazgos pendientes y diagnóstico obsoleto", () => {
    expect(
      deriveActiveBrandContextBlockingReasons({
        has_knowledge: true,
        has_limbic: true,
        knowledge_stale: false,
        limbic_stale: false,
        pending_source_facts_review: true,
        diagnosis_stale: true,
      }),
    ).toEqual(["pending_source_facts_review", "diagnosis_stale"]);
  });
});

describe("assessKnowledgePayloadForProjectContract", () => {
  it("conserva service_catalog cuando el payload es v1.2 válido", () => {
    const z = brandBaseConsolidationRawOutputSchema.safeParse({
      knowledge_base: {
        curator_reading: "x",
        strategic_pillars: [{ title: "t", body: "b" }],
        restrictions_and_alerts: "r",
        evidence_narrative: "e",
        executive_reading: "ex",
        section_interpretations: [
          "identity",
          "offer",
          "audiences",
          "value_proposition",
          "differentiators",
          "evidence",
          "voice_tone",
          "restrictions",
        ].map((section_key) => ({
          section_key,
          headline: "h",
          interpretation: "i",
        })),
        final_highlights: {
          key_strengths: ["a", "b"],
          strategic_tensions: ["c"],
          communication_opportunities: ["d", "e"],
          key_limbic_signals: ["f", "g"],
          narrative_care_and_avoids: ["h", "i"],
        },
        internal_base_notice: "n",
        project_readiness_message: "p",
        offer_architecture: {
          offer_nature: "service",
          offer_summary: "sum",
          service_catalog: [
            {
              name: "Servicio A",
              item_type: "service",
              description: "d",
              strategic_role: "r",
              main_value: "v",
            },
          ],
          commercial_use_guidance: "g",
        },
        credibility_architecture: {
          authority_signals: [],
          institutional_roles: [],
          industry_leadership_assets: [],
          founder_credentials: [],
          business_ecosystem: [],
          reputation_proof_points: [],
          communication_use_guidance: "Sin datos de credibilidad extra en esta prueba.",
          cautions: [],
        },
      },
      limbic_base: {
        symbolic_reading: "s",
        atmosphere_and_metaphor: "a",
        rhythm_and_energy: "r",
        expressive_codes: "e",
        non_literal_guidance: "n",
        symbolic_restrictions: "x",
      },
    });
    expect(z.success).toBe(true);
    if (!z.success) return;
    const r = assessKnowledgePayloadForProjectContract(
      z.data.knowledge_base as unknown as Record<string, unknown>,
    );
    expect(r.service_catalog_length).toBe(1);
    expect(r.gaps.length).toBe(0);
  });
});

describe("assessLimbicPayloadForProjectContract", () => {
  it("exige los seis campos string del schema límbico", () => {
    expect(assessLimbicPayloadForProjectContract({}).gaps.length).toBeGreaterThan(0);
    expect(
      assessLimbicPayloadForProjectContract({
        symbolic_reading: "a",
        atmosphere_and_metaphor: "b",
        rhythm_and_energy: "c",
        expressive_codes: "d",
        non_literal_guidance: "e",
        symbolic_restrictions: "f",
      }).gaps,
    ).toEqual([]);
  });
});

describe("pickSourceTraceFromSnapshot", () => {
  it("lee source_trace o sourceTrace del snapshot", () => {
    expect(pickSourceTraceFromSnapshot({ source_trace: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(pickSourceTraceFromSnapshot({ sourceTrace: "x" })).toBe("x");
  });
});

describe("interpretive rules (proyectos)", () => {
  it("deja explícito carácter simbólico de la Base Límbica y uso de service_catalog", () => {
    const t = BRAND_CONTEXT_INTERPRETIVE_RULES_FOR_PROJECTS_ES.join(" ");
    expect(t).toMatch(/simb[oó]lic/i);
    expect(t).toContain("service_catalog");
    expect(t).toMatch(/restricciones/i);
  });
});

describe("load-active-brand-context-for-project.ts contract", () => {
  const src = readFileSync(
    new URL("./load-active-brand-context-for-project.ts", import.meta.url),
    "utf8",
  );

  it("no consulta brand_responses como fuente de contexto", () => {
    expect(src).not.toMatch(/from\("brand_responses"\)/);
  });

  it("no consulta brand_documents ni extracciones", () => {
    expect(src).not.toMatch(/brand_document_extractions/);
    expect(src).not.toMatch(/from\("brand_documents"\)/);
  });

  it("marca timestamp de generación en Hora Bogotá vía formatBogotaDateTime", () => {
    expect(src).toContain("formatBogotaDateTime");
    expect(src).toContain("generated_at_bogota");
  });
});

describe("load-brand-bases-state.ts contract (bases superseded)", () => {
  it("filtra superseded_at nulo al leer bases activas", () => {
    const p = new URL("./load-brand-bases-state.ts", import.meta.url);
    const s = readFileSync(p, "utf8");
    expect(s).toContain('.is("superseded_at", null)');
  });
});
