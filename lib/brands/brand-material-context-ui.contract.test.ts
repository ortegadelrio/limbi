import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BRAND_MATERIAL_WEB_SECTION_HEADING,
  BRAND_MATERIAL_WEB_URL_PLACEHOLDER,
  BRAND_MATERIAL_WEB_PENDING_REVIEW_BLOCK_ES,
  isWebExploreButtonDisabled,
  isWebExploreInteractionLocked,
} from "@/lib/brands/brand-material-context-ui";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandDocumentsClientPath = path.join(
  __dirname,
  "../../components/brands/brand-documents-client.tsx",
);

describe("brand-material-context-ui", () => {
  it("copy estable para tarjeta web y placeholder", () => {
    expect(BRAND_MATERIAL_WEB_SECTION_HEADING).toBe("Sitio web de la marca");
    expect(BRAND_MATERIAL_WEB_URL_PLACEHOLDER).toBe("agenciapopuli.com");
    expect(BRAND_MATERIAL_WEB_PENDING_REVIEW_BLOCK_ES).toContain("hallazgos pendientes");
  });

  it("botón explorar deshabilitado con hallazgos pendientes aunque haya URL", () => {
    expect(
      isWebExploreButtonDisabled(
        {
          hasPendingReview: true,
          analyzingDocuments: false,
          extractingId: null,
          uploading: false,
          webExploreBusy: false,
        },
        false,
      ),
    ).toBe(true);
  });

  it("botón explorar habilitado sin bloqueos y con URL", () => {
    expect(
      isWebExploreButtonDisabled(
        {
          hasPendingReview: false,
          analyzingDocuments: false,
          extractingId: null,
          uploading: false,
          webExploreBusy: false,
        },
        false,
      ),
    ).toBe(false);
  });

  it("URL vacía deshabilita el botón aunque no haya bloqueos", () => {
    expect(
      isWebExploreButtonDisabled(
        {
          hasPendingReview: false,
          analyzingDocuments: false,
          extractingId: null,
          uploading: false,
          webExploreBusy: false,
        },
        true,
      ),
    ).toBe(true);
  });

  it("extracción en curso bloquea interacción web", () => {
    expect(
      isWebExploreInteractionLocked({
        hasPendingReview: false,
        analyzingDocuments: false,
        extractingId: "doc-1",
        uploading: false,
        webExploreBusy: false,
      }),
    ).toBe(true);
  });
});

describe("BrandDocumentsClient — contrato de UI (sin RTL)", () => {
  it("incluye tarjeta web y botón type=button con preventDefault (no dispara file input)", () => {
    const src = readFileSync(brandDocumentsClientPath, "utf8");
    expect(src).toContain("{BRAND_MATERIAL_WEB_SECTION_HEADING}");
    expect(src).toContain("{BRAND_MATERIAL_WEB_HELP_ES}");
    expect(src).toContain("placeholder={BRAND_MATERIAL_WEB_URL_PLACEHOLDER}");
    expect(src).toContain('type="button"');
    expect(src).toContain("e.preventDefault()");
    expect(src).toContain("e.stopPropagation()");
    expect(src).toContain("Explorar sitio");
    expect(src).toContain("webSiteSourceSection");
    expect(src.split("{webSiteSourceSection}").length - 1).toBe(2);
    const subir = src.split("Subir archivo").length - 1;
    expect(subir).toBeGreaterThanOrEqual(2);
  });
});
