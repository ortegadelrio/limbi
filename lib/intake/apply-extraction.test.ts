import { describe, expect, it } from "vitest";
import { applyOfferingPilotExtraction } from "@/lib/intake/apply-extraction";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";

function baseExtraction(
  overrides: Partial<IntakeExtractionOutput> = {},
): IntakeExtractionOutput {
  return {
    extracted_response_updates: {},
    confidence_by_field: {},
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [],
    answer_status: "clear",
    target_response_paths: [],
    internal_notes: "",
    interviewer_message: "",
    public_copy_allowed: false,
    user_intent: "answer",
    ...overrides,
  };
}

describe("applyOfferingPilotExtraction", () => {
  it("fills strategic_base from a clear answer and marks wizard steps 3–5", () => {
    const extraction = baseExtraction({
      extracted_response_updates: {
        strategic_base: {
          simple_description:
            "Plataforma de bienestar que reduce el estrés en equipos.",
          offering_type: "product",
          problem_category: "lack_connection",
          transformation_type: "feel_part_of",
          transformation_from: "desconexión",
          transformation_to: "ritual compartido",
        },
      },
      answer_status: "clear",
    });
    const { mergedResponses, completedStepIndicesToMerge } =
      applyOfferingPilotExtraction({}, extraction);
    const sb = mergedResponses.strategic_base as Record<string, unknown>;
    expect(sb.simple_description).toContain("Plataforma");
    expect(sb.offering_type).toBe("product");
    expect(completedStepIndicesToMerge.sort()).toEqual([3, 4, 5]);
  });

  it("does not mark transformation step without type or limitation", () => {
    const extraction = baseExtraction({
      extracted_response_updates: {
        strategic_base: {
          simple_description: "Un servicio de consultoría estratégica claro.",
          offering_type: "service",
          problem_category: "lack_clarity",
        },
      },
    });
    const { completedStepIndicesToMerge } = applyOfferingPilotExtraction(
      {},
      extraction,
    );
    expect(completedStepIndicesToMerge.sort()).toEqual([3, 4]);
  });

  it("marks step 5 when user skipped transformation via limitations", () => {
    const extraction = baseExtraction({
      extracted_response_updates: {
        strategic_base: {
          simple_description: "Oferta mínima viable para prueba de mercado.",
          offering_type: "solution",
          problem_category: "need_growth",
          guided_intake_limitations_optional: [
            "transformation_unknown",
          ],
        },
      },
      answer_status: "skipped",
    });
    const { completedStepIndicesToMerge } = applyOfferingPilotExtraction(
      {},
      extraction,
    );
    expect(completedStepIndicesToMerge).toContain(5);
  });
});
