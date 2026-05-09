import { describe, expect, it } from "vitest";
import { isClarificationHelpSeekingUserMessage } from "@/lib/questionnaire-evaluation/clarification-help-intent";

describe("isClarificationHelpSeekingUserMessage", () => {
  it("detects common Spanish help asks", () => {
    expect(isClarificationHelpSeekingUserMessage("No entiendo")).toBe(true);
    expect(isClarificationHelpSeekingUserMessage("¿Qué me recomiendas?")).toBe(true);
    expect(isClarificationHelpSeekingUserMessage("Qué podría poner aquí")).toBe(true);
    expect(isClarificationHelpSeekingUserMessage("Dame ejemplos")).toBe(true);
    expect(isClarificationHelpSeekingUserMessage("Ayúdame")).toBe(true);
    expect(isClarificationHelpSeekingUserMessage("No sé qué responder")).toBe(true);
  });

  it("does not flag concrete narrative answers", () => {
    expect(
      isClarificationHelpSeekingUserMessage(
        "Llevamos 6 años con colegios en zona norte y protocolos revisados con las familias.",
      ),
    ).toBe(false);
  });
});
