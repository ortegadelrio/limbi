import { describe, expect, it } from "vitest";
import {
  BRAND_CONTEXT_DOCX_UNREADABLE_ES,
  BRAND_CONTEXT_UNSUPPORTED_FORMAT_ES,
  validateBrandContextUploadMetadata,
} from "@/lib/brands/validate-brand-context-upload";

describe("Material de marca — tolerancia MIME (DOCX/TXT)", () => {
  it("DOCX con MIME correcto aceptado", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "a.docx",
      file_size_bytes: 100,
      file_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(r.ok).toBe(true);
  });

  it("DOCX con application/octet-stream aceptado si extensión .docx", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "a.docx",
      file_size_bytes: 100,
      file_type: "application/octet-stream",
    });
    expect(r.ok).toBe(true);
  });

  it("DOCX con MIME vacío aceptado si extensión .docx", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "a.docx",
      file_size_bytes: 100,
      file_type: "",
    });
    expect(r.ok).toBe(true);
  });

  it("DOCX con application/zip aceptado (contenedor Office)", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "a.docx",
      file_size_bytes: 100,
      file_type: "application/zip",
    });
    expect(r.ok).toBe(true);
  });

  it("TXT con text/plain aceptado", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "a.txt",
      file_size_bytes: 10,
      file_type: "text/plain",
    });
    expect(r.ok).toBe(true);
  });

  it("TXT con text/plain; charset=utf-8 aceptado", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "a.txt",
      file_size_bytes: 10,
      file_type: "text/plain; charset=utf-8",
    });
    expect(r.ok).toBe(true);
  });

  it("TXT con application/octet-stream aceptado si extensión .txt", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "a.txt",
      file_size_bytes: 10,
      file_type: "application/octet-stream",
    });
    expect(r.ok).toBe(true);
  });

  it("TXT con MIME vacío aceptado si extensión .txt", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "a.txt",
      file_size_bytes: 10,
      file_type: "",
    });
    expect(r.ok).toBe(true);
  });

  it("application/octet-stream con extensión .exe rechazado", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "mal.exe",
      file_size_bytes: 100,
      file_type: "application/octet-stream",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toBe(BRAND_CONTEXT_UNSUPPORTED_FORMAT_ES);
    }
  });

  it("archivo .zip rechazado aunque tenga MIME application/octet-stream", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "x.zip",
      file_size_bytes: 100,
      file_type: "application/octet-stream",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toBe(BRAND_CONTEXT_UNSUPPORTED_FORMAT_ES);
    }
  });

  it("archivo sin extensión rechazado", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "README",
      file_size_bytes: 10,
      file_type: "application/octet-stream",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toBe(BRAND_CONTEXT_UNSUPPORTED_FORMAT_ES);
    }
  });

  it("DOCX con text/html rechazado (MIME peligroso)", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "fake.docx",
      file_size_bytes: 100,
      file_type: "text/html",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toBe(BRAND_CONTEXT_UNSUPPORTED_FORMAT_ES);
    }
  });

  it("TXT con image/png rechazado", () => {
    const r = validateBrandContextUploadMetadata({
      file_name: "a.txt",
      file_size_bytes: 10,
      file_type: "image/png",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toBe(BRAND_CONTEXT_UNSUPPORTED_FORMAT_ES);
    }
  });
});

describe("extractBrandDocumentTextFromBuffer — DOCX", () => {
  it("error de mammoth produce mensaje humano", async () => {
    const { extractBrandDocumentTextFromBuffer } = await import(
      "@/lib/brands/extract-brand-document-text-from-buffer"
    );
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 0, 0]);
    await expect(extractBrandDocumentTextFromBuffer(buf, "x.docx")).rejects.toThrow(
      BRAND_CONTEXT_DOCX_UNREADABLE_ES,
    );
  });
});
