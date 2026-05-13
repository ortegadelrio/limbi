import type { BrandOfferNature } from "@/types/database";

export const OFFER_NATURE_OPTIONS: readonly {
  value: BrandOfferNature;
  label: string;
}[] = [
  { value: "product", label: "Producto" },
  { value: "service", label: "Servicio" },
  { value: "product_service", label: "Producto + servicio" },
  { value: "experience_event", label: "Experiencia / evento" },
  {
    value: "digital_platform_app_saas",
    label: "Plataforma digital / app / SaaS",
  },
  {
    value: "organization_institution_cause",
    label: "Organización / institución / causa",
  },
  { value: "personal_brand", label: "Marca personal" },
] as const;

export function offerNatureLabelEs(value: string | null | undefined): string {
  if (!value) return "—";
  return OFFER_NATURE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

const OFFER_ITEM_TYPE_LABELS: Record<string, string> = {
  service: "Servicio",
  solution: "Solución",
  product: "Producto",
  feature: "Característica / feature",
  offer: "Oferta",
  module: "Módulo",
  function: "Función",
  use_case: "Caso de uso",
  moment: "Momento / componente de experiencia",
  component: "Componente",
  program: "Programa",
  line_of_action: "Línea de acción",
  theme: "Tema",
  format: "Formato",
  other: "Otro",
};

export function offerItemTypeLabelEs(value: string | null | undefined): string {
  if (!value) return "—";
  return OFFER_ITEM_TYPE_LABELS[value] ?? value;
}
