import { describe, expect, it } from "vitest";
import { classifyBrandKnowledgeUpdate } from "@/lib/brands/classify-brand-knowledge-update";

describe("classifyBrandKnowledgeUpdate", () => {
  it("clasifica nueva oferta como offer con importancia alta", () => {
    const r = classifyBrandKnowledgeUpdate(
      "Ahora también ofrecemos auditorías estratégicas de reputación digital.",
    );
    expect(r.section_key).toBe("offer");
    expect(r.importance_level).toBe("high");
    expect(r.must_include).toBe(true);
    expect(r.interpreted_summary).toContain("auditorías");
  });

  it("clasifica cambio de tono como restrictions o voice_tone", () => {
    const r = classifyBrandKnowledgeUpdate("Ya no queremos sonar institucionales.");
    expect(["restrictions", "voice_tone"]).toContain(r.section_key);
    expect(["critical", "high"]).toContain(r.importance_level);
  });

  it("clasifica premio como credibility", () => {
    const r = classifyBrandKnowledgeUpdate("Ganamos un nuevo premio internacional.");
    expect(r.section_key).toBe("credibility");
    expect(r.importance_level).toBe("high");
  });

  it("no inventa contenido: el resumen es subcadena del texto original", () => {
    const raw = "Somos una cooperativa de diseño en Bogotá.";
    const r = classifyBrandKnowledgeUpdate(raw);
    expect(raw.includes(r.interpreted_summary.replace(/…$/, "").trim()) || r.interpreted_summary === raw).toBe(
      true,
    );
  });
});
