import { z } from "zod";

export const currentDeliverableTypeSchema = z.enum([
  "conference",
  "landing_page",
  "campaign_plan",
  "content_plan",
  "other",
]);

export const deliverableBuildDepthSchema = z.enum([
  "outline",
  "section_draft",
  "full_draft",
]);

export type CurrentDeliverableType = z.infer<typeof currentDeliverableTypeSchema>;
export type DeliverableBuildDepth = z.infer<typeof deliverableBuildDepthSchema>;

export type DeliverableBuildingDetectionInput = {
  user_message: string;
  conversation_excerpt: string;
};

export type DeliverableBuildingDetectionResult = {
  user_has_no_material: boolean;
  current_deliverable_type: CurrentDeliverableType | null;
  current_deliverable_section: string | null;
  deliverable_build_depth: DeliverableBuildDepth;
  should_generate_content_now: boolean;
  deliverable_building_directive: string | null;
  preferred_next_question: string | null;
};

export const DELIVERABLE_BUILDING_MODE_VERSION = "deliverable-building-mode-v1" as const;
