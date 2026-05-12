import { z } from "zod";

const itemTypeSchema = z.enum([
  "service",
  "solution",
  "product",
  "feature",
  "offer",
  "module",
  "function",
  "use_case",
  "moment",
  "component",
  "program",
  "line_of_action",
  "theme",
  "format",
  "other",
]);

export const putBrandOfferItemsBodySchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string().uuid().optional(),
          item_type: itemTypeSchema,
          title: z.string().trim().min(1).max(200),
          description: z
            .string()
            .trim()
            .max(3000)
            .optional()
            .nullable()
            .transform((v) =>
              v === undefined || v === null || v.length === 0 ? null : v,
            ),
          display_order: z.number().int().min(0),
        })
        .strict(),
    ),
  })
  .strict();

export type PutBrandOfferItemsBody = z.infer<typeof putBrandOfferItemsBodySchema>;
