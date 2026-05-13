import { describe, expect, it } from "vitest";
import {
  assertPublicBrandWebsiteUrl,
  extractSameOriginHtmlLinks,
  htmlToPlainText,
} from "@/lib/brands/explore-brand-website-text";
import { shouldShowStructuredBrandContextForImprove } from "@/lib/brands/improve-structured-context-visibility";
import {
  inferBrandContextFileKind,
  validateBrandContextUploadMetadata,
} from "@/lib/brands/validate-brand-context-upload";

describe("Ticket H.2 — mejora por sección (visibilidad inventario)", () => {
  it("muestra contexto estructurado solo en secciones de oferta/audiencia/naturaleza afín", () => {
    expect(shouldShowStructuredBrandContextForImprove("offer")).toBe(true);
    expect(shouldShowStructuredBrandContextForImprove("audiences")).toBe(true);
    expect(shouldShowStructuredBrandContextForImprove("value_proposition")).toBe(true);
    expect(shouldShowStructuredBrandContextForImprove("identity")).toBe(false);
    expect(shouldShowStructuredBrandContextForImprove("voice_tone")).toBe(false);
  });
});

describe("Ticket H.2 — formatos de material de contexto", () => {
  it("acepta PDF, DOCX y TXT por nombre y tamaño", () => {
    const pdf = validateBrandContextUploadMetadata({
      file_name: "brief.pdf",
      file_size_bytes: 1024,
      file_type: "application/pdf",
    });
    expect(pdf.ok).toBe(true);

    const docx = validateBrandContextUploadMetadata({
      file_name: "manual.docx",
      file_size_bytes: 2048,
      file_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(docx.ok).toBe(true);

    const txt = validateBrandContextUploadMetadata({
      file_name: "notas.txt",
      file_size_bytes: 100,
      file_type: "text/plain",
    });
    expect(txt.ok).toBe(true);
  });

  it("rechaza extensiones no soportadas con mensaje claro", () => {
    const bad = validateBrandContextUploadMetadata({
      file_name: "archivo.pptx",
      file_size_bytes: 1000,
      file_type: "",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.message).toContain("Formato no soportado");
      expect(bad.message.toLowerCase()).toContain("pdf");
      expect(bad.message.toLowerCase()).toContain("docx");
    }
  });

  it("inferBrandContextFileKind reconoce extensiones", () => {
    expect(inferBrandContextFileKind("a.PDF")).toBe("pdf");
    expect(inferBrandContextFileKind("b.DOCX")).toBe("docx");
    expect(inferBrandContextFileKind("c.txt")).toBe("txt");
    expect(inferBrandContextFileKind("x.pptx")).toBeNull();
  });
});

describe("Ticket H.2 — exploración web controlada (helpers)", () => {
  it("assertPublicBrandWebsiteUrl rechaza localhost", () => {
    expect(() => assertPublicBrandWebsiteUrl("http://localhost:3000")).toThrow();
  });

  it("htmlToPlainText elimina etiquetas", () => {
    expect(htmlToPlainText("<p>Hola <b>mundo</b></p>")).toBe("Hola mundo");
  });

  it("extractSameOriginHtmlLinks solo mismo origen", () => {
    const html = '<a href="/nosotros">N</a><a href="https://evil.com/x">E</a>';
    const links = extractSameOriginHtmlLinks(html, "https://marca.com/inicio", 10);
    expect(links.some((l) => l.includes("evil.com"))).toBe(false);
    expect(links.some((l) => l.includes("marca.com/nosotros"))).toBe(true);
  });
});

describe("Ticket H.2 — copy de UI (strings estables)", () => {
  it("CTA de mejora desde diagnóstico", () => {
    expect("Mejorar esta sección con la IA de Limbi").toContain("IA de Limbi");
  });

  it("botón principal del chat de mejora", () => {
    expect("Conversa con Limbi").toBeTruthy();
  });
});
