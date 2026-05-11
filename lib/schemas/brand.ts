import { z } from "zod";
import {
  isValidHttpUrl,
  normalizeWebsiteUrl,
} from "@/lib/brands/normalize-website-url";

export const brandOfferNatureSchema = z.enum([
  "product",
  "service",
  "product_service",
  "experience_event",
  "digital_platform_app_saas",
  "organization_institution_cause",
  "personal_brand",
]);

export const brandStatusSchema = z.enum(["new", "existing", "in_progress"]);

export const createBrandBodySchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio."),
    offer_nature: brandOfferNatureSchema,
    description: z.string().trim().max(20_000).optional(),
    brand_status: brandStatusSchema.optional(),
    website_url: z
      .union([z.string().max(2048), z.literal("")])
      .optional()
      .transform((raw) => {
        if (raw === undefined) return undefined;
        const n = normalizeWebsiteUrl(raw);
        if (n === "") return undefined;
        return n;
      })
      .refine((v) => v === undefined || (isValidHttpUrl(v) && v.length <= 2048), {
        message: "URL inválida.",
      }),
    country_or_market: z.string().trim().max(500).optional(),
  })
  .strict()
  .transform((data) => ({
    ...data,
    description:
      data.description && data.description.length > 0
        ? data.description
        : undefined,
    country_or_market:
      data.country_or_market && data.country_or_market.length > 0
        ? data.country_or_market
        : undefined,
  }));

export const patchBrandBodySchema = z
  .object({
    name: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(20_000).nullable().optional(),
    brand_status: brandStatusSchema.optional(),
    website_url: z
      .union([z.string().max(2048), z.literal("")])
      .nullable()
      .optional()
      .transform((raw) => {
        if (raw === undefined) return undefined;
        if (raw === null) return null;
        const n = normalizeWebsiteUrl(raw);
        if (n === "") return null;
        return n;
      })
      .refine(
        (v) =>
          v === undefined ||
          v === null ||
          (isValidHttpUrl(v) && v.length <= 2048),
        { message: "URL inválida." },
      ),
    country_or_market: z.string().trim().max(500).nullable().optional(),
    offer_nature: brandOfferNatureSchema.optional(),
  })
  .strict()
  .refine(
    (o) =>
      o.name !== undefined ||
      o.description !== undefined ||
      o.brand_status !== undefined ||
      o.website_url !== undefined ||
      o.country_or_market !== undefined ||
      o.offer_nature !== undefined,
    { message: "Envía al menos un campo para actualizar." },
  );

export type CreateBrandBody = z.infer<typeof createBrandBodySchema>;
export type PatchBrandBody = z.infer<typeof patchBrandBodySchema>;
