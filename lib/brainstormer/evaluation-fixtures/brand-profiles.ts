/**
 * Perfiles de marca genéricos para evaluación (NO producción en runtime).
 * Ortegadelrio y marcas reales solo en fixtures de test dedicados.
 */

export type EvaluationBrandProfile = {
  id: string;
  kind:
    | "personal_brand"
    | "agency"
    | "event"
    | "product"
    | "foundation"
    | "saas"
    | "b2b_industrial";
  brand_name: string;
  identity_or_positioning: string[];
  audiences: string[];
  offer_or_roles: string[];
  credibility_assets: string[];
  user_opening: string;
  expected_challenge_pattern: RegExp;
};

export const EVALUATION_BRAND_PROFILES: EvaluationBrandProfile[] = [
  {
    id: "personal-brand",
    kind: "personal_brand",
    brand_name: "Marca Personal Demo",
    identity_or_positioning: ["Consultoría estratégica y conferencias"],
    audiences: ["Directivos de PYME"],
    offer_or_roles: ["Conferencias", "Consultoría"],
    credibility_assets: ["15 años en marketing", "Premio regional de estrategia"],
    user_opening: "Quiero mejorar mi posicionamiento para conseguir conferencias",
    expected_challenge_pattern: /conferencias|posicionamiento/i,
  },
  {
    id: "agency",
    kind: "agency",
    brand_name: "Agencia Norte",
    identity_or_positioning: ["Agencia creativa B2B"],
    audiences: ["Marcas medianas"],
    offer_or_roles: ["Campañas integradas", "Branding"],
    credibility_assets: ["Caso retail +32% awareness", "Equipo senior multidisciplinario"],
    user_opening: "Necesitamos un plan de contenido para el próximo trimestre",
    expected_challenge_pattern: /contenido|plan/i,
  },
  {
    id: "event",
    kind: "event",
    brand_name: "Festival Aurora",
    identity_or_positioning: ["Festival cultural anual"],
    audiences: ["Público joven urbano"],
    offer_or_roles: ["Entradas", "Patrocinios"],
    credibility_assets: ["Edición anterior con 12k asistentes"],
    user_opening: "Cómo promovemos el festival y vendemos más entradas",
    expected_challenge_pattern: /promover|evento|ventas/i,
  },
  {
    id: "product",
    kind: "product",
    brand_name: "Producto Vita",
    identity_or_positioning: ["Suplemento premium D2C"],
    audiences: ["Adultos 35-55"],
    offer_or_roles: ["Suscripción mensual"],
    credibility_assets: ["Estudio clínico publicado", "Reseñas verificadas"],
    user_opening: "Quiero vender más unidades este mes",
    expected_challenge_pattern: /ventas|conversi/i,
  },
  {
    id: "foundation",
    kind: "foundation",
    brand_name: "Fundación Horizonte",
    identity_or_positioning: ["Educación rural"],
    audiences: ["Donantes institucionales"],
    offer_or_roles: ["Programas educativos"],
    credibility_assets: ["Alianza con ministerio", "Impacto en 40 comunidades"],
    user_opening: "Armar una campaña de recaudación para el programa escolar",
    expected_challenge_pattern: /campaña|recaudaci/i,
  },
  {
    id: "saas",
    kind: "saas",
    brand_name: "App Flowdesk",
    identity_or_positioning: ["SaaS de productividad para equipos remotos"],
    audiences: ["Startups tech"],
    offer_or_roles: ["Plan Pro", "Enterprise"],
    credibility_assets: ["Integración con herramientas líderes", "NPS 62"],
    user_opening: "Cómo posicionamos la app frente a competidores más baratos",
    expected_challenge_pattern: /posicionamiento/i,
  },
  {
    id: "b2b-industrial",
    kind: "b2b_industrial",
    brand_name: "Industrias Kova",
    identity_or_positioning: ["Componentes industriales B2B"],
    audiences: ["Ingenieros de planta"],
    offer_or_roles: ["Catálogo técnico", "Servicio postventa"],
    credibility_assets: ["Certificación ISO", "Planta con 30 años de operación"],
    user_opening: "Necesitamos un video técnico para lanzar la nueva línea",
    expected_challenge_pattern: /audiovisual|video/i,
  },
];
