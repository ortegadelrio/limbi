import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import type { SegmentCorrectionMode } from "@/lib/intake/segment-correction-mode";

function readRec(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  return {};
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Combine two prose snippets for additive correction without duplicating identical text. */
function combineProse(previous: string, incoming: string): string {
  const a = previous.trim();
  const b = incoming.trim();
  if (!a) return b;
  if (!b) return a;
  const fa = fold(a);
  const fb = fold(b);
  if (fb.includes(fa) || fa.includes(fb)) {
    return b.length >= a.length ? b : a;
  }
  return `${a} ${b}`.replace(/\s+/g, " ").trim();
}

/**
 * After an LLM pass in segment correction, merge additive updates with the prior pending extraction.
 * Replace / improve modes return `incoming` unchanged (model is instructed accordingly).
 */
export function mergePendingSegmentCorrectionExtraction(params: {
  mode: SegmentCorrectionMode;
  pending: IntakeExtractionOutput;
  incoming: IntakeExtractionOutput;
  miniStep: GuidedMiniStepId;
}): IntakeExtractionOutput {
  if (params.mode !== "add") return params.incoming;

  const p0 = params.pending.extracted_response_updates ?? {};
  const i0 = params.incoming.extracted_response_updates ?? {};
  const pSb = readRec(p0.strategic_base);
  const iSb = readRec(i0.strategic_base);
  const pAb = readRec(p0.audience_base);
  const iAb = readRec(i0.audience_base);
  const pEb = readRec(p0.evidence_base);
  const iEb = readRec(i0.evidence_base);

  const out: IntakeExtractionOutput = {
    ...params.incoming,
    extracted_response_updates: { ...i0 },
  };
  const ou = out.extracted_response_updates as Record<string, unknown>;

  switch (params.miniStep) {
    case "tailored_what": {
      const ps =
        typeof pSb.simple_description === "string" ? pSb.simple_description : "";
      const is =
        typeof iSb.simple_description === "string" ? iSb.simple_description : "";
      ou.strategic_base = {
        ...pSb,
        ...iSb,
        ...(ps || is ? { simple_description: combineProse(ps, is) } : {}),
      };
      break;
    }
    case "problem": {
      const ps =
        typeof pSb.problem_description_optional === "string"
          ? pSb.problem_description_optional
          : "";
      const is =
        typeof iSb.problem_description_optional === "string"
          ? iSb.problem_description_optional
          : "";
      ou.strategic_base = {
        ...pSb,
        ...iSb,
        ...(ps || is
          ? { problem_description_optional: combineProse(ps, is) }
          : {}),
      };
      break;
    }
    case "transformation": {
      const ps =
        typeof pSb.transformation_to === "string" ? pSb.transformation_to : "";
      const is =
        typeof iSb.transformation_to === "string" ? iSb.transformation_to : "";
      const pf =
        typeof pSb.transformation_from === "string" ? pSb.transformation_from : "";
      const inf =
        typeof iSb.transformation_from === "string" ? iSb.transformation_from : "";
      ou.strategic_base = {
        ...pSb,
        ...iSb,
        ...(ps || is ? { transformation_to: combineProse(ps, is) } : {}),
        ...(pf || inf ? { transformation_from: combineProse(pf, inf) } : {}),
      };
      break;
    }
    case "audience": {
      const pd =
        typeof pAb.audience_description_optional === "string"
          ? pAb.audience_description_optional
          : "";
      const id =
        typeof iAb.audience_description_optional === "string"
          ? iAb.audience_description_optional
          : "";
      ou.audience_base = {
        ...pAb,
        ...iAb,
        ...(pd || id
          ? { audience_description_optional: combineProse(pd, id) }
          : {}),
      };
      if (typeof iAb.audience_type === "string" && iAb.audience_type.trim()) {
        (ou.audience_base as Record<string, unknown>).audience_type =
          iAb.audience_type;
      } else if (typeof pAb.audience_type === "string" && pAb.audience_type.trim()) {
        (ou.audience_base as Record<string, unknown>).audience_type =
          pAb.audience_type;
      }
      break;
    }
    case "evidence": {
      ou.evidence_base = { ...pEb, ...iEb };
      if (
        Array.isArray(pEb.evidence_types) &&
        pEb.evidence_types.length > 0 &&
        (!Array.isArray(iEb.evidence_types) || iEb.evidence_types.length === 0)
      ) {
        (ou.evidence_base as Record<string, unknown>).evidence_types =
          pEb.evidence_types;
      }
      const pDet = pEb.evidence_details;
      const iDet = iEb.evidence_details;
      if (
        pDet &&
        typeof pDet === "object" &&
        !Array.isArray(pDet) &&
        iDet &&
        typeof iDet === "object" &&
        !Array.isArray(iDet)
      ) {
        (ou.evidence_base as Record<string, unknown>).evidence_details = {
          ...(pDet as Record<string, unknown>),
          ...(iDet as Record<string, unknown>),
        };
      }
      break;
    }
    default:
      break;
  }

  return out;
}
