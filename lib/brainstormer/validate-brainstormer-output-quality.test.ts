import { describe, expect, it, vi } from "vitest";
import { buildBrandDnaForBrainstormer } from "@/lib/brainstormer/build-brand-dna-for-brainstormer";
import {
  BORINGSTORE_KNOWLEDGE_FIXTURE,
  BORINGSTORE_LIMBIC_FIXTURE,
} from "@/lib/brainstormer/boringstore-thinking-model-audit.fixture";
import { buildBrainstormerOutputFallback } from "@/lib/brainstormer/build-brainstormer-output-fallback";
import { interpretBrainstormerTurnDeterministic } from "@/lib/brainstormer/interpret-brainstormer-turn";
import {
  assistantMessageHasVisibleLeaks,
  findVisibleLeakIssues,
} from "@/lib/brainstormer/sanitize-visible-assistant-message";
import {
  applyBrainstormerOutputQualityGate,
  validateBrainstormerOutputQuality,
} from "@/lib/brainstormer/validate-brainstormer-output-quality";
import type { BrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";
import { emptyBrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";

const UMBRELLA = "No sabías que lo querías";

const DNA_NO_EVIDENCE = `evidence_allowed: Solo pruebas ya en la base; no inventar casos ni cifras.`;

const BORINGSTORE_DNA_BLOCK = buildBrandDnaForBrainstormer({
  knowledge_payload: BORINGSTORE_KNOWLEDGE_FIXTURE,
  limbic_payload: BORINGSTORE_LIMBIC_FIXTURE,
}).block;

function briefWithUmbrella(): BrainstormerWorkingBrief {
  const b = emptyBrainstormerWorkingBrief();
  b.confirmed_conceptual_umbrella = UMBRELLA;
  return b;
}

const GENERIC_LANDING_RESPONSE = `
Para convertir el concepto en compras, haría una landing con CTA claro, testimonios de clientes,
producto del día, descubrimientos recomendados y joyas ocultas. La curiosidad y el descubrimiento
serían el eje: teasers visuales, gamificación y productos únicos en la página.
`.trim();

const WEAK_REPAIR_STILL_BAD = `
Yo trabajaría «¿Cómo convertimos ese concepto en compras dentro de la página?» como eje de la campaña.
`.trim();

const RAW_MESSAGE_AS_EJE = `
Yo trabajaría «No entiendo» como eje de la campaña. Una sola dirección.
`.trim();

describe("buildBrainstormerOutputFallback — consultivo mínimo", () => {
  it("con paraguas confirmado: valida sin inventar eje desde pregunta", () => {
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: "¿Cómo convertimos ese concepto en compras dentro de la página?",
      working_brief: briefWithUmbrella(),
    });
    const fb = buildBrainstormerOutputFallback({
      turn_intent: "conversion_bridge",
      thinking_model_key: "explorer",
      working_brief: briefWithUmbrella(),
      last_user_message: "¿Cómo convertimos ese concepto en compras dentro de la página?",
      interpretation: interp,
    });
    expect(fb).toMatch(/No sab[ií]as|postura|validar/i);
    expect(fb).not.toMatch(/Yo trabajaría «¿Cómo convertimos/i);
    expect(fb).not.toMatch(/producto falso abre la conversaci[oó]n/i);
  });

  it("user_confusion: explica simple sin eje creativo", () => {
    const msg = "No entiendo";
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    const fb = buildBrainstormerOutputFallback({
      turn_intent: "user_confusion",
      thinking_model_key: "explorer",
      working_brief: emptyBrainstormerWorkingBrief(),
      last_user_message: msg,
      interpretation: interp,
    });
    expect(fb).toMatch(/Lo explico más simple|Tienes razón/i);
    expect(fb).not.toMatch(/Mi paraguas ser[ií]a/i);
  });

  it("fallbacks no contienen etiquetas de modelo ni lenguaje meta", () => {
    const fb = buildBrainstormerOutputFallback({
      turn_intent: "conceptual_strategy_request",
      thinking_model_key: "explorer",
      working_brief: briefWithUmbrella(),
    });
    expect(assistantMessageHasVisibleLeaks(fb)).toBe(false);
    expect(fb).not.toMatch(/desde\s+(comercial|disruptor|planner)/i);
  });
});

