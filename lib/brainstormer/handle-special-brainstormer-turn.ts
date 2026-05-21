/**
 * Respuestas dedicadas para investigación externa y handoff a Proyecto (sin prompt creativo principal).
 */

import type { BrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";
import {
  evaluateProjectHandoffReadiness,
  formatProjectHandoffIncompleteMessage,
  formatProjectHandoffReadyMessage,
} from "@/lib/brainstormer/build-project-handoff-preview";
import {
  formatExternalResearchUserMessage,
  runExternalResearch,
} from "@/lib/brainstormer/run-external-research";
import { extractResearchQuery } from "@/lib/brainstormer/special-turn-detectors";
import type { BrainstormerTurnInterpretation } from "@/lib/brainstormer/turn-interpreter";
import type { BrainstormerSessionProgressPayload } from "@/lib/schemas/brainstormer-session";

export type SpecialBrainstormerTurnResult = {
  handled: boolean;
  assistant_message: string;
  progress_patch: Partial<BrainstormerSessionProgressPayload>;
  structured_extra: Record<string, unknown>;
};

function sessionContextSnippet(progress: BrainstormerSessionProgressPayload): string {
  return [
    progress.session_summary,
    progress.current_challenge,
    progress.preliminary_objective,
    progress.recommended_routes,
  ]
    .filter((s) => s.trim())
    .join(" | ")
    .slice(0, 3000);
}

export async function handleSpecialBrainstormerTurn(args: {
  interpretation: BrainstormerTurnInterpretation;
  last_user_message: string;
  progress: BrainstormerSessionProgressPayload;
  working_brief: BrainstormerWorkingBrief;
  brand_name: string;
}): Promise<SpecialBrainstormerTurnResult> {
  const act = args.interpretation.conversation_act;

  if (act === "external_research_request") {
    const query = extractResearchQuery(args.last_user_message, args.brand_name);
    const research = await runExternalResearch({
      query,
      brand_name: args.brand_name,
      session_context: sessionContextSnippet(args.progress),
      confirmed_umbrella: args.working_brief.confirmed_conceptual_umbrella,
    });
    const prior = args.progress.external_research_findings ?? [];
    const merged =
      research.findings.length > 0
        ? [...prior, ...research.findings].slice(-40)
        : prior;

    return {
      handled: true,
      assistant_message: formatExternalResearchUserMessage(research, args.brand_name),
      progress_patch: {
        external_research_findings: merged,
        project_handoff_preview: args.progress.project_handoff_preview ?? null,
      },
      structured_extra: {
        special_turn: "external_research_request",
        research_mode: research.mode,
        external_research_findings: research.findings,
      },
    };
  }

  if (act === "project_handoff_request") {
    const readiness = evaluateProjectHandoffReadiness({
      progress: args.progress,
      working_brief: args.working_brief,
      brand_name: args.brand_name,
    });

    if (!readiness.ready || !readiness.preview) {
      return {
        handled: true,
        assistant_message: formatProjectHandoffIncompleteMessage(readiness.missing),
        progress_patch: {
          project_handoff_preview: null,
          should_suggest_project_conversion: false,
          missing_project_inputs: readiness.missing.slice(0, 4),
        },
        structured_extra: {
          special_turn: "project_handoff_request",
          project_handoff_ready: false,
          missing: readiness.missing,
        },
      };
    }

    const message = formatProjectHandoffReadyMessage({
      brand_name: args.brand_name,
      preview: readiness.preview,
    });

    return {
      handled: true,
      assistant_message: message,
      progress_patch: {
        project_handoff_preview: readiness.preview,
        should_suggest_project_conversion: true,
        project_readiness: "high",
        project_seed_summary: [
          readiness.preview.project_type,
          readiness.preview.objective,
          readiness.preview.confirmed_umbrella,
        ]
          .filter(Boolean)
          .join(" — ")
          .slice(0, 4000),
        missing_project_inputs: [],
      },
      structured_extra: {
        special_turn: "project_handoff_request",
        project_handoff_ready: true,
        project_handoff_preview: readiness.preview,
      },
    };
  }

  return {
    handled: false,
    assistant_message: "",
    progress_patch: {},
    structured_extra: {},
  };
}
