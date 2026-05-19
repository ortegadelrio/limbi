export {
  detectContentGenerationRequest,
  detectDeliverableBuilding,
  detectUserDeclaredNoMaterial,
  extractCurrentDeliverableSection,
  inferCurrentDeliverableType,
} from "@/lib/brainstormer/deliverable-building-mode/detect-deliverable-building";
export {
  DELIVERABLE_BUILDING_MODE_VERSION,
  type CurrentDeliverableType,
  type DeliverableBuildDepth,
  type DeliverableBuildingDetectionResult,
} from "@/lib/brainstormer/deliverable-building-mode/types";
