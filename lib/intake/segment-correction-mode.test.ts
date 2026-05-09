import { describe, expect, it } from "vitest";
import { buildSegmentCorrectionPromptAppendix } from "@/lib/intake/segment-correction-mode";

describe("buildSegmentCorrectionPromptAppendix", () => {
  it("requires a single fused rewrite for additive corrections", () => {
    const out = buildSegmentCorrectionPromptAppendix({
      miniStep: "tailored_what",
      mode: "add",
      priorExtractionJson: "{}",
    });
    expect(out).toMatch(/UNA redacci[oó]n integrada/i);
    expect(out).toMatch(/frase anterior/i);
    expect(out).toMatch(/fusionada/i);
  });
});
