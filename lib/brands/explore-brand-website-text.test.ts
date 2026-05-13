import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BRAND_WEB_EXPLORE_MSG_JS_BLOCKED,
  BRAND_WEB_EXPLORE_MSG_UI_RECOMMENDATION_JS_BLOCK,
  detectJavascriptOrAntiBotChallenge,
  exploreBrandWebsiteControlled,
  extractPlainTextFromHtml,
  extractSameOriginHtmlLinks,
  htmlToPlainText,
  sameBrandSiteHostname,
  siteKeyHostname,
} from "@/lib/brands/explore-brand-website-text";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("explore-brand-website-text — HTML a texto", () => {
  it("extrae h1, p y li", () => {
    const html =
      "<html><body><h1>Título</h1><p>Párrafo uno.</p><ul><li>Item A</li><li>Item B</li></ul></body></html>";
    const t = htmlToPlainText(html);
    expect(t).toContain("Título");
    expect(t).toContain("Párrafo uno");
    expect(t).toContain("Item A");
    expect(t).toContain("Item B");
  });

  it("usa title y meta description si el body visible es pobre", () => {
    const html =
      "<html><head><title>Marca X</title><meta name=\"description\" content=\"Descripción corta de la marca.\" /></head><body><div id=\"root\"></div></body></html>";
    const t = htmlToPlainText(html);
    expect(t).toContain("Marca X");
    expect(t).toContain("Descripción corta de la marca");
  });

  it("extractPlainTextFromHtml devuelve métricas coherentes", () => {
    const metrics = extractPlainTextFromHtml("<p>" + "x".repeat(2000) + "</p>");
    expect(metrics.charsAfterClean).toBeGreaterThan(100);
    expect(metrics.text.length).toBeGreaterThan(0);
  });
});

describe("explore-brand-website-text — enlaces mismo sitio (www/apex)", () => {
  it("sameBrandSiteHostname agrupa www y apex", () => {
    expect(sameBrandSiteHostname("www.ejemplo.com", "ejemplo.com")).toBe(true);
    expect(siteKeyHostname("WWW.Ejemplo.Com")).toBe("ejemplo.com");
  });

  it("permite enlaces internos entre www y apex", () => {
    const html = '<a href="https://www.marca.com/nosotros">Nosotros</a>';
    const links = extractSameOriginHtmlLinks(html, "https://marca.com/", 10);
    expect(links.some((l) => l.includes("marca.com/nosotros"))).toBe(true);
  });
});

describe("explore-brand-website-text — fetch mockeado", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("URL sin protocolo (https implícito) obtiene HTML vía fetch", async () => {
    const html = "<html><head><title>OK</title></head><body><p>Contenido suficiente para superar el umbral mínimo de texto útil en una sola página de prueba.</p></body></html>";
    globalThis.fetch = vi.fn(async () => {
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }) as typeof fetch;

    const r = await exploreBrandWebsiteControlled("agenciapopuli.com");
    expect(r.text.length).toBeGreaterThan(50);
    expect(r.summary.source_kind).toBe("website_crawl");
    expect(r.summary.pages_succeeded).toBeGreaterThan(0);
    expect(r.summary.characters_extracted).toBeGreaterThan(0);
  });

  it("si www falla y apex responde, obtiene texto", async () => {
    const html =
      "<html><head><title>Apex OK</title></head><body><p>" +
      "Texto largo de marca en apex para superar umbrales de extracción y clasificación de éxito en pruebas automáticas sin depender de red real. ".repeat(20) +
      "</p></body></html>";

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.startsWith("https://www.split-brand.test")) {
        return new Response("", { status: 403 });
      }
      if (u.startsWith("https://split-brand.test")) {
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const r = await exploreBrandWebsiteControlled("https://www.split-brand.test/");
    expect(r.text).toContain("Apex OK");
    expect(r.outcome === "success" || r.outcome === "low_text").toBe(true);
  });

  it("expone finalUrl tras redirect en diagnósticos de página", async () => {
    const html =
      "<html><head><title>R</title></head><body><p>" +
      "Contenido de prueba tras redirección para lectura de marca y extracción de texto plano suficiente. ".repeat(12) +
      "</p></body></html>";

    globalThis.fetch = vi.fn(async () => {
      const res = new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
      Object.defineProperty(res, "url", { value: "https://redirect-target.test/landing" });
      return res;
    }) as typeof fetch;

    const r = await exploreBrandWebsiteControlled("https://redirect-target.test/start");
    const okPage = r.pages.find((p) => p.ok && p.finalUrl?.includes("landing"));
    expect(okPage?.finalUrl).toContain("landing");
  });

  it("403 sin texto devuelve mensaje de acceso limitado", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("", { status: 403, headers: { "content-type": "text/html" } });
    }) as typeof fetch;

    const r = await exploreBrandWebsiteControlled("https://blocked-brand.test/");
    expect(r.text.trim().length).toBe(0);
    expect(r.outcome).toBe("blocked");
    expect(r.userMessage.length).toBeGreaterThan(10);
  });

  it("429: tras varios intentos responde HTML", async () => {
    let n = 0;
    globalThis.fetch = vi.fn(async () => {
      n += 1;
      if (n < 3) {
        return new Response("", { status: 429 });
      }
      const body =
        "<html><head><title>T</title></head><body><p>" +
        "Texto de respaldo tras 429 en las primeras solicitudes de prueba automatizada. ".repeat(30) +
        "</p></body></html>";
      return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
    }) as typeof fetch;

    const r = await exploreBrandWebsiteControlled("https://rate-brand.test/");
    expect(r.text.length).toBeGreaterThan(0);
  });

  it("timeout en home sigue con otras rutas sugeridas", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u === "https://timeout-brand.test/" || u === "https://timeout-brand.test") {
        const err = new Error("Aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      }
      const html =
        "<html><head><title>Segunda</title></head><body><p>" +
        "Contenido en otra ruta tras timeout en la home de prueba. ".repeat(25) +
        "</p></body></html>";
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    }) as typeof fetch;

    const r = await exploreBrandWebsiteControlled("https://timeout-brand.test/");
    expect(r.pages.some((p) => p.timeout)).toBe(true);
    expect(r.text.length).toBeGreaterThan(0);
  });

  it("HTML tipo SPA sin texto → outcome js_shell o failed con mensaje humano", async () => {
    const html =
      "<html><head></head><body><div id=\"__next\"></div>" +
      "<script></script>".repeat(12) +
      "</body></html>";
    globalThis.fetch = vi.fn(async () => {
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    }) as typeof fetch;

    const r = await exploreBrandWebsiteControlled("https://spa-shell.test/");
    expect(r.text.trim().length).toBe(0);
    expect(["js_shell", "failed"]).toContain(r.outcome);
    expect(r.userMessage.toLowerCase()).not.toContain("stack");
    expect(r.userMessage.toLowerCase()).not.toContain("invalid_url");
  });

  it("resumen técnico incluye contadores y failure_reasons acotados", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("", { status: 415, headers: { "content-type": "text/plain" } });
    }) as typeof fetch;

    const r = await exploreBrandWebsiteControlled("https://plain-only.test/");
    expect(r.summary.source_kind).toBe("website_crawl");
    expect(r.summary.pages_attempted).toBeGreaterThan(0);
    expect(Array.isArray(r.summary.failure_reasons)).toBe(true);
  });

  it("trunca el texto agregado al límite global de caracteres", async () => {
    const { BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS } = await import("@/lib/brands/validate-pdf-upload");
    const chunk = "x".repeat(Math.min(120_000, BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS + 500));
    const html = `<html><head><title>T</title></head><body><p>${chunk}</p></body></html>`;
    globalThis.fetch = vi.fn(async () => {
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    }) as typeof fetch;

    const r = await exploreBrandWebsiteControlled("https://truncate.test/");
    expect(r.text.length).toBeLessThanOrEqual(BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS);
  });
});