describe("applyBrainstormerOutputQualityGate — fallback tras reparación fallida", () => {
  const gateArgs = {
    turn_intent: "conversion_bridge" as const,
    thinking_model_key: "explorer" as const,
    working_brief: briefWithUmbrella(),
    last_user_message: "¿Cómo convertimos ese concepto en compras dentro de la página?",
    working_brief_block: `confirmed_umbrella: ${UMBRELLA}`,
    thinking_model_block: "THINKING MODEL (internal — Disruptor)",
    brand_dna: DNA_NO_EVIDENCE,
    turn_interpretation: interpretBrainstormerTurnDeterministic({
      last_user_message: "¿Cómo convertimos ese concepto en compras dentro de la página?",
      working_brief: briefWithUmbrella(),
    }),
  };

  it("si reparación sigue fallando, usa fallback mínimo y no guarda versión con mensaje como eje", async () => {
    const repair = vi.fn().mockResolvedValue(WEAK_REPAIR_STILL_BAD);
    const result = await applyBrainstormerOutputQualityGate({
      ...gateArgs,
      assistant_message: WEAK_REPAIR_STILL_BAD,
      generateRepair: repair,
    });
    expect(repair).toHaveBeenCalledTimes(1);
    expect(result.fallback_used).toBe(true);
    expect(result.assistant_message).not.toBe(WEAK_REPAIR_STILL_BAD);
    expect(result.assistant_message).not.toMatch(/Yo trabajaría «¿Cómo convertimos/i);
    expect(result.pre_repair_issues.length).toBeGreaterThan(0);
  });

  it("reparación exitosa no usa fallback", async () => {
    const good =
      "Bajo «No sabías que lo querías», el sketch abre expectativa y la landing con producto real cierra compra.";
    const repair = vi.fn().mockResolvedValue(good);
    const result = await applyBrainstormerOutputQualityGate({
      ...gateArgs,
      assistant_message: WEAK_REPAIR_STILL_BAD,
      generateRepair: repair,
    });
    expect(result.fallback_used).toBe(false);
    expect(result.assistant_message).toBe(good);
    expect(result.quality.ok).toBe(true);
  });
});

describe("validateBrainstormerOutputQuality — bloqueos esenciales", () => {
  it("rechaza mensaje del usuario como eje", () => {
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: "No entiendo",
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    const r = validateBrainstormerOutputQuality({
      assistant_message: RAW_MESSAGE_AS_EJE,
      turn_intent: "user_confusion",
      thinking_model_key: "explorer",
      working_brief: emptyBrainstormerWorkingBrief(),
      last_user_message: "No entiendo",
      turn_interpretation: interp,
    });
    expect(r.ok).toBe(false);
    expect(r.issues.join(" ")).toMatch(/eje|paraguas|confusi[oó]n/i);
  });

  it("rechaza naming inventado de marca", () => {
    const invented = "Imagina lanzar una marca llamada Reverso con productos absurdos.";
    const r = validateBrainstormerOutputQuality({
      assistant_message: invented,
      turn_intent: "launch_strategy",
      thinking_model_key: "explorer",
      working_brief: emptyBrainstormerWorkingBrief(),
      brand_name: "Boringstore",
      last_user_message: "Quiero lanzar la marca",
    });
    expect(r.ok).toBe(false);
    expect(r.issues.join(" ")).toMatch(/marca|Inventa/i);
  });

  it("rechaza lenguaje interno visible al usuario", () => {
    const leaks = [
      "Desde Comercial, conectaría el concepto a la landing.",
      "Tomaría postura con una idea rectora concreta sobre el paraguas.",
      "Esto es interno: el sistema debe incluir el puente.",
    ];
    for (const msg of leaks) {
      expect(assistantMessageHasVisibleLeaks(msg)).toBe(true);
      const issues = findVisibleLeakIssues(msg);
      expect(issues.length).toBeGreaterThan(0);
      const r = validateBrainstormerOutputQuality({
        assistant_message: msg,
        turn_intent: "general",
        thinking_model_key: "explorer",
        working_brief: emptyBrainstormerWorkingBrief(),
      });
      expect(r.ok).toBe(false);
    }
  });

  it("no rechaza respuesta genérica de landing si no usa mensaje crudo como eje", () => {
    const r = validateBrainstormerOutputQuality({
      assistant_message: GENERIC_LANDING_RESPONSE,
      turn_intent: "conversion_bridge",
      thinking_model_key: "explorer",
      working_brief: briefWithUmbrella(),
      last_user_message: "¿Cómo convertimos ese concepto en compras dentro de la página?",
    });
    expect(r.ok).toBe(true);
  });
});
