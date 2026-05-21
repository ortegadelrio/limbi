import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  formatExternalResearchUserMessage,
  isMockResearchMode,
  isPlaceholderResearchUrl,
  runExternalResearch,
} from "@/lib/brainstormer/run-external-research";

describe("runExternalResearch — mock vs live vs unavailable", () => {
  const env = process.env;

  beforeEach(() => {
    vi.stubEnv("BRAINSTORMER_RESEARCH_MOCK", "1");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  afterEach(() => {
    process.env = env;
    vi.unstubAllEnvs();
  });

  it("mock: hallazgos con approved_for_session false y sin example.com", async () => {
    expect(isMockResearchMode()).toBe(true);
    const result = await runExternalResearch({
      query: "competidores",
      brand_name: "Boringstore",
      session_context: "",
    });
    expect(result.mode).toBe("mock");
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.every((f) => !f.approved_for_session)).toBe(true);
    expect(result.findings.every((f) => !isPlaceholderResearchUrl(f.source_url) || f.source_url.startsWith("limbi://"))).toBe(true);
    expect(result.findings.some((f) => f.source_url.includes("example.com"))).toBe(false);
  });

  it("mock: mensaje visible indica modo prueba", async () => {
    const result = await runExternalResearch({
      query: "competidores",
      brand_name: "Boringstore",
      session_context: "",
    });
    const msg = formatExternalResearchUserMessage(result, "Boringstore");
    expect(msg).toMatch(/simulados de prueba|modo desarrollo/i);
    expect(msg).not.toMatch(/example\.com/i);
  });

  it("sin API key y sin mock → unavailable, no inventa fuentes", async () => {
    vi.stubEnv("BRAINSTORMER_RESEARCH_MOCK", "");
    vi.stubEnv("VITEST", "");
    delete process.env.BRAINSTORMER_RESEARCH_MOCK;
    delete process.env.VITEST;
    vi.stubEnv("OPENAI_API_KEY", "");

    const result = await runExternalResearch({
      query: "competidores",
      brand_name: "Boringstore",
      session_context: "",
    });
    expect(result.mode).toBe("unavailable");
    expect(result.findings).toHaveLength(0);
    const msg = formatExternalResearchUserMessage(result, "Boringstore");
    expect(msg).toMatch(/No pude acceder a búsqueda externa/i);
    expect(msg).not.toMatch(/example\.com/i);
  });
});

describe("isPlaceholderResearchUrl", () => {
  it("rechaza example.com", () => {
    expect(isPlaceholderResearchUrl("https://example.com/referente")).toBe(true);
  });

  it("acepta URL real", () => {
    expect(isPlaceholderResearchUrl("https://www.nytimes.com/article")).toBe(false);
  });
});
