import { describe, expect, it } from "vitest";
import {
  BRAND_DOCUMENTS_BUCKET_ALLOWED_MIME_TYPES,
  BRAND_WEB_EXPLORE_STORAGE_CONTENT_TYPE,
  BRAND_WEB_EXPLORE_STORAGE_SAVE_FAILED_ES,
  humanizeBrandDocumentStorageError,
  isBrandDocumentStorageMimeRejectedMessage,
} from "@/lib/brands/brand-documents-storage";

describe("brand-documents Storage MIME (H.2 web-explore)", () => {
  it("web-explore usa text/plain compatible con bucket", () => {
    expect(BRAND_WEB_EXPLORE_STORAGE_CONTENT_TYPE).toBe("text/plain");
    expect(BRAND_DOCUMENTS_BUCKET_ALLOWED_MIME_TYPES).toContain("text/plain");
    expect(BRAND_DOCUMENTS_BUCKET_ALLOWED_MIME_TYPES).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(BRAND_DOCUMENTS_BUCKET_ALLOWED_MIME_TYPES).toContain("application/pdf");
  });

  it("error de MIME en Storage se traduce a mensaje humano", () => {
    expect(
      humanizeBrandDocumentStorageError("mime type text/plain is not supported"),
    ).toBe(BRAND_WEB_EXPLORE_STORAGE_SAVE_FAILED_ES);
    expect(isBrandDocumentStorageMimeRejectedMessage("Mime type invalid")).toBe(true);
    expect(humanizeBrandDocumentStorageError("Network timeout")).toBe("Network timeout");
  });
});

describe("normalizeWebsiteUrl + web-explore (regresión)", () => {
  it("agenciapopuli.com → https://agenciapopuli.com", async () => {
    const { normalizeWebsiteUrl } = await import("@/lib/brands/normalize-website-url");
    expect(normalizeWebsiteUrl("agenciapopuli.com")).toBe("https://agenciapopuli.com");
  });

  it("www.agenciapopuli.com → https://www.agenciapopuli.com", async () => {
    const { normalizeWebsiteUrl } = await import("@/lib/brands/normalize-website-url");
    expect(normalizeWebsiteUrl("www.agenciapopuli.com")).toBe("https://www.agenciapopuli.com");
  });
});
