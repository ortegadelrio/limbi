import { describe, expect, it } from "vitest";
import { responseInventsBrandName } from "@/lib/brainstormer/brand-naming-guard";
import { buildBrainstormerOutputFallback, resolveDisplayUmbrella } from "@/lib/brainstormer/build-brainstormer-output-fallback";
import { buildBrandDnaForBrainstormer } from "@/lib/brainstormer/build-brand-dna-for-brainstormer";
import {
  BORINGSTORE_KNOWLEDGE_FIXTURE,
  BORINGSTORE_LIMBIC_FIXTURE,
} from "@/lib/brainstormer/boringstore-thinking-model-audit.fixture";
import {
  classifyBrainstormerTurnIntent,
  emptyBrainstormerWorkingBrief,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { interpretBrainstormerTurnDeterministic } from "@/lib/brainstormer/interpret-brainstormer-turn";
import {
  ensureUserFacingAssistantMessage,
  isUserFacingAssistantMessage,
} from "@/lib/brainstormer/sanitize-visible-assistant-message";
import {
  extractConfirmedConceptualUmbrella,
  isUserConfusionPhrase,
  isValidConceptualUmbrellaCandidate,
} from "@/lib/brainstormer/working-brief-memory";
import { validateBrainstormerOutputQuality } from "@/lib/brainstormer/validate-brainstormer-output-quality";

const BORINGSTORE_DNA = buildBrandDnaForBrainstormer({
  knowledge_payload: BORINGSTORE_KNOWLEDGE_FIXTURE,
  limbic_payload: BORINGSTORE_LIMBIC_FIXTURE,
}).block;

const BRAND = "Boringstore";

const META_LEAK =
  "Mi recomendación es una dirección clara en prosa, alineada al pedido del usuario y sin clichés de descubrimiento o curiosidad vacía.";

const CONFUSION_AS_EJE =
  "Yo seguiría con «Sigo sin entender» como eje: una sola dirección, sin abrir menú de opciones.";

describe("user_confusion persistente", () => {
  const sigoSinEntender = "Sigo sin entender";

  it("A: clasifica como user_confusion", () => {
    expect(classifyBrainstormerTurnIntent(sigoSinEntender)).toBe("user_confusion");
    expect(classifyBrainstormerTurnIntent("Todavía no entiendo")).toBe("user_confusion");
    expect(classifyBrainstormerTurnIntent("Dímelo en palabras simples")).toBe("user_confusion");
  });

  it("B: no actualiza confirmed_conceptual_umbrella", () => {
    let brief = emptyBrainstormerWorkingBrief();
    brief.confirmed_conceptual_umbrella = sigoSinEntender;
    brief = updateBrainstormerWorkingBrief({
      prior: brief,
      userMessage: sigoSinEntender,
    });
    expect(brief.confirmed_conceptual_umbrella).toBe("");
    expect(
      extractConfirmedConceptualUmbrella({
        userMessage: sigoSinEntender,
        conversationExcerpt: "",
        priorUmbrella: "",
      }),
    ).toBeNull();
    expect(isValidConceptualUmbrellaCandidate(sigoSinEntender)).toBe(false);
    expect(isUserConfusionPhrase(sigoSinEntender)).toBe(true);
  });

  it("C: resolveDisplayUmbrella ignora last_user_message de confusión", () => {
    const brief = emptyBrainstormerWorkingBrief();
    brief.confirmed_conceptual_umbrella = sigoSinEntender;
    expect(resolveDisplayUmbrella(brief, sigoSinEntender)).toBe("");
    expect(resolveDisplayUmbrella(brief, "No entiendo nada de lo que me dices")).toBe("");
  });

  it("D/E: fallback user_confusion sin citar confusión como eje", () => {
    const fb = buildBrainstormerOutputFallback(
      {
        turn_intent: "user_confusion",
        thinking_model_key: "explorer",
        working_brief: emptyBrainstormerWorkingBrief(),
        last_user_message: sigoSinEntender,
      },
      { brand_dna: BORINGSTORE_DNA, brand_name: BRAND },
    );
    expect(fb).not.toMatch(/seguir[ií]a\s+con\s+«Sigo sin entender/i);
    expect(fb).not.toMatch(/«Sigo sin entender»/);
    expect(fb).toMatch(/Lo explico más simple|Tienes razón/i);
    expect(fb).toMatch(/por qué alguien|entr(ar|e) a la tienda/i);
    expect(fb).not.toMatch(/Mi paraguas sería/i);
    expect(fb).toMatch(/Boringstore/);
    expect(isUserFacingAssistantMessage(fb)).toBe(true);
  });

  it("H: rechaza respuesta con confusión como eje", () => {
    expect(isUserFacingAssistantMessage(CONFUSION_AS_EJE)).toBe(false);
    const r = ensureUserFacingAssistantMessage({
      message: CONFUSION_AS_EJE,
      buildSafeFallback: () =>
        buildBrainstormerOutputFallback(
          {
            turn_intent: "user_confusion",
            thinking_model_key: "explorer",
            working_brief: emptyBrainstormerWorkingBrief(),
            last_user_message: "Sigo sin entender",
          },
          { brand_dna: BORINGSTORE_DNA, brand_name: BRAND },
        ),
    });
    expect(r.replaced).toBe(true);
    expect(r.message).not.toMatch(/Sigo sin entender/);
  });
});

describe("launch_strategy y naming", () => {
  const acquisitionMsg =
    "Ya tengo el sitio terminado y necesito atraer clientes";

  it("F/G: fallback adquisición usa Boringstore, no inventa Reverso", () => {
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: acquisitionMsg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    const fb = buildBrainstormerOutputFallback(
      {
        turn_intent: "launch_strategy",
        thinking_model_key: "explorer",
        working_brief: emptyBrainstormerWorkingBrief(),
        last_user_message: acquisitionMsg,
        interpretation: interp,
      },
      { brand_dna: BORINGSTORE_DNA, brand_name: BRAND },
    );
    expect(fb).toMatch(/Boringstore/);
    expect(fb).not.toMatch(/Reverso|Imagina lanzar una marca llamada/i);
    expect(fb).toMatch(/atraer clientes|adquisici[oó]n/i);
    expect(fb).not.toMatch(/tu mensaje anterior como eje/i);
    expect(fb).not.toMatch(
      /Mi recomendaci[oó]n es una direcci[oó]n clara|alineada al pedido|sin clich[eé]s/i,
    );
  });

  it("G: quality gate rechaza naming inventado", () => {
    const invented = "Imagina lanzar una marca llamada Reverso con productos absurdos.";
    expect(responseInventsBrandName(invented, BRAND, acquisitionMsg)).toBe(true);
    const v = validateBrainstormerOutputQuality({
      assistant_message: invented,
      turn_intent: "launch_strategy",
      thinking_model_key: "explorer",
      working_brief: emptyBrainstormerWorkingBrief(),
      brand_dna: BORINGSTORE_DNA,
      brand_name: BRAND,
      last_user_message: acquisitionMsg,
    });
    expect(v.ok).toBe(false);
    expect(v.issues.join(" ")).toMatch(/Reverso|naming|Boringstore/i);
  });
});

describe("ensureUserFacingAssistantMessage", () => {
  it("rechaza instrucciones internas y placeholders", () => {
    const forbidden = [
      META_LEAK,
      "alineada al pedido del usuario",
      "fallback interno",
      "modelo activo",
      "quality gate",
      CONFUSION_AS_EJE,
    ];
    for (const msg of forbidden) {
      expect(isUserFacingAssistantMessage(msg)).toBe(false);
      const r = ensureUserFacingAssistantMessage({
        message: msg,
        buildSafeFallback: () =>
          buildBrainstormerOutputFallback(
            {
              turn_intent: "launch_strategy",
              thinking_model_key: "explorer",
              working_brief: emptyBrainstormerWorkingBrief(),
              last_user_message: "Quiero lanzar la marca porque es nueva",
            },
            { brand_dna: BORINGSTORE_DNA, brand_name: BRAND },
          ),
      });
      expect(r.replaced).toBe(true);
      expect(isUserFacingAssistantMessage(r.message)).toBe(true);
    }
  });
});
