import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  THINKING_MODEL_SELECTOR_OPTIONS,
  formatThinkingModelChipLabel,
  getThinkingModelByKey,
} from "@/lib/ai/thinking-models";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Brainstormer UI — modelos de pensamiento (contrato fuente)", () => {
  const formPath = path.join(
    __dirname,
    "../../components/brainstormer/brainstormer-new-session-form.tsx",
  );
  const selectorPath = path.join(
    __dirname,
    "../../components/brainstormer/thinking-model-selector.tsx",
  );
  const panelPath = path.join(
    __dirname,
    "../../components/brainstormer/brainstormer-session-panel.tsx",
  );

  it("selector muestra los seis modelos y Limbi por defecto", () => {
    const form = readFileSync(formPath, "utf8");
    const selector = readFileSync(selectorPath, "utf8");
    expect(selector).toContain("THINKING_MODEL_SELECTOR_OPTIONS");
    expect(selector).toContain("getThinkingModelByKey");
    expect(selector).toContain("publicName");
    expect(THINKING_MODEL_SELECTOR_OPTIONS).toHaveLength(6);
    expect(getThinkingModelByKey("limbi")?.publicName).toBe("Limbi");
    expect(form).toContain("ThinkingModelSelector");
    expect(form).toContain("thinkingModelKey");
    expect(form).toContain("DEFAULT_THINKING_MODEL_KEY");
  });

  it("chip muestra modelo activo", () => {
    const panel = readFileSync(panelPath, "utf8");
    expect(panel).toContain("Pensando como:");
    expect(panel).toContain("formatThinkingModelChipLabel");
    const label = formatThinkingModelChipLabel({
      thinking_model_key: "limbi",
      resolved_primary_model_key: "commercial",
      resolved_secondary_model_key: "explorer",
    });
    expect(label).toBe("Comercial + Disruptor");
  });
});
