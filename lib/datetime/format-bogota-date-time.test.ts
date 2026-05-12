import { describe, expect, it } from "vitest";
import { formatBogotaDateTime } from "@/lib/datetime/format-bogota-date-time";

describe("formatBogotaDateTime", () => {
  it("formats UTC instant in America/Bogota and appends Bogotá label", () => {
    const s = formatBogotaDateTime("2026-05-12T21:37:00.000Z");
    expect(s).toContain("Hora Bogotá");
    expect(s).toContain("2026");
    expect(s.toLowerCase()).toContain("mayo");
  });

  it("returns em dash for invalid input", () => {
    expect(formatBogotaDateTime("")).toBe("—");
    expect(formatBogotaDateTime(null)).toBe("—");
  });
});
