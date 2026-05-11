import { z } from "zod";
import { brandOfferNatureSchema } from "@/lib/schemas/brand";

export const questionJourneyTypeSchema = z.enum(["brand"]);

export const questionDefinitionsQuerySchema = z
  .object({
    journey_type: questionJourneyTypeSchema,
    offer_nature: brandOfferNatureSchema,
  })
  .strict();

export type QuestionDefinitionsQuery = z.infer<
  typeof questionDefinitionsQuerySchema
>;
