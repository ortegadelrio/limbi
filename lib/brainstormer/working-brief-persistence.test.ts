import { describe, expect, it } from "vitest";
import { buildWorkingBriefPromptBlock } from "@/lib/brainstormer/conversation-contract";
import {
  extractWorkingBriefFromProgress,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import {
  mergeBrainstormerSessionProgress,
  mergeWorkingBrief,
  resolveWorkingBriefForSessionMerge,
} from "@/lib/brainstormer/merge-brainstormer-session-progress";
import { brainstormerWorkingBriefSchema } from "@/lib/schemas/brainstormer-session";
import {
  brainstormerTurnOutputSchema,
  emptyBrainstormerSessionProgress,
  type BrainstormerSessionProgressPayload,
} from "@/lib/schemas/brainstormer-session";

const TURN_MESSAGES = [
  "No sabías que lo querías",
  "Ese sería el paraguas",
  "¿Cuál es la ruta a seguir?",
] as const;

function excerptThrough(turnIndex: number): string {
  return TURN_MESSAGES.slice(0, turnIndex + 1)
    .map((m) => `user: ${m}`)
    .join("\n\n");
}

/** Réplica del merge en run-brainstormer-assistant-turn. */
function simulatePersistedTurn(
  prevProgress: BrainstormerSessionProgressPayload,
  userMessage: string,
  conversationExcerpt: string,
  modelWorkingBrief?: unknown,
): BrainstormerSessionProgressPayload {
  const priorBrief = extractWorkingBriefFromProgress(prevProgress);
  const serverBrief = updateBrainstormerWorkingBrief({
    prior: priorBrief,
    userMessage,
    conversationExcerpt,
  });
  const persistedBrief = resolveWorkingBriefForSessionMerge({
    priorProgress: prevProgress,
    serverBrief,
    modelWorkingBrief,
  });
  const modelProgress: BrainstormerSessionProgressPayload = {
    ...emptyBrainstormerSessionProgress(),
    session_summary: `Turno: ${userMessage.slice(0, 40)}`,
  };
  return mergeBrainstormerSessionProgress(prevProgress, {
    ...modelProgress,
    working_brief: persistedBrief,
  });
}

describe("schema — working_brief v3", () => {
  it("brainstormerWorkingBriefSchema incluye campos de memoria confirmada", () => {
    const parsed = brainstormerWorkingBriefSchema.safeParse({
      contract_version: "v3",
      confirmed_decisions: ["Paraguas: No sabías que lo querías"],
      confirmed_conceptual_umbrella: "No sabías que lo querías",
      campaign_stage: "expectativa",
      conversion_bridge: "concepto → sketch → producto real → landing → CTA",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.confirmed_conceptual_umbrella).toBe("No sabías que lo querías");
      expect(parsed.data.campaign_stage).toBe("expectativa");
    }
  });

  it("brainstormerTurnOutputSchema acepta session_progress.working_brief", () => {
    const base = emptyBrainstormerSessionProgress();
    const out = brainstormerTurnOutputSchema.safeParse({
      assistant_message: "Propuesta.",
      session_progress: {
        ...base,
        session_summary: "S",
        working_brief: {
          contract_version: "v3",
          confirmed_conceptual_umbrella: "No sabías que lo querías",
          confirmed_decisions: ["Paraguas confirmado"],
          campaign_stage: "expectativa",
          conversion_bridge: "concepto → landing → CTA",
        },
      },
    });
    expect(out.success).toBe(true);
  });
});

describe("mergeWorkingBrief — no borra confirmaciones", () => {
  it("modelo con paraguas vacío no pisa el previo tras merge con servidor", () => {
    const prev = brainstormerWorkingBriefSchema.parse({
      confirmed_conceptual_umbrella: "No sabías que lo querías",
      confirmed_decisions: ["Paraguas: No sabías que lo querías"],
      campaign_stage: "expectativa",
    });
    const hostileModel = brainstormerWorkingBriefSchema.parse({
      confirmed_conceptual_umbrella: "",
      confirmed_decisions: [],
      campaign_stage: "unknown",
    });
    const server = { ...prev, next_best_step: "Ruta secuencial" };
    const merged = mergeWorkingBrief(mergeWorkingBrief(prev, hostileModel), server);
    expect(merged.confirmed_conceptual_umbrella).toBe("No sabías que lo querías");
    expect(merged.campaign_stage).toBe("expectativa");
  });

  it("resolveWorkingBriefForSessionMerge sin working_brief del modelo usa servidor + prev", () => {
    const progress = emptyBrainstormerSessionProgress();
    progress.working_brief = brainstormerWorkingBriefSchema.parse({
      confirmed_conceptual_umbrella: "No sabías que lo querías",
    });
    const server = updateBrainstormerWorkingBrief({
      prior: extractWorkingBriefFromProgress(progress),
      userMessage: "¿Cuál es la ruta a seguir?",
      conversationExcerpt: excerptThrough(2),
    });
    const resolved = resolveWorkingBriefForSessionMerge({
      priorProgress: progress,
      serverBrief: server,
    });
    expect(resolved.confirmed_conceptual_umbrella).toMatch(/no sab[ií]as/i);
  });
});

describe("Boringstore — persistencia turno a turno en session_progress", () => {
  it("3 turnos: confirma paraguas en turno 2 y lo conserva en turno 3 y en el prompt", () => {
    let progress = emptyBrainstormerSessionProgress();

    progress = simulatePersistedTurn(progress, TURN_MESSAGES[0]!, excerptThrough(0));
    expect(progress.working_brief?.confirmed_conceptual_umbrella ?? "").toBe("");

    progress = simulatePersistedTurn(progress, TURN_MESSAGES[1]!, excerptThrough(1));
    expect(progress.working_brief?.confirmed_conceptual_umbrella).toMatch(/no sab[ií]as que lo quer[ií]as/i);
    expect(progress.working_brief?.confirmed_decisions?.length).toBeGreaterThan(0);

    progress = simulatePersistedTurn(progress, TURN_MESSAGES[2]!, excerptThrough(1), undefined);
    expect(progress.working_brief?.confirmed_conceptual_umbrella).toMatch(/no sab[ií]as que lo quer[ií]as/i);

    const promptBlock = buildWorkingBriefPromptBlock(
      extractWorkingBriefFromProgress(progress),
    );
    expect(promptBlock).toContain("confirmed_umbrella:");
    expect(promptBlock).toMatch(/no sab[ií]as que lo quer[ií]as/i);
    expect(promptBlock).toMatch(/interno: no reemplazar paraguas/i);
  });

  it("turno 3 con modelo hostil (paraguas vacío): snapshot final conserva confirmación", () => {
    let progress = emptyBrainstormerSessionProgress();
    progress = simulatePersistedTurn(progress, TURN_MESSAGES[0]!, excerptThrough(0));
    progress = simulatePersistedTurn(progress, TURN_MESSAGES[1]!, excerptThrough(0));

    const hostileBrief = brainstormerWorkingBriefSchema.parse({
      confirmed_conceptual_umbrella: "",
      confirmed_decisions: [],
    });
    progress = simulatePersistedTurn(
      progress,
      TURN_MESSAGES[2]!,
      excerptThrough(1),
      hostileBrief,
    );

    expect(progress.working_brief?.confirmed_conceptual_umbrella).toMatch(/no sab[ií]as/i);
  });
});
