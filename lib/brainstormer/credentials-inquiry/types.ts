export const credentialUtilityCategorySchema = [
  "sector_authority",
  "strategy_proof",
  "creative_proof",
  "audiovisual_proof",
  "industry_leadership",
  "industry_building",
] as const;

export type CredentialUtilityCategory = (typeof credentialUtilityCategorySchema)[number];

export type CategorizedCredential = {
  asset: string;
  category: CredentialUtilityCategory;
  rationale: string;
};
