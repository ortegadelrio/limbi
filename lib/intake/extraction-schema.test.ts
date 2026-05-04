import { describe, expect, it } from "vitest";
import {
  intakeExtractionOutputSchema,
  normalizeIntakeExtractionPayload,
  parseIntakeExtractionOutput,
} from "@/lib/intake/extraction-schema";

describe("parseIntakeExtractionOutput", () => {
  it("accepts strategic_validation_question user_intent", () => {
    const r = parseIntakeExtractionOutput({
      needs_follow_up: false,
      follow_up_question: null,
      answer_status: "missing_choice",
      public_copy_allowed: false,
      user_intent: "strategic_validation_question",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.user_intent).toBe("strategic_validation_question");
  });

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
      interviewer_message: "Gracias por el detalle.",
      public_copy_allowed: false,
    };
    const r = parseIntakeExtractionOutput(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.needs_follow_up).toBe(false);
    }
  });

  it("maps unknown answer_status to weak after normalization", () => {
    const r = parseIntakeExtractionOutput({
      needs_follow_up: false,
      follow_up_question: null,
      answer_status: "nope",
      public_copy_allowed: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.answer_status).toBe("weak");
    }
  });

  it("normalizeIntakeExtractionPayload removes unknown keys before Zod", () => {
    const n = normalizeIntakeExtractionPayload({
      needs_follow_up: "true",
      answer_status: "clear",
      public_copy_allowed: "false",
      follow_up_question: null,
      interviewer_message: "x",
      rogue_key: { nested: 1 },
    }) as Record<string, unknown>;
    expect(n.rogue_key).toBeUndefined();
    expect(n.needs_follow_up).toBe(true);
  });

  it("strips unknown top-level keys and coerces string booleans", () => {
    const r = parseIntakeExtractionOutput({
      extra_model_field: 123,
      needs_follow_up: "false",
      follow_up_question: null,
      answer_status: "clear",
      public_copy_allowed: "true",
      interviewer_message: "Hola",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.needs_follow_up).toBe(false);
      expect(r.data.public_copy_allowed).toBe(true);
    }
  });

  it("applies defaults for optional arrays", () => {
    const parsed = intakeExtractionOutputSchema.parse({
      needs_follow_up: false,
      follow_up_question: null,
      answer_status: "skipped",
      internal_notes: "",
      interviewer_message: "",
      public_copy_allowed: false,
    });
    expect(parsed.suggested_answer_chips).toEqual([]);
    expect(parsed.confidence_by_field).toEqual({});
  });

  it("accepts answer_status fallback_saved", () => {
    const parsed = intakeExtractionOutputSchema.parse({
      needs_follow_up: false,
      follow_up_question: null,
      answer_status: "fallback_saved",
      internal_notes: "",
      interviewer_message: "ok",
      public_copy_allowed: false,
    });
    expect(parsed.answer_status).toBe("fallback_saved");
  });
});
