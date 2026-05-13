import { z } from "zod";
import {
  assertPublicExplorableHttpUrl,
  BRAND_WEB_EXPLORE_URL_HELP_ES,
  normalizeWebsiteUrl,
  sanitizeWebsiteUrlInput,
} from "@/lib/brands/normalize-website-url";

export const brandDocumentTypeSchema = z.enum([
  "manual",
  "brief",
  "deck",
  "portfolio",
  "study",
  "strategy",
  "institutional",
  "success_case",
  "other",
]);

/** FormData / JSON para crear documento (el archivo va aparte en multipart). */
export const createBrandDocumentFormSchema = z.object({
  document_type: brandDocumentTypeSchema,
});

export type CreateBrandDocumentForm = z.infer<typeof createBrandDocumentFormSchema>;

/** JSON para iniciar subida directa a Storage (sin binario en el route). */
export const prepareBrandDocumentUploadSchema = z.object({
  file_name: z.string().min(1).max(512),
  file_type: z.string().max(256).optional().default(""),
  file_size_bytes: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER),
  document_type: brandDocumentTypeSchema,
});

export type PrepareBrandDocumentUploadInput = z.infer<
  typeof prepareBrandDocumentUploadSchema
>;

export const completeBrandDocumentUploadSchema = z
  .object({
    status: z.enum(["failed"]).optional(),
    error: z.string().max(4000).optional(),
  })
  .refine(
    (d) =>
      d.status !== "failed" ||
      (typeof d.error === "string" && d.error.trim().length > 0),
    { message: "Se requiere `error` cuando `status` es failed.", path: ["error"] },
  );

export type CompleteBrandDocumentUploadInput = z.infer<
  typeof completeBrandDocumentUploadSchema
>;

/** Exploración controlada de sitio web público (Ticket H.2). */
export const brandWebExploreRequestSchema = z.object({
  entry_url: z
    .string()
    .max(2048)
    .transform((raw) => normalizeWebsiteUrl(sanitizeWebsiteUrlInput(raw)))
    .superRefine((val, ctx) => {
      if (!val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: BRAND_WEB_EXPLORE_URL_HELP_ES,
        });
        return;
      }
      try {
        assertPublicExplorableHttpUrl(val);
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: e instanceof Error ? e.message : BRAND_WEB_EXPLORE_URL_HELP_ES,
        });
      }
    }),
  document_type: brandDocumentTypeSchema.optional().default("other"),
});

export type BrandWebExploreRequest = z.infer<typeof brandWebExploreRequestSchema>;
