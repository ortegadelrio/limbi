import { describe, expect, it } from "vitest";
import {
  assertPublicExplorableHttpUrl,
  normalizeWebsiteUrl,
  sanitizeWebsiteUrlInput,
} from "@/lib/brands/normalize-website-url";
import { brandWebExploreRequestSchema } from "@/lib/schemas/brand-document";

describe("normalizeWebsiteUrl (dominio natural)", () => {
  it("agenciapopuli.com → https://agenciapopuli.com", () => {
    expect(normalizeWebsiteUrl("agenciapopuli.com")).toBe("https://agenciapopuli.com");
  });

  it("www.agenciapopuli.com → https://www.agenciapopuli.com", () => {
    expect(normalizeWebsiteUrl("www.agenciapopuli.com")).toBe("https://www.agenciapopuli.com");
  });

  it("https://agenciapopuli.com se conserva", () => {
    expect(normalizeWebsiteUrl("https://agenciapopuli.com")).toBe("https://agenciapopuli.com");
  });

  it("https://www.agenciapopuli.com se conserva", () => {
    expect(normalizeWebsiteUrl("https://www.agenciapopuli.com")).toBe(
      "https://www.agenciapopuli.com",
    );
  });

  it("http://agenciapopuli.com se conserva", () => {
    expect(normalizeWebsiteUrl("http://agenciapopuli.com")).toBe("http://agenciapopuli.com");
  });

  it("espacios antes/después se eliminan", () => {
    expect(normalizeWebsiteUrl("  https://agenciapopuli.com  ")).toBe("https://agenciapopuli.com");
    expect(normalizeWebsiteUrl("\tagenciapopuli.com\n")).toBe("https://agenciapopuli.com");
  });

  it("//agenciapopuli.com → https://agenciapopuli.com", () => {
    expect(normalizeWebsiteUrl("//agenciapopuli.com")).toBe("https://agenciapopuli.com");
  });
});

describe("assertPublicExplorableHttpUrl", () => {
  it("acepta dominio sin protocolo y expone URL https", () => {
    const u = assertPublicExplorableHttpUrl("agenciapopuli.com");
    expect(u.protocol).toBe("https:");
    expect(u.hostname).toBe("agenciapopuli.com");
  });

  it("acepta www con https", () => {
    const u = assertPublicExplorableHttpUrl("www.agenciapopuli.com");
    expect(u.hostname).toBe("www.agenciapopuli.com");
    expect(u.protocol).toBe("https:");
  });

  it("acepta https://www explícito", () => {
    const u = assertPublicExplorableHttpUrl("https://www.agenciapopuli.com/path");
    expect(u.href).toBe("https://www.agenciapopuli.com/path");
  });

  it("rechaza localhost", () => {
    expect(() => assertPublicExplorableHttpUrl("http://localhost:3000")).toThrow(
      /no está permitida/,
    );
  });

  it("rechaza javascript:alert(1)", () => {
    expect(() => assertPublicExplorableHttpUrl("javascript:alert(1)")).toThrow(
      /No pudimos leer esa dirección/,
    );
  });

  it("rechaza dominios sin punto tipo intranet", () => {
    expect(() => assertPublicExplorableHttpUrl("intranet")).toThrow(/No pudimos leer esa dirección/);
  });

  it("rechaza protocolo no permitido (ftp)", () => {
    expect(() => assertPublicExplorableHttpUrl("ftp://files.example.com/readme")).toThrow(
      /No pudimos leer esa dirección/,
    );
  });
});

describe("sanitizeWebsiteUrlInput", () => {
  it("elimina zero-width", () => {
    const zws = "\u200B";
    expect(sanitizeWebsiteUrlInput(`${zws}agenciapopuli.com${zws}`)).toBe("agenciapopuli.com");
  });
});

describe("brandWebExploreRequestSchema", () => {
  it("acepta entry_url sin protocolo y devuelve https normalizado", () => {
    const r = brandWebExploreRequestSchema.safeParse({ entry_url: "agenciapopuli.com" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.entry_url).toBe("https://agenciapopuli.com");
    }
  });
});
