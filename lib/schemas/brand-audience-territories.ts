import { z } from "zod";

const territoryTypeSchema = z.enum([
  "city",
  "state_department",
  "region",
  "country",
  "continent",
  "cultural_community",
  "global_market",
]);

export const putBrandAudienceTerritoriesBodySchema = z
  .object({
    territories: z.array(
      z
        .object({
          id: z.string().uuid().optional(),
          territory_type: territoryTypeSchema,
          name: z.string().trim().min(1).max(200),
          display_order: z.number().int().min(0),
        })
        .strict(),
    ),
  })
  .strict();

export type PutBrandAudienceTerritoriesBody = z.infer<
  typeof putBrandAudienceTerritoriesBodySchema
>;
