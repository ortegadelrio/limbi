import { describe, expect, it } from "vitest";
import { buildBrandDashboardCascadeBanner } from "@/lib/brands/brand-dashboard-cascade-status";

const href = (d: string, b: string) => ({
  diagnosisHref: d,
  basesHref: b,
});

describe("buildBrandDashboardCascadeBanner", () => {
  it("returns null when pending facts", () => {
    expect(
      buildBrandDashboardCascadeBanner({
        pendingFactsCount: 1,
        consolidationRunning: false,
        hasActiveDiagnosis: true,
        diagnosisIsStale: true,
        hasActiveBases: true,
        basesStale: true,
        ...href("/d", "/b"),
      }),
    ).toBeNull();
  });

  it("prioritizes diagnosis when diagnosis and bases are stale", () => {
    const banner = buildBrandDashboardCascadeBanner({
      pendingFactsCount: 0,
      consolidationRunning: false,
      hasActiveDiagnosis: true,
      diagnosisIsStale: true,
      hasActiveBases: true,
      basesStale: true,
      ...href("/diagnosis", "/bases"),
    });
    expect(banner?.variant).toBe("warning");
    expect(banner?.actions[0]?.label).toBe("Actualizar diagnóstico");
    expect(banner?.actions[0]?.href).toBe("/diagnosis");
    expect(banner?.actions[1]?.label).toBe("Ir a Base de Marca");
  });

  it("shows bases-only message when diagnosis is fresh and bases stale", () => {
    const banner = buildBrandDashboardCascadeBanner({
      pendingFactsCount: 0,
      consolidationRunning: false,
      hasActiveDiagnosis: true,
      diagnosisIsStale: false,
      hasActiveBases: true,
      basesStale: true,
      ...href("/d", "/bases"),
    });
    expect(banner?.headline).toContain("Base de Marca");
    expect(banner?.actions[0]?.label).toBe("Actualizar Base de Marca");
  });

  it("shows diagnosis-only headline when stale and no bases yet", () => {
    const banner = buildBrandDashboardCascadeBanner({
      pendingFactsCount: 0,
      consolidationRunning: false,
      hasActiveDiagnosis: true,
      diagnosisIsStale: true,
      hasActiveBases: false,
      basesStale: false,
      ...href("/d", "/b"),
    });
    expect(banner?.headline).toBe("Hay información nueva después del último diagnóstico.");
  });

  it("shows marca lista when everything is current", () => {
    const banner = buildBrandDashboardCascadeBanner({
      pendingFactsCount: 0,
      consolidationRunning: false,
      hasActiveDiagnosis: true,
      diagnosisIsStale: false,
      hasActiveBases: true,
      basesStale: false,
      ...href("/d", "/b"),
    });
    expect(banner?.variant).toBe("success");
    expect(banner?.headline).toContain("Marca lista");
  });
});
