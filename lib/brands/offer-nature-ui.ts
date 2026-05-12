import type { BrandOfferItemType, BrandOfferNature } from "@/types/database";

/** Opciones de naturaleza de marca para UI (español neutro). */
export const BRAND_OFFER_NATURE_UI_OPTIONS: {
  value: BrandOfferNature;
  label: string;
  description?: string;
}[] = [
  { value: "service", label: "Servicio" },
  { value: "product", label: "Producto" },
  { value: "product_service", label: "Producto + servicio" },
  {
    value: "digital_platform_app_saas",
    label: "Plataforma digital / app / SaaS",
  },
  { value: "experience_event", label: "Experiencia / evento" },
  {
    value: "organization_institution_cause",
    label: "Organización / institución / causa",
  },
  { value: "personal_brand", label: "Marca personal" },
];

export function defaultItemTypeForOfferNature(
  nature: BrandOfferNature,
): BrandOfferItemType {
  switch (nature) {
    case "service":
      return "service";
    case "product":
      return "product";
    case "product_service":
      return "offer";
    case "digital_platform_app_saas":
      return "module";
    case "experience_event":
      return "moment";
    case "organization_institution_cause":
      return "program";
    case "personal_brand":
      return "theme";
    default:
      return "other";
  }
}

export function offerSectionAddButtonLabel(nature: BrandOfferNature): string {
  switch (nature) {
    case "service":
      return "+ Agregar servicio o solución";
    case "product":
      return "+ Agregar producto o característica";
    case "product_service":
      return "+ Agregar oferta";
    case "digital_platform_app_saas":
      return "+ Agregar módulo, función o caso de uso";
    case "experience_event":
      return "+ Agregar momento o componente";
    case "organization_institution_cause":
      return "+ Agregar programa o línea de acción";
    case "personal_brand":
      return "+ Agregar tema, formato u oferta";
    default:
      return "+ Agregar ítem";
  }
}
