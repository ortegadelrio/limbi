import { describe, expect, it } from "vitest";
import {
  intakeExtractionOutputSchema,
  parseIntakeExtractionOutput,
} from "@/lib/intake/extraction-schema";

describe("parseIntakeExtractionOutput", () => {
  it("accepts a minimal valid extraction payload", () => {
    const raw = {
      extracted_response_updates: {
        strategic_base: {
          simple_description: "We sell ergonomic desks for remote teams.",
          offering_type: "product",
          problem_category: "lack_clarity",
        },
      },
      confidence_by_field: {
        "strategic_base.simple_description": 0.9,
      },
      needs_follow_up: false,
      follow_up_question: null,
      suggested_answer_chips: [],
      answer_status: "clear",
      target_response_paths: ["strategic_base.simple_description"],
      internal_notes: "ok",
      public_copy_allowed: false,
    };
    const r = parseIntakeExtractionOutput(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.needs_follow_up).toBe(false);
    }
  });

  it("rejects invalid answer_status", () => {
    const r = parseIntakeExtractionOutput({
      needs_follow_up: false,
      follow_up_question: null,
      answer_status: "nope",
    });
    expect(r.ok).toBe(false);
  });

  it("applies defaults for optional arrays", () => {
    const parsed = intakeExtractionOutputSchema.parse({
      needs_follow_up: false,
      follow_up_question: null,
      answer_status: "skipped",
      internal_notes: "",
      public_copy_allowed: false,
    });
    expect(parsed.suggested_answer_chips).toEqual([]);
    expect(parsed.confidence_by_field).toEqual({});
  });
});
