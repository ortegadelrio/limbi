/**
 * Investigación externa bajo demanda — fuente separada del turno creativo principal.
 */

import { z } from "zod";
import { getOpenAIClient } from "@/lib/openai/server";
import type { ExternalResearchFinding } from "@/lib/schemas/brainstormer-session";

const findingsResponseSchema = z.object({
  findings: z.array(
    z.object({
      source_title: z.string(),
      source_url: z.string(),
      finding: z.string(),
      strategic_reading: z.string(),
      relevance: z.string(),
    }),
  ),
});

export type ExternalResearchRunMode = "mock" | "live" | "unavailable";

export type ExternalResearchRunResult = {
  mode: ExternalResearchRunMode;
  findings: ExternalResearchFinding[];
};

export type RunExternalResearchArgs = {
  query: string;
  brand_name: string;
  session_context: string;
  confirmed_umbrella?: string;
};

const UNAVAILABLE_USER_MESSAGE =
  "No pude acceder a búsqueda externa en este momento. " +
  "Si quieres, acota la consulta (categoría, país, tipo de campaña) y lo intentamos de nuevo.";

export function isMockResearchMode(): boolean {
  return process.env.VITEST === "true" || process.env.BRAINSTORMER_RESEARCH_MOCK === "1";
}

/** URLs que no deben presentarse como investigación real. */
export function isPlaceholderResearchUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return true;
  if (u.startsWith("limbi://")) return true;
  return (
    /\bexample\.(com|org|net)\b/.test(u) ||
    u === "https://example.com" ||
    u === "http://example.com"
  );
}

function mockFindings(query: string): ExternalResearchFinding[] {
  return [
    {
      query,
      source_title: "[Modo prueba] Referente simulado — no es fuente real",
      source_url: "limbi://research-mock",
      finding:
        "Ejemplo ilustrativo: marcas de retail digital con tono irónico usan producto sorpresa antes del catálogo real. Solo para probar el flujo.",
      strategic_reading:
        "En producción aquí iría una lectura Limbi sobre referentes reales; esto no sustituye búsqueda en internet.",
      relevance: "Dato simulado para desarrollo — no usar como verdad de mercado.",
      approved_for_session: false,
    },
  ];
}

function parseFindingsJson(raw: string, query: string): ExternalResearchFinding[] {
  const parsed = JSON.parse(raw) as unknown;
  const zod = findingsResponseSchema.safeParse(parsed);
  if (!zod.success) return [];

  return zod.data.findings
    .slice(0, 6)
    .map((f) => ({
      query,
      source_title: f.source_title.slice(0, 300),
      source_url: f.source_url.slice(0, 2000),
      finding: f.finding.slice(0, 2000),
      strategic_reading: f.strategic_reading.slice(0, 2000),
      relevance: f.relevance.slice(0, 1000),
      approved_for_session: false,
    }))
    .filter((f) => !isPlaceholderResearchUrl(f.source_url));
}

function extractResponseText(response: { output_text?: string | null }): string {
  return response.output_text?.trim() ?? "";
}

export async function runExternalResearch(
  args: RunExternalResearchArgs,
): Promise<ExternalResearchRunResult> {
  const query = args.query.trim();
  if (!query) {
    return { mode: "unavailable", findings: [] };
  }

  if (isMockResearchMode()) {
    // eslint-disable-next-line no-console
    console.warn("[brainstormer] external research: modo prueba (BRAINSTORMER_RESEARCH_MOCK o VITEST)");
    return { mode: "mock", findings: mockFindings(query) };
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    // eslint-disable-next-line no-console
    console.warn("[brainstormer] external research: OPENAI_API_KEY no configurada");
    return { mode: "unavailable", findings: [] };
  }

  const umbrellaNote = args.confirmed_umbrella?.trim()
    ? `Paraguas confirmado en sesión (no reemplazar): «${args.confirmed_umbrella}».`
    : "Sin paraguas confirmado aún.";

  const instructions = `Eres el módulo de investigación de Limbi Brainstormer.
Busca referentes y tendencias EXTERNAS en internet para la consulta del usuario.
${umbrellaNote}
Marca: ${args.brand_name}.
Contexto de sesión (resumen): ${args.session_context.slice(0, 3000)}

Reglas:
- Usa búsqueda web; cita fuentes REALES con URL verificables (no example.com ni placeholders).
- Diferencia hallazgo factual de tu interpretación estratégica.
- No afirmes datos de la Base de Marca del cliente como si vinieran de internet.
- No inventes fuentes si no encuentras resultados.
Responde SOLO JSON: { "findings": [ { "source_title", "source_url", "finding", "strategic_reading", "relevance" } ] }
Máximo 4 hallazgos. Si no hay resultados útiles, devuelve "findings": [].`;

  try {
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_BRAINSTORMER_RESEARCH_MODEL?.trim() || "gpt-4o-mini";

    const response = await openai.responses.create({
      model,
      tools: [{ type: "web_search_preview" }],
      input: [
        { role: "system", content: instructions },
        { role: "user", content: query },
      ],
      text: { format: { type: "json_object" } },
    });

    const text = extractResponseText(response);
    if (!text) {
      // eslint-disable-next-line no-console
      console.warn("[brainstormer] external research: respuesta vacía tras búsqueda");
      return { mode: "unavailable", findings: [] };
    }

    const findings = parseFindingsJson(text, query);
    if (findings.length === 0) {
      // eslint-disable-next-line no-console
      console.warn("[brainstormer] external research: sin hallazgos válidos tras parseo");
      return { mode: "unavailable", findings: [] };
    }

    return { mode: "live", findings };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[brainstormer] external research failed:", err);
    return { mode: "unavailable", findings: [] };
  }
}

export function formatExternalResearchUserMessage(
  result: ExternalResearchRunResult,
  brandName: string,
): string {
  if (result.mode === "unavailable" || result.findings.length === 0) {
    return UNAVAILABLE_USER_MESSAGE;
  }

  const mockNotice =
    result.mode === "mock"
      ? "Nota: estos resultados son simulados de prueba (modo desarrollo). No son fuentes reales de internet.\n\n"
      : "";

  const blocks = result.findings.map((f, i) => {
    const urlPart =
      f.source_url && !isPlaceholderResearchUrl(f.source_url)
        ? ` Fuente: ${f.source_url}`
        : "";
    return (
      `${i + 1}. ${f.source_title}.${urlPart}\n` +
      `Hallazgo: ${f.finding}\n` +
      `Lectura estratégica Limbi: ${f.strategic_reading}\n` +
      `Relevancia para ${brandName}: ${f.relevance}`
    );
  });

  return (
    `${mockNotice}Investigué referentes externos para tu consulta. La Base de Marca sigue mandando; esto es contexto de mercado, no verdad de marca.\n\n` +
    `Hallazgos principales:\n${blocks.join("\n\n")}\n\n` +
    `Cómo puede servir a la sesión: contrasta estos formatos con el paraguas ya trabajado; úsalos como inspiración de mecanismo, no como sustituto del concepto.\n\n` +
    `¿Quieres que incorporemos estos hallazgos al brief de la sesión?`
  );
}
