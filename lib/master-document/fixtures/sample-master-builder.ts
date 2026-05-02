/**
 * Fixture para probar buildMasterDocumentInput / buildMasterDocumentPrompt sin OpenAI.
 *
 * import { SAMPLE_PROJECT_FOR_MASTER, SAMPLE_RESPONSES_MASTER } from "@/lib/master-document/fixtures/sample-master-builder";
 * import { buildMasterDocumentInput } from "@/lib/master-document";
 * import { buildMasterDocumentPrompt } from "@/lib/prompts/master-document";
 *
 * const input = buildMasterDocumentInput({
 *   project: SAMPLE_PROJECT_FOR_MASTER,
 *   responses: SAMPLE_RESPONSES_MASTER,
 * });
 * const prompt = buildMasterDocumentPrompt(input);
 */
import { SAMPLE_RESPONSES_LIMBIC } from "@/lib/interpretation/fixtures/sample-responses";
import type { MasterDocumentProjectPayload } from "@/lib/master-document/build-input";

export const SAMPLE_PROJECT_FOR_MASTER: MasterDocumentProjectPayload = {
  id: "00000000-0000-0000-0000-000000000001",
  user_id: "00000000-0000-0000-0000-000000000002",
  name_or_descriptor: "Proyecto demo Maestro",
  name_status: "provisional",
  challenge_type: "brand",
  main_challenge: "differentiate",
  status: "draft",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

export const SAMPLE_RESPONSES_MASTER: Record<string, unknown> = {
  ...SAMPLE_RESPONSES_LIMBIC,
  project_identity: {
    name_or_descriptor: "Proyecto demo Maestro",
    name_status: "provisional",
  },
  strategic_base: {
    simple_description: "Marca de café de especialidad en CDMX.",
    offering_type: "product",
    problem_category: "lack_differentiation",
    transformation_type: "feel_part_of",
    why_now: "need_growth",
    selected_tension: "connect_sound_generic",
  },
  audience_base: {
    audience_type: "end_consumers",
    current_emotion: "curious",
    desired_emotion: "trust",
    desired_action: "purchase",
  },
  evidence_base: {
    evidence_types: ["results", "testimonials"],
    evidence_details: {
      results: "Crecimiento 40% anual en suscriptores.",
      testimonials: "Clientes destacan la frescura del tueste.",
    },
    has_restricted_claims: false,
    restricted_claims: null,
  },
  review: {
    user_confirmed_inputs: true,
  },
};
