import { describe, expect, it } from "vitest";
import {
  BRAND_BASES_EXECUTIVE_DISCLAIMER_ES,
  brandKnowledgeUiHasCredibilityBlock,
  buildBrandBaseSectionViews,
  buildBrandKnowledgeUiModel,
} from "@/lib/brands/brand-bases-consolidated-ui";
import { brandBaseConsolidationRawOutputSchema } from "@/lib/schemas/brand-base-consolidation";

describe("buildBrandKnowledgeUiModel", () => {
  it("compatibilidad v1.0: usa curator como ejecutiva y pilares como fallback de secciones", () => {
    const ui = buildBrandKnowledgeUiModel({
      curator_reading: "Síntesis curadora legada.",
      strategic_pillars: [
        { title: "Pilar A", body: "Texto del pilar." },
        { title: "Pilar B", body: "Otro cuerpo." },
      ],
      restrictions_and_alerts: "Restricciones.",
      evidence_narrative: "Evidencia.",
    });
    expect(ui.executiveReading).toBe("Síntesis curadora legada.");
    expect(ui.sectionInterpretations).toHaveLength(0);
    expect(ui.strategicPillars).toHaveLength(2);
    expect(ui.finalHighlights).toBeNull();
    expect(ui.offerArchitecture).toBeNull();
    expect(ui.credibilityArchitecture).toBeNull();
  });

  it("v1.1: respeta executive y secciones", () => {
    const ui = buildBrandKnowledgeUiModel({
      curator_reading: "Curador.",
      strategic_pillars: [{ title: "P", body: "B" }],
      restrictions_and_alerts: "R",
      evidence_narrative: "E",
      executive_reading: "Ejecutiva explícita.",
      section_interpretations: [
        {
          section_key: "identity",
          headline: "Identidad",
          brand_information: "La marca se presenta como consultora con foco regional.",
          interpretation: "Interpretación identidad.",
        },
      ],
      final_highlights: {
        key_strengths: ["a", "b"],
        strategic_tensions: ["t"],
        communication_opportunities: ["o", "p"],
        key_limbic_signals: ["l", "m"],
        narrative_care_and_avoids: ["n", "o"],
      },
      internal_base_notice: "Interno.",
      project_readiness_message: "Proyectos.",
      offer_architecture: {
        offer_nature: "product_service",
        offer_summary: "Resumen de oferta.",
        service_catalog: [
          {
            name: "Servicio demo",
            item_type: "service",
            description: "Desc",
            strategic_role: "Rol",
            main_value: "Valor",
          },
        ],
        commercial_use_guidance: "Usar el catálogo tal cual en piezas comerciales.",
      },
      credibility_architecture: {
        authority_signals: [],
        institutional_roles: [],
        industry_leadership_assets: [],
        founder_credentials: [],
        business_ecosystem: [],
        reputation_proof_points: [],
        communication_use_guidance:
          "Sin trayectoria o roles adicionales declarados en las fuentes actuales; completar evidencia cuando aplique.",
        cautions: [],
      },
    });
    expect(ui.executiveReading).toBe("Ejecutiva explícita.");
    expect(ui.sectionInterpretations).toHaveLength(1);
    expect(ui.sectionInterpretations[0]?.brandInformation).toContain("consultora");
    expect(ui.sectionInterpretations[0]?.limbiReading).toContain("Interpretación");
    const views = buildBrandBaseSectionViews(ui);
    expect(views.some((v) => v.id === "identity" && v.brandInformation)).toBe(true);
    expect(ui.finalHighlights?.key_strengths).toHaveLength(2);
    expect(ui.internalBaseNotice).toBe("Interno.");
    expect(ui.offerArchitecture?.service_catalog).toHaveLength(1);
    expect(ui.offerArchitecture?.service_catalog[0]?.name).toBe("Servicio demo");
    expect(brandKnowledgeUiHasCredibilityBlock(ui.credibilityArchitecture)).toBe(true);
    expect(ui.credibilityArchitecture?.communication_use_guidance.length).toBeGreaterThan(10);
  });

  it("disclaimer estable", () => {
    expect(BRAND_BASES_EXECUTIVE_DISCLAIMER_ES.length).toBeGreaterThan(80);
  });

  it("v1.2: current_evidence / UNEMEC entra en credibility_architecture y el schema lo acepta", () => {
    const section = (section_key: string) => ({
      section_key,
      headline: `Lectura ${section_key}`,
      brand_information:
        "Resumen fiel de lo diligenciado en el cuestionario para esta sección, con datos concretos y redacción clara.",
      interpretation:
        "Párrafo interpretativo con densidad suficiente para la sección. Desarrollamos qué implica para la marca, qué ofrece y qué tensiones aparecen sin inventar hechos.",
    });
    const credibility = {
      authority_signals: ["Trayectoria reconocida en el sector según lo declarado por la marca."],
      institutional_roles: ["Miembro de junta de UNEMEC (Unión de Empresas de Marketing y Comunicaciones de Colombia)."],
      industry_leadership_assets: [
        "Fundación de COMARKA (Red de Empresas de Comunicación y Marketing del Caribe Colombiano).",
        "Creación y organización de Perrenque Creativo, congreso sectorial del Caribe.",
      ],
      founder_credentials: ["Fundador de Agencia Pópuli y otras iniciativas citadas en evidencia."],
      business_ecosystem: [
        "Agencia Pópuli",
        "2HPRO",
        "Prologi",
        "Kumma",
      ].map((n) => `Empresa o iniciativa citada: ${n}.`),
      reputation_proof_points: [
        "Participación en junta UNEMEC y ecosistema de compañías complementarias descritas por el usuario.",
      ],
      communication_use_guidance:
        "Usar estos datos como respaldo reputacional en perfil corporativo, brochure, pitch institucional y bio de conferencista; no listarlos como catálogo de servicios.",
      cautions: [
        "La formulación «líder de industria» aparece como autodescripción: usar con tono sobrio y sin amplificar más allá del texto.",
      ],
    };
    const raw = {
      knowledge_base: {
        curator_reading: "Lectura curadora global.",
        strategic_pillars: [{ title: "Pilar", body: "Cuerpo del pilar con detalle estratégico." }],
        restrictions_and_alerts: "Nada que alertar de ejemplo.",
        evidence_narrative: "Evidencia resumida con peso en credibilidad institucional.",
        executive_reading: "Lectura ejecutiva en varios párrafos con foco en decisiones.",
        section_interpretations: [
          section("identity"),
          section("offer"),
          section("audiences"),
          section("value_proposition"),
          section("differentiators"),
          section("evidence"),
          section("voice_tone"),
          section("restrictions"),
        ],
        final_highlights: {
          key_strengths: ["Fortaleza 1", "Fortaleza 2"],
          strategic_tensions: ["Tensión 1"],
          communication_opportunities: ["Oportunidad 1", "Oportunidad 2"],
          key_limbic_signals: ["Señal 1", "Señal 2"],
          narrative_care_and_avoids: ["Cuidado 1", "Cuidado 2"],
        },
        internal_base_notice: "La base completa queda guardada para uso interno.",
        project_readiness_message: "La marca está razonablemente lista para iniciar proyectos.",
        offer_architecture: {
          offer_nature: "service",
          offer_summary: "Resumen de oferta distinto del ecosistema de credibilidad.",
          service_catalog: [],
          commercial_use_guidance:
            "Listá solo servicios del catálogo estructurado; las credenciales van en credibility_architecture, no acá.",
        },
        credibility_architecture: credibility,
      },
      limbic_base: {
        symbolic_reading: "Lectura simbólica.",
        atmosphere_and_metaphor: "Metáfora.",
        rhythm_and_energy: "Ritmo.",
        expressive_codes: "Códigos.",
        non_literal_guidance: "Usar como brújula, no como copy.",
        symbolic_restrictions: "No literalizar.",
      },
    };
    const parsed = brandBaseConsolidationRawOutputSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const ui = buildBrandKnowledgeUiModel(parsed.data.knowledge_base as unknown as Record<string, unknown>);
    expect(ui.credibilityArchitecture?.institutional_roles.some((s) => s.includes("UNEMEC"))).toBe(
      true,
    );
    expect(ui.credibilityArchitecture?.industry_leadership_assets.some((s) => s.includes("COMARKA"))).toBe(
      true,
    );
    expect(ui.credibilityArchitecture?.industry_leadership_assets.some((s) => s.includes("Perrenque"))).toBe(
      true,
    );
    expect(ui.credibilityArchitecture?.business_ecosystem.join(" ")).toMatch(/2HPRO|Prologi|Kumma/);
    expect(ui.offerArchitecture?.service_catalog).toHaveLength(0);
  });
});
