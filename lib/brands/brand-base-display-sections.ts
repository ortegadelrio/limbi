/** Secciones visibles en `/bases` (orden de producto). */
export type BrandBaseUiSectionDef = {
  id: string;
  label: string;
  /** Claves en `section_interpretations` del payload consolidado. */
  interpretationKeys: string[];
};

export const BRAND_BASE_UI_SECTIONS: BrandBaseUiSectionDef[] = [
  { id: "identity", label: "Identidad", interpretationKeys: ["identity"] },
  { id: "offer", label: "Oferta / servicios", interpretationKeys: ["offer"] },
  { id: "audiences", label: "Audiencias", interpretationKeys: ["audiences", "audience"] },
  {
    id: "value_proposition",
    label: "Propuesta de valor",
    interpretationKeys: ["value_proposition"],
  },
  {
    id: "differentiators",
    label: "Diferenciales",
    interpretationKeys: ["differentiators", "differentiation", "positioning"],
  },
  {
    id: "evidence",
    label: "Credenciales / respaldo",
    interpretationKeys: ["evidence", "proof", "credibility"],
  },
  {
    id: "voice_tone",
    label: "Voz y tono",
    interpretationKeys: ["voice_tone", "voice_tone_messages"],
  },
  { id: "restrictions", label: "Restricciones", interpretationKeys: ["restrictions"] },
];

export const BRAND_BASE_LIMBIC_SECTION_LABEL = "Base Límbica";
