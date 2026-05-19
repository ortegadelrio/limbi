import type { BrandKnowledgeUpdateSectionKey } from "@/lib/brands/brand-knowledge-update-types";

/** Estado visible por sección en el hub «Información de marca». */
export type BrandKnowledgeHubSectionStatus =
  | "updated"
  | "pending_review"
  | "pending_consolidation";

export type BrandKnowledgeHubSectionDef = {
  /** Clave para `brand_knowledge_updates.section_key`. */
  updateSectionKey: BrandKnowledgeUpdateSectionKey;
  label: string;
  /** Sección del cuestionario (`?section=`). */
  questionnaireSectionKey: string | null;
  /** Claves en `section_interpretations` de la base consolidada. */
  baseSectionKeys: string[];
  /** Si el resumen viene del payload límbico activo. */
  usesLimbicBase?: boolean;
};

export const BRAND_KNOWLEDGE_HUB_INTRO_ES =
  "Aquí puedes revisar y actualizar lo que Limbi sabe de esta marca. Corrige información existente o agrega novedades por sección. Limbi solo usará los cambios cuando estén aprobados e incorporados en la Base de Marca.";

/** Secciones del hub (orden de producto). */
export const BRAND_KNOWLEDGE_HUB_SECTIONS: BrandKnowledgeHubSectionDef[] = [
  {
    updateSectionKey: "identity",
    label: "Identidad",
    questionnaireSectionKey: "identity",
    baseSectionKeys: ["identity"],
  },
  {
    updateSectionKey: "offer",
    label: "Oferta / servicios",
    questionnaireSectionKey: "offer",
    baseSectionKeys: ["offer"],
  },
  {
    updateSectionKey: "audience",
    label: "Audiencias",
    questionnaireSectionKey: "audiences",
    baseSectionKeys: ["audiences", "audience"],
  },
  {
    updateSectionKey: "value_proposition",
    label: "Propuesta de valor",
    questionnaireSectionKey: "value_proposition",
    baseSectionKeys: ["value_proposition"],
  },
  {
    updateSectionKey: "differentiators",
    label: "Diferenciales",
    questionnaireSectionKey: "differentiation",
    baseSectionKeys: ["differentiators", "differentiation", "positioning"],
  },
  {
    updateSectionKey: "credibility",
    label: "Credenciales / logros",
    questionnaireSectionKey: "evidence",
    baseSectionKeys: ["evidence", "proof", "credibility"],
  },
  {
    updateSectionKey: "voice_tone",
    label: "Voz y tono",
    questionnaireSectionKey: "voice_tone_messages",
    baseSectionKeys: ["voice_tone", "voice_tone_messages"],
  },
  {
    updateSectionKey: "restrictions",
    label: "Restricciones",
    questionnaireSectionKey: "restrictions",
    baseSectionKeys: ["restrictions"],
  },
  {
    updateSectionKey: "limbic",
    label: "Base Límbica",
    questionnaireSectionKey: "brand_limbic_base",
    baseSectionKeys: [],
    usesLimbicBase: true,
  },
];

export function brandKnowledgeHubStatusLabelEs(
  status: BrandKnowledgeHubSectionStatus,
): string {
  switch (status) {
    case "updated":
      return "Actualizada";
    case "pending_review":
      return "Pendiente de revisión";
    case "pending_consolidation":
      return "Pendiente de consolidar";
  }
}
