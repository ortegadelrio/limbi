import { describe, expect, it } from "vitest";
import { buildBrainstormerSessionSystemInstructions } from "@/lib/prompts/brainstormer-session";

/**
 * Contratos de texto del prompt v1.2 (comportamiento esperado del modelo;
 * no ejecuta OpenAI).
 */
describe("Brainstormer session prompt (v1.2 contratos)", () => {
  const p = () => buildBrainstormerSessionSystemInstructions();

  it("versión del prompt", () => {
    expect(p()).toContain("brainstormer-session-v1.2");
  });

  it("respuestas cortas por defecto (60–140 palabras)", () => {
    const s = p();
    expect(s).toMatch(/60[\s–-]+140\s+words|60.*140.*palabras/i);
    expect(s).toMatch(/long texts|textos largos|Do NOT write long/i);
  });

  it("una sola pregunta estratégica por turno", () => {
    const s = p();
    expect(s).toMatch(/At most ONE strategic question|máximo.*una pregunta|ONE strategic question/i);
  });

  it("no listas largas sin solicitud", () => {
    const s = p();
    expect(s).toMatch(/long bullet|listas largas|Do NOT use long bullet/i);
  });

  it("no sugerir proyecto en primera respuesta vaga", () => {
    const s = p();
    expect(s).toMatch(/Do NOT suggest project conversion on the first vague|primera.*vag|necesito vender boletas/i);
    expect(s).toMatch(/should_suggest_project_conversion MUST be false|should_suggest_project_conversion = false/i);
  });

  it("no repetir frases plantilla del reto / criterio / ruta", () => {
    const s = p();
    expect(s).toMatch(/El reto que enfrentamos es claro/);
    expect(s).toMatch(/Desde un criterio experto/);
    expect(s).toMatch(/forbidden|NEVER use these/i);
  });

  it("no pedir audiencia si está en la base; precisión puntual", () => {
    const s = p();
    expect(s).toMatch(/Re-asking for audience|frozen knowledge base/i);
    expect(s).toMatch(/ONE precise disambiguation|disambiguation/i);
  });

  it("para ok/sí/dale avanzar con microdecisión sin repetir", () => {
    const s = p();
    expect(s).toMatch(/"ok"|"sí"|"dale"/i);
    expect(s).toMatch(/advance to the NEXT micro-decision|Do NOT repeat the previous/i);
  });

  it("para qué debo hacer / cómo lo hago: acción + pregunta", () => {
    const s = p();
    expect(s).toMatch(/qué debo hacer|cómo lo hago/i);
    expect(s).toMatch(/ONE concrete first action|primera acción/i);
  });

  it("podcast: evaluar rol y prioridad, no aprobar en automático", () => {
    const s = p();
    expect(s).toMatch(/podcast/i);
    expect(s).toMatch(/Do NOT auto-approve|authority|conversi/i);
  });

  it("estructura interna sin plantilla visible", () => {
    const s = p();
    expect(s).toMatch(/Internal logic|invisible to user/i);
    expect(s).toMatch(/do not label sections/i);
  });

  it("avanzar conversación sin repetir información previa", () => {
    const s = p();
    expect(s).toMatch(/ADVANCE the conversation|Do not repeat information you already gave/i);
  });

  it("microdecisiones y no planes completos temprano", () => {
    const s = p();
    expect(s).toMatch(/micro-decision|microdecision/i);
    expect(s).toMatch(/complete plans too early|planes completos/i);
  });

  it("project_readiness: low / medium / high con criterios", () => {
    const s = p();
    expect(s).toMatch(/project_readiness.*low|low:.*vague/i);
    expect(s).toMatch(/medium:/i);
    expect(s).toMatch(/high:.*prioritized audience/i);
  });

  it("banner UI: no verbalizar conversión a proyecto en cada turno", () => {
    const s = p();
    expect(s).toMatch(/UI shows a banner|do NOT need to say/i);
    expect(s).toMatch(/every turn/i);
  });

  it("no promete descarga BRAIN-3", () => {
    const s = p();
    expect(s).toMatch(/BRAIN-3|download|descarg/i);
  });
});

describe("Escenarios de producto (v1.2)", () => {
  it("vender boletas: diagnóstico breve, no plan completo ni lista táctica larga", () => {
    const s = buildBrainstormerSessionSystemInstructions();
    expect(s).toMatch(/necesito vender boletas/i);
    expect(s).toMatch(/NOT a full campaign plan/i);
  });

  it("no repetir el reto en cada respuesta", () => {
    const s = buildBrainstormerSessionSystemInstructions();
    expect(s).toMatch(/Do NOT repeat the challenge verbatim/i);
  });
});