describe("explore-brand-website-text — challenge / JavaScript obligatorio", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("detectJavascriptOrAntiBotChallenge detecta “Javascript is required”", () => {
    const html =
      "<html><body><p>Javascript is required. Please enable javascript before you are allowed to see this page.</p></body></html>";
    const d = detectJavascriptOrAntiBotChallenge(html);
    expect(d.blocked).toBe(true);
    if (d.blocked) {
      expect(d.matchedSnippet.toLowerCase()).toContain("javascript is required");
    }
  });

  it("detectJavascriptOrAntiBotChallenge detecta “Please enable javascript”", () => {
    const html = "<html><body>Please enable javascript to continue.</body></html>";
    const d = detectJavascriptOrAntiBotChallenge(html);
    expect(d.blocked).toBe(true);
  });

  it("explore con HTML de bloqueo → outcome js_blocked y mensaje claro", async () => {
    const html =
      "<html><head><title>Wait</title></head><body>Checking your browser before accessing.</body></html>";
    globalThis.fetch = vi.fn(async () => {
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    }) as typeof fetch;

    const r = await exploreBrandWebsiteControlled("https://challenge-only.test/");
    expect(r.outcome).toBe("js_blocked");
    expect(r.userMessage.toLowerCase()).toContain("javascript");
    expect(r.userRecommendation?.toLowerCase()).toContain("servidor");
    expect(r.challengeSourceMetadata?.blocked_by_javascript_or_challenge).toBe(true);
    expect(r.challengeSourceMetadata?.recommendation).toBe("upload_file_or_try_static_page");
  });

  it("mensajes js_blocked son humanos (sin códigos crudos)", () => {
    expect(BRAND_WEB_EXPLORE_MSG_JS_BLOCKED.toLowerCase()).not.toContain("invalid_url");
    expect(BRAND_WEB_EXPLORE_MSG_UI_RECOMMENDATION_JS_BLOCK.length).toBeGreaterThan(40);
  });
});

describe("explore-brand-website-text — alcance (no toca otras tablas)", () => {
  it("ruta web-explore no inserta hallazgos ni escribe cuestionario/bases", () => {
    const routePath = join(
      __dirname,
      "..",
      "..",
      "app/api/brands/[brandId]/documents/web-explore/route.ts",
    );
    const src = readFileSync(routePath, "utf8");
    const idx = src.indexOf("brand_source_facts");
    if (idx !== -1) {
      const chunk = src.slice(idx, idx + 280);
      expect(chunk).toContain(".select");
      expect(chunk).not.toContain(".insert");
    }
    expect(src).not.toContain("brand_responses");
    expect(src).not.toContain("brand_offer_items");
    expect(src).not.toContain("brand_knowledge_bases");
  });

  it("no referencia tablas de cuestionario ni bases en el módulo explore", () => {
    const path = join(__dirname, "explore-brand-website-text.ts");
    const src = readFileSync(path, "utf8");
    expect(src).not.toContain("brand_responses");
    expect(src).not.toContain("brand_offer_items");
    expect(src).not.toContain("brand_audience_territories");
    expect(src).not.toContain("brand_knowledge_bases");
    expect(src).not.toContain("brand_limbic_bases");
  });
});
