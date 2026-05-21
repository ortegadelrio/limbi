/**
 * Aplica la interpretación del turno al working brief — única vía autorizada para paraguas.
 */

import type { BrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";
import { brainstormerWorkingBriefSchema } from "@/lib/brainstormer/conversation-contract";
import type { BrainstormerTurnInterpretation } from "@/lib/brainstormer/turn-interpreter";
import {
  mapInterpretationToTurnIntent,
  mapInterpretedStageToBriefStage,
  priorHasConfirmedConcept,
} from "@/lib/brainstormer/turn-interpreter";
import { maxStrategyStage } from "@/lib/brainstormer/strategy-journey";
import {
  extractRejectedConceptSignal,
  isConceptRejectionOrAlternativeRequest,
  isUserConfusionPhrase,
  isValidConceptualUmbrellaCandidate,
  normalizeStoredConceptualUmbrella,
  storedUmbrellaMatchesUserMessage,
} from "@/lib/brainstormer/working-brief-memory";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function uniquePush(list: string[], item: string, max: number): string[] {
  const t = item.trim();
  if (!t) return list;
  const next = list.filter((x) => x !== t);
  next.push(t);
  return next.slice(-max);
}

function sanitizeInvalidStoredUmbrella(brief: BrainstormerWorkingBrief, userMessage: string): void {
  const raw = brief.confirmed_conceptual_umbrella.trim();
  if (!raw) return;
  const normalized = normalizeStoredConceptualUmbrella(raw);
  if (normalized && isValidConceptualUmbrellaCandidate(normalized)) {
    brief.confirmed_conceptual_umbrella = normalized;
    return;
  }
  if (
    isUserConfusionPhrase(raw) ||
    isConceptRejectionOrAlternativeRequest(raw) ||
    !isValidConceptualUmbrellaCandidate(raw)
  ) {
    brief.confirmed_conceptual_umbrella = "";
    brief.confirmed_decisions = brief.confirmed_decisions.filter(
      (d) => !d.toLowerCase().includes(raw.toLowerCase().slice(0, 16)),
    );
  }
}

/** Aplica memory_update y strategy_stage desde el intérprete. No lee raw message para paraguas. */
export function applyTurnInterpretationToWorkingBrief(args: {
  prior: BrainstormerWorkingBrief;
  interpretation: BrainstormerTurnInterpretation;
  userMessage: string;
}): BrainstormerWorkingBrief {
  const { interpretation: interp, userMessage } = args;
  const brief: BrainstormerWorkingBrief = {
    ...args.prior,
    current_request_type: mapInterpretationToTurnIntent(interp, {
      userMessage: args.userMessage,
    }),
  };

  sanitizeInvalidStoredUmbrella(brief, userMessage);

  const memory = interp.memory_update;

  if (memory.clear_umbrella) {
    brief.confirmed_conceptual_umbrella = "";
    brief.confirmed_decisions = brief.confirmed_decisions.filter((d) => !/paraguas/i.test(d));
  }

  if (memory.reject_current_concept) {
    const rejectedSignal = extractRejectedConceptSignal(
      userMessage,
      brief.confirmed_conceptual_umbrella,
    );
    brief.rejected_paths = uniquePush(brief.rejected_paths, rejectedSignal, 20);
    const rawUmbrella = brief.confirmed_conceptual_umbrella.trim();
    const nUser = normalize(userMessage);
    const nUmbrella = normalize(rawUmbrella);
    const wronglyStored =
      rawUmbrella &&
      (nUmbrella === nUser ||
        nUser.includes(nUmbrella) ||
        (nUmbrella.length > 16 && nUser.includes(nUmbrella.slice(0, 24))) ||
        isConceptRejectionOrAlternativeRequest(rawUmbrella));
    if (wronglyStored) {
      brief.confirmed_conceptual_umbrella = "";
      brief.confirmed_decisions = brief.confirmed_decisions.filter((d) => !/paraguas/i.test(d));
    }
  }

  if (
    memory.update_umbrella &&
    memory.umbrella_candidate?.trim() &&
    isValidConceptualUmbrellaCandidate(memory.umbrella_candidate) &&
    !storedUmbrellaMatchesUserMessage(memory.umbrella_candidate, userMessage)
  ) {
    const umbrella = memory.umbrella_candidate.trim();
    brief.confirmed_conceptual_umbrella = umbrella;
    brief.confirmed_decisions = uniquePush(
      brief.confirmed_decisions,
      `Paraguas: ${umbrella}`,
      16,
    );
    brief.open_decisions = brief.open_decisions.filter(
      (d) => !/elegir paraguas|paraguas conceptual ganador/i.test(d),
    );
  }

  const mappedStage = mapInterpretedStageToBriefStage(interp.strategy_stage);
  brief.strategy_stage = maxStrategyStage(
    mappedStage,
    priorHasConfirmedConcept(brief) ? "concept_confirmed" : mappedStage,
  );

  if (interp.conversation_act === "external_research_request") {
    brief.next_best_step = "Revisar hallazgos externos y decidir si incorporarlos al brief de sesión.";
  } else if (interp.conversation_act === "project_handoff_request") {
    brief.next_best_step = "Completar criterios faltantes o confirmar handoff a Proyecto.";
  } else if (interp.conversation_act === "user_confusion") {
    brief.next_best_step = "Definir paraguas conceptual antes de tácticas o piezas.";
  } else if (
    interp.response_mode === "propose_alternatives" ||
    interp.conversation_act === "asking_alternatives"
  ) {
    brief.next_best_step = "Elegir paraguas entre alternativas propuestas.";
  } else if (interp.response_mode === "advance_next_step" && priorHasConfirmedConcept(brief)) {
    brief.next_best_step = "Secuencia expectativa → lanzamiento → conversión → sostenimiento.";
  } else if (!brief.confirmed_conceptual_umbrella.trim() && interp.response_mode === "guide_to_concept") {
    brief.next_best_step = "Definir paraguas conceptual antes de tácticas o piezas.";
    brief.open_decisions = uniquePush(
      brief.open_decisions,
      "Elegir paraguas conceptual ganador",
      16,
    );
  }

  const stored = brief.confirmed_conceptual_umbrella.trim();
  if (stored && storedUmbrellaMatchesUserMessage(stored, userMessage)) {
    brief.confirmed_conceptual_umbrella = "";
    brief.confirmed_decisions = brief.confirmed_decisions.filter((d) => !/paraguas/i.test(d));
  }

  return brainstormerWorkingBriefSchema.parse(brief);
}
