"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AUDIENCE_TYPE_OPTIONS,
  AVOIDED_VOICE_TRAIT_OPTIONS,
  CENTRAL_TENSION_OPTIONS,
  CHALLENGE_TYPE_OPTIONS,
  COLOR_FEELING_OPTIONS,
  CURRENT_EMOTION_OPTIONS,
  DESIRED_ACTION_OPTIONS,
  DESIRED_EMOTION_OPTIONS,
  DESIRED_VOICE_TRAIT_OPTIONS,
  EMOTIONAL_COLOR_OPTIONS,
  EMOTIONAL_INTENSITY_OPTIONS,
  EVIDENCE_TYPE_OPTIONS,
  MAIN_CHALLENGE_OPTIONS,
  NAME_STATUS_OPTIONS,
  NO_CLEAR_EVIDENCE,
  OFFERING_TYPE_OPTIONS,
  PROBLEM_CATEGORY_OPTIONS,
  RESTRICTED_CLAIMS_OPTIONS,
  SENSORY_CLOTHING_OPTIONS,
  SENSORY_EMOTIONAL_AGE_OPTIONS,
  SENSORY_MOVEMENT_OPTIONS,
  SENSORY_SMELL_OPTIONS,
  TRANSFORMATION_TYPE_OPTIONS,
  VISUAL_ATMOSPHERE_OPTIONS,
  WHY_NOW_OPTIONS,
  WIZARD_STEP_COUNT,
  WIZARD_STEP_ORDER,
  WIZARD_STEP_TITLES,
  wizardReviewEditHref,
  type WizardStepId,
} from "@/lib/constants/wizard";
import { cn } from "@/lib/utils";
import {
  limbiLoadingMessage,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import type { z } from "zod";
import {
  challengeTypeSchema,
  mainChallengeSchema,
  nameStatusSchema,
} from "@/lib/schemas/project";

type NameStatus = z.infer<typeof nameStatusSchema>;
type ChallengeType = z.infer<typeof challengeTypeSchema>;
type MainChallenge = z.infer<typeof mainChallengeSchema>;
type OfferingType = (typeof OFFERING_TYPE_OPTIONS)[number]["value"];
type ProblemCategory = (typeof PROBLEM_CATEGORY_OPTIONS)[number]["value"];
type TransformationType = (typeof TRANSFORMATION_TYPE_OPTIONS)[number]["value"];
type AudienceType = (typeof AUDIENCE_TYPE_OPTIONS)[number]["value"];
type CurrentEmotion = (typeof CURRENT_EMOTION_OPTIONS)[number]["value"];
type DesiredEmotion = (typeof DESIRED_EMOTION_OPTIONS)[number]["value"];
type DesiredAction = (typeof DESIRED_ACTION_OPTIONS)[number]["value"];
type WhyNow = (typeof WHY_NOW_OPTIONS)[number]["value"];
type CentralTension = (typeof CENTRAL_TENSION_OPTIONS)[number]["value"];
type EvidenceTypeSlug = (typeof EVIDENCE_TYPE_OPTIONS)[number]["value"];
type RestrictedClaimsAnswer = (typeof RESTRICTED_CLAIMS_OPTIONS)[number]["value"];

const EVIDENCE_SLUGS = new Set(
  EVIDENCE_TYPE_OPTIONS.map((o) => o.value) as readonly string[],
);

const VISUAL_SLUGS = new Set(
  VISUAL_ATMOSPHERE_OPTIONS.map((o) => o.value) as readonly string[],
);
const COLOR_SLUGS = new Set(
  EMOTIONAL_COLOR_OPTIONS.map((o) => o.value) as readonly string[],
);
const COLOR_FEELING_SLUGS = new Set(
  COLOR_FEELING_OPTIONS.map((o) => o.value) as readonly string[],
);
const SMELL_SLUGS = new Set(
  SENSORY_SMELL_OPTIONS.map((o) => o.value) as readonly string[],
);
const MOVEMENT_SLUGS = new Set(
  SENSORY_MOVEMENT_OPTIONS.map((o) => o.value) as readonly string[],
);
const EMOTIONAL_AGE_SLUGS = new Set(
  SENSORY_EMOTIONAL_AGE_OPTIONS.map((o) => o.value) as readonly string[],
);
const CLOTHING_SLUGS = new Set(
  SENSORY_CLOTHING_OPTIONS.map((o) => o.value) as readonly string[],
);
const DESIRED_VOICE_SLUGS = new Set(
  DESIRED_VOICE_TRAIT_OPTIONS.map((o) => o.value) as readonly string[],
);
const AVOIDED_VOICE_SLUGS = new Set(
  AVOIDED_VOICE_TRAIT_OPTIONS.map((o) => o.value) as readonly string[],
);

function isChallengeType(v: string): v is ChallengeType {
  return challengeTypeSchema.safeParse(v).success;
}

function isMainChallenge(v: string): v is MainChallenge {
  return mainChallengeSchema.safeParse(v).success;
}

function isOfferingType(v: string): v is OfferingType {
  return OFFERING_TYPE_OPTIONS.some((o) => o.value === v);
}

function isProblemCategory(v: string): v is ProblemCategory {
  return PROBLEM_CATEGORY_OPTIONS.some((o) => o.value === v);
}

function isTransformationType(v: string): v is TransformationType {
  return TRANSFORMATION_TYPE_OPTIONS.some((o) => o.value === v);
}

function isAudienceType(v: string): v is AudienceType {
  return AUDIENCE_TYPE_OPTIONS.some((o) => o.value === v);
}

function isCurrentEmotion(v: string): v is CurrentEmotion {
  return CURRENT_EMOTION_OPTIONS.some((o) => o.value === v);
}

function isDesiredEmotion(v: string): v is DesiredEmotion {
  return DESIRED_EMOTION_OPTIONS.some((o) => o.value === v);
}

function isDesiredAction(v: string): v is DesiredAction {
  return DESIRED_ACTION_OPTIONS.some((o) => o.value === v);
}

function isWhyNow(v: string): v is WhyNow {
  return WHY_NOW_OPTIONS.some((o) => o.value === v);
}

function isCentralTension(v: string): v is CentralTension {
  return CENTRAL_TENSION_OPTIONS.some((o) => o.value === v);
}

function completedPrefix(stepIndex: number) {
  return [...WIZARD_STEP_ORDER.slice(0, stepIndex + 1)];
}

function normalizeServerCompletedSteps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (
      typeof x === "string" &&
      WIZARD_STEP_ORDER.includes(x as WizardStepId)
    ) {
      out.push(x);
    }
  }
  return out;
}

function orderedUniqueWizardSteps(ids: Set<string>): string[] {
  return WIZARD_STEP_ORDER.filter((s) => ids.has(s));
}

function mergeCompletedStepWithExisting(
  existing: string[],
  stepId: WizardStepId,
): string[] {
  const next = new Set(existing);
  next.add(stepId);
  return orderedUniqueWizardSteps(next);
}

function completedStepsForSave(
  stepIndex: number,
  options: { returnTo: string | null; serverCompletedSteps: string[] },
): string[] {
  const stepId = WIZARD_STEP_ORDER[stepIndex];
  if (stepId === undefined) {
    const clamped = Math.min(
      Math.max(0, stepIndex),
      WIZARD_STEP_ORDER.length - 1,
    );
    return completedPrefix(clamped);
  }
  const editReturn =
    options.returnTo === "review" || options.returnTo === "project";
  const hadReviewBeforeGeneration = options.serverCompletedSteps.includes(
    "review_before_generation",
  );
  if (editReturn || hadReviewBeforeGeneration) {
    return mergeCompletedStepWithExisting(
      options.serverCompletedSteps,
      stepId,
    );
  }
  return completedPrefix(stepIndex);
}

function firstIncompleteStep(completed: string[]): number {
  for (let i = 0; i < WIZARD_STEP_ORDER.length; i++) {
    const id = WIZARD_STEP_ORDER[i];
    if (!completed.includes(id)) return i;
  }
  return WIZARD_STEP_ORDER.length - 1;
}

function readStrategicBase(
  r: Record<string, unknown> | null,
): Record<string, unknown> {
  const sb = r?.strategic_base;
  if (sb && typeof sb === "object" && !Array.isArray(sb)) {
    return { ...(sb as Record<string, unknown>) };
  }
  return {};
}

function readAudienceBase(
  r: Record<string, unknown> | null,
): Record<string, unknown> {
  const ab = r?.audience_base;
  if (ab && typeof ab === "object" && !Array.isArray(ab)) {
    return { ...(ab as Record<string, unknown>) };
  }
  return {};
}

function readEvidenceBase(
  r: Record<string, unknown> | null,
): Record<string, unknown> {
  const eb = r?.evidence_base;
  if (eb && typeof eb === "object" && !Array.isArray(eb)) {
    return { ...(eb as Record<string, unknown>) };
  }
  return {};
}

function parseEvidenceTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && EVIDENCE_SLUGS.has(x));
}

function parseEvidenceDetails(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function readLimbicBase(
  r: Record<string, unknown> | null,
): Record<string, unknown> {
  const lb = r?.limbic_base;
  if (lb && typeof lb === "object" && !Array.isArray(lb)) {
    return { ...(lb as Record<string, unknown>) };
  }
  return {};
}

function readVoiceBase(
  r: Record<string, unknown> | null,
): Record<string, unknown> {
  const vb = r?.voice_base;
  if (vb && typeof vb === "object" && !Array.isArray(vb)) {
    return { ...(vb as Record<string, unknown>) };
  }
  return {};
}

function parseStringArray(
  raw: unknown,
  allowed: Set<string>,
): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && allowed.has(x));
}

function optionLabel<V extends string>(
  options: readonly { value: V; label: string }[],
  value: string | null,
): string {
  if (!value) return "—";
  const o = options.find((x) => x.value === (value as V));
  return o?.label ?? value;
}

function parseSensoryChoices(raw: unknown): {
  smell: string | null;
  movement: string | null;
  emotional_age: string | null;
  symbolic_clothing: string | null;
} {
  const empty = {
    smell: null,
    movement: null,
    emotional_age: null,
    symbolic_clothing: null,
  } as const;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...empty };
  const o = raw as Record<string, unknown>;
  const pick = (k: string, set: Set<string>): string | null => {
    const v = o[k];
    return typeof v === "string" && set.has(v) ? v : null;
  };
  return {
    smell: pick("smell", SMELL_SLUGS),
    movement: pick("movement", MOVEMENT_SLUGS),
    emotional_age: pick("emotional_age", EMOTIONAL_AGE_SLUGS),
    symbolic_clothing: pick("symbolic_clothing", CLOTHING_SLUGS),
  };
}

const VISUAL_EMOJI: Record<string, string> = {
  sun: "☀️",
  rain: "🌧️",
  sea: "🌊",
  city: "🏙️",
  home: "🏠",
  road: "🛣️",
  forest: "🌲",
  stage: "🎭",
  workshop: "🔧",
  airport: "✈️",
  fire: "🔥",
  sunrise: "🌅",
};

export function NewProjectWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId");

  const [loading, setLoading] = useState(!!projectIdFromUrl);
  const [saving, setSaving] = useState(false);
  const [strategicExitLoading, setStrategicExitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(projectIdFromUrl);
  const [activeStep, setActiveStep] = useState(0);
  const [serverCompletedSteps, setServerCompletedSteps] = useState<string[]>(
    [],
  );

  const [nameOrDescriptor, setNameOrDescriptor] = useState("");
  const [nameStatus, setNameStatus] = useState<NameStatus | null>(null);
  const [challengeType, setChallengeType] = useState<ChallengeType | null>(
    null,
  );
  const [challengeExplanation, setChallengeExplanation] = useState("");
  const [mainChallenge, setMainChallenge] = useState<MainChallenge | null>(
    null,
  );
  const [simpleDescription, setSimpleDescription] = useState("");
  const [offeringType, setOfferingType] = useState<OfferingType | null>(null);
  const [problemCategory, setProblemCategory] =
    useState<ProblemCategory | null>(null);
  const [problemDescriptionOptional, setProblemDescriptionOptional] =
    useState("");

  const [transformationType, setTransformationType] =
    useState<TransformationType | null>(null);
  const [transformationFrom, setTransformationFrom] = useState("");
  const [transformationTo, setTransformationTo] = useState("");

  const [audienceType, setAudienceType] = useState<AudienceType | null>(null);
  const [audienceDescriptionOptional, setAudienceDescriptionOptional] =
    useState("");

  const [currentEmotion, setCurrentEmotion] =
    useState<CurrentEmotion | null>(null);
  const [desiredEmotion, setDesiredEmotion] =
    useState<DesiredEmotion | null>(null);
  const [desiredAction, setDesiredAction] = useState<DesiredAction | null>(
    null,
  );

  const [whyNow, setWhyNow] = useState<WhyNow | null>(null);
  const [whyNowNoteOptional, setWhyNowNoteOptional] = useState("");

  const [selectedTension, setSelectedTension] =
    useState<CentralTension | null>(null);
  const [tensionNoteOptional, setTensionNoteOptional] = useState("");

  const [evidenceTypes, setEvidenceTypes] = useState<string[]>([]);
  const [evidenceDetails, setEvidenceDetails] = useState<
    Record<string, string>
  >({});

  const [hasRestrictedClaims, setHasRestrictedClaims] =
    useState<RestrictedClaimsAnswer | null>(null);
  const [restrictedClaimsText, setRestrictedClaimsText] = useState("");

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [colorFeeling, setColorFeeling] = useState<string | null>(null);
  const [sensorySmell, setSensorySmell] = useState<string | null>(null);
  const [sensoryMovement, setSensoryMovement] = useState<string | null>(null);
  const [sensoryEmotionalAge, setSensoryEmotionalAge] = useState<string | null>(
    null,
  );
  const [sensoryClothing, setSensoryClothing] = useState<string | null>(null);
  const [emotionalIntensity, setEmotionalIntensity] = useState<number | null>(
    null,
  );
  const [desiredVoiceTraits, setDesiredVoiceTraits] = useState<string[]>([]);
  const [avoidedVoiceTraits, setAvoidedVoiceTraits] = useState<string[]>([]);
  const [voiceComparisonDesired, setVoiceComparisonDesired] = useState("");
  const [voiceComparisonAvoided, setVoiceComparisonAvoided] = useState("");
  const [voiceSentenceOptional, setVoiceSentenceOptional] = useState("");

  const patchProject = useCallback(
    async (pid: string, body: Record<string, unknown>) => {
      const res = await fetch(`/api/projects/${pid}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "No se pudo actualizar el proyecto",
        );
      }
      return json as { project: unknown };
    },
    [],
  );

  const patchResponses = useCallback(
    async (pid: string, body: Record<string, unknown>) => {
      const res = await fetch(`/api/projects/${pid}/responses`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "No se pudieron guardar las respuestas",
        );
      }
      return json;
    },
    [],
  );

  const exitAfterEditSaveIfApplicable = useCallback(
    (pid: string, savedStepIndex: number): boolean => {
      const es = searchParams.get("editStep");
      const rt = searchParams.get("returnTo");
      if (!es || (rt !== "review" && rt !== "project")) return false;
      if (!WIZARD_STEP_ORDER.includes(es as WizardStepId)) return false;
      const targetIdx = WIZARD_STEP_ORDER.indexOf(es as WizardStepId);
      if (targetIdx !== savedStepIndex) return false;
      if (rt === "review") {
        router.replace(`/projects/new?projectId=${encodeURIComponent(pid)}`);
        setActiveStep(22);
        return true;
      }
      if (rt === "project") {
        router.replace(`/projects/${encodeURIComponent(pid)}`);
        return true;
      }
      return false;
    },
    [router, searchParams],
  );

  useEffect(() => {
    setProjectId(projectIdFromUrl);
  }, [projectIdFromUrl]);

  useEffect(() => {
    if (!projectIdFromUrl || loading) return;
    const es = searchParams.get("editStep");
    if (!es || !WIZARD_STEP_ORDER.includes(es as WizardStepId)) return;
    const idx = WIZARD_STEP_ORDER.indexOf(es as WizardStepId);
    if (idx < 0 || idx >= WIZARD_STEP_COUNT) return;
    setActiveStep(idx);
  }, [projectIdFromUrl, loading, searchParams]);

  useEffect(() => {
    if (!projectIdFromUrl) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [pRes, rRes] = await Promise.all([
          fetch(`/api/projects/${projectIdFromUrl}`, {
            credentials: "include",
          }),
          fetch(`/api/projects/${projectIdFromUrl}/responses`, {
            credentials: "include",
          }),
        ]);
        if (!pRes.ok) throw new Error("No se pudo cargar el proyecto");
        const pJson = (await pRes.json()) as {
          project: {
            name_or_descriptor: string;
            name_status: NameStatus;
            challenge_type: string | null;
            main_challenge: string | null;
          };
        };
        const rJson = (await rRes.json()) as {
          project_responses: {
            responses: Record<string, unknown>;
            completed_steps: string[];
          } | null;
        };
        if (cancelled) return;

        const p = pJson.project;
        setNameOrDescriptor(p.name_or_descriptor ?? "");
        setNameStatus(
          nameStatusSchema.safeParse(p.name_status).success
            ? p.name_status
            : "provisional",
        );

        const ct = p.challenge_type ?? "";
        setChallengeType(isChallengeType(ct) ? ct : null);
        const mc = p.main_challenge ?? "";
        setMainChallenge(isMainChallenge(mc) ? mc : null);

        const resp = rJson.project_responses?.responses ?? {};
        const sb = readStrategicBase(resp);
        setSimpleDescription(
          typeof sb.simple_description === "string"
            ? sb.simple_description
            : "",
        );
        const ot = typeof sb.offering_type === "string" ? sb.offering_type : "";
        setOfferingType(isOfferingType(ot) ? ot : null);
        const pc =
          typeof sb.problem_category === "string" ? sb.problem_category : "";
        setProblemCategory(isProblemCategory(pc) ? pc : null);
        setProblemDescriptionOptional(
          typeof sb.problem_description_optional === "string"
            ? sb.problem_description_optional
            : "",
        );

        const tt =
          typeof sb.transformation_type === "string"
            ? sb.transformation_type
            : "";
        setTransformationType(isTransformationType(tt) ? tt : null);
        setTransformationFrom(
          typeof sb.transformation_from === "string"
            ? sb.transformation_from
            : "",
        );
        setTransformationTo(
          typeof sb.transformation_to === "string" ? sb.transformation_to : "",
        );

        const wn = typeof sb.why_now === "string" ? sb.why_now : "";
        setWhyNow(isWhyNow(wn) ? wn : null);
        setWhyNowNoteOptional(
          typeof sb.why_now_note_optional === "string"
            ? sb.why_now_note_optional
            : "",
        );

        const st =
          typeof sb.selected_tension === "string" ? sb.selected_tension : "";
        setSelectedTension(isCentralTension(st) ? st : null);
        setTensionNoteOptional(
          typeof sb.tension_note_optional === "string"
            ? sb.tension_note_optional
            : "",
        );

        const ab = readAudienceBase(resp);
        const at = typeof ab.audience_type === "string" ? ab.audience_type : "";
        setAudienceType(isAudienceType(at) ? at : null);
        setAudienceDescriptionOptional(
          typeof ab.audience_description_optional === "string"
            ? ab.audience_description_optional
            : "",
        );

        const ce =
          typeof ab.current_emotion === "string" ? ab.current_emotion : "";
        setCurrentEmotion(isCurrentEmotion(ce) ? ce : null);
        const de =
          typeof ab.desired_emotion === "string" ? ab.desired_emotion : "";
        setDesiredEmotion(isDesiredEmotion(de) ? de : null);
        const da =
          typeof ab.desired_action === "string" ? ab.desired_action : "";
        setDesiredAction(isDesiredAction(da) ? da : null);

        const eb = readEvidenceBase(resp);
        setEvidenceTypes(parseEvidenceTypes(eb.evidence_types));
        setEvidenceDetails(parseEvidenceDetails(eb.evidence_details));

        const hrc = eb.has_restricted_claims;
        if (hrc === true) {
          setHasRestrictedClaims("yes");
        } else if (hrc === false) {
          setHasRestrictedClaims("no");
        } else if (hrc === null) {
          setHasRestrictedClaims("unsure");
        } else {
          setHasRestrictedClaims(null);
        }
        setRestrictedClaimsText(
          typeof eb.restricted_claims === "string" ? eb.restricted_claims : "",
        );

        const lb = readLimbicBase(resp);
        setSelectedImages(
          parseStringArray(lb.selected_images, VISUAL_SLUGS),
        );
        const sc = typeof lb.selected_color === "string" ? lb.selected_color : "";
        setSelectedColor(COLOR_SLUGS.has(sc) ? sc : null);
        const cf =
          typeof lb.color_feeling === "string" ? lb.color_feeling : "";
        setColorFeeling(COLOR_FEELING_SLUGS.has(cf) ? cf : null);
        const sens = parseSensoryChoices(lb.sensory_choices);
        setSensorySmell(sens.smell);
        setSensoryMovement(sens.movement);
        setSensoryEmotionalAge(sens.emotional_age);
        setSensoryClothing(sens.symbolic_clothing);
        const ei = lb.emotional_intensity;
        setEmotionalIntensity(
          typeof ei === "number" && ei >= 1 && ei <= 5 && Number.isInteger(ei)
            ? ei
            : null,
        );

        const vb = readVoiceBase(resp);
        setDesiredVoiceTraits(
          parseStringArray(vb.desired_voice_traits, DESIRED_VOICE_SLUGS),
        );
        setAvoidedVoiceTraits(
          parseStringArray(vb.avoided_voice_traits, AVOIDED_VOICE_SLUGS),
        );
        const vcRaw = vb.voice_comparison;
        if (vcRaw && typeof vcRaw === "object" && !Array.isArray(vcRaw)) {
          const vcO = vcRaw as Record<string, unknown>;
          setVoiceComparisonDesired(
            typeof vcO.desired === "string" ? vcO.desired : "",
          );
          setVoiceComparisonAvoided(
            typeof vcO.avoided === "string" ? vcO.avoided : "",
          );
        } else {
          setVoiceComparisonDesired("");
          setVoiceComparisonAvoided("");
        }
        setVoiceSentenceOptional(
          typeof vb.voice_sentence_optional === "string"
            ? vb.voice_sentence_optional
            : "",
        );

        const completed = rJson.project_responses?.completed_steps ?? [];
        const normalizedCompleted = normalizeServerCompletedSteps(completed);
        setServerCompletedSteps(normalizedCompleted);
        setActiveStep(firstIncompleteStep(normalizedCompleted));

        const ccRaw = resp.challenge_context;
        if (ccRaw && typeof ccRaw === "object" && !Array.isArray(ccRaw)) {
          const cc = ccRaw as Record<string, unknown>;
          const expl = cc.challenge_explanation;
          if (typeof expl === "string") {
            setChallengeExplanation(expl);
          }
          const nestedCt = cc.challenge_type;
          if (
            typeof nestedCt === "string" &&
            isChallengeType(nestedCt) &&
            !p.challenge_type
          ) {
            setChallengeType(nestedCt);
          }
        }

        const ctResp = resp.challenge_type;
        if (
          typeof ctResp === "string" &&
          isChallengeType(ctResp) &&
          !p.challenge_type
        ) {
          setChallengeType(ctResp);
        }
        const mcResp = resp.main_challenge;
        if (
          typeof mcResp === "string" &&
          isMainChallenge(mcResp) &&
          !p.main_challenge
        ) {
          setMainChallenge(mcResp);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectIdFromUrl]);

  const stepHeading =
    WIZARD_STEP_TITLES[WIZARD_STEP_ORDER[activeStep] ?? "project_identity"];

  const toggleVisualImage = (slug: string) => {
    setSelectedImages((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 3) return prev;
      return [...prev, slug];
    });
  };

  const toggleVoiceTrait = (
    slug: string,
    setter: Dispatch<SetStateAction<string[]>>,
    allowed: Set<string>,
    max: number,
  ) => {
    if (!allowed.has(slug)) return;
    setter((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= max) return prev;
      return [...prev, slug];
    });
  };

  const toggleEvidenceType = (slug: EvidenceTypeSlug) => {
    if (slug === NO_CLEAR_EVIDENCE) {
      setEvidenceTypes([NO_CLEAR_EVIDENCE]);
      setEvidenceDetails({});
      return;
    }
    setEvidenceTypes((prev) => {
      const withoutNoClear = prev.filter((t) => t !== NO_CLEAR_EVIDENCE);
      if (withoutNoClear.includes(slug)) {
        return withoutNoClear.filter((t) => t !== slug);
      }
      return [...withoutNoClear, slug];
    });
  };

  const setEvidenceDetailFor = (slug: string, value: string) => {
    setEvidenceDetails((d) => ({ ...d, [slug]: value }));
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((s) => Math.max(0, s - 1));
  };

  const handleContinue = async () => {
    setError(null);
    setSaving(true);
    try {
      const returnToParam = searchParams.get("returnTo");

      if (activeStep === 0) {
        if (!nameOrDescriptor.trim()) {
          throw new Error("Escribe cómo llamaremos al proyecto.");
        }
        if (!nameStatus) {
          throw new Error(
            "Elige si el nombre es definitivo, provisional o aún no tienes nombre.",
          );
        }

        let pid = projectId;
        let replaceUrlAfterSave: string | null = null;
        if (!pid) {
          const res = await fetch("/api/projects", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name_or_descriptor: nameOrDescriptor.trim(),
              name_status: nameStatus,
            }),
          });
          const json = await res.json();
          if (!res.ok) {
            throw new Error(
              typeof json.error === "string"
                ? json.error
                : "No se pudo crear el proyecto",
            );
          }
          pid = (json as { project: { id: string } }).project.id;
          setProjectId(pid);
          replaceUrlAfterSave = pid;
        } else {
          await patchProject(pid, {
            name_or_descriptor: nameOrDescriptor.trim(),
            name_status: nameStatus,
          });
        }

        if (!replaceUrlAfterSave) {
          {
            const nextCompleted = completedStepsForSave(0, {
              returnTo: returnToParam,
              serverCompletedSteps,
            });
            await patchResponses(pid, {
              responses: {
                project_identity: {
                  name_or_descriptor: nameOrDescriptor.trim(),
                  name_status: nameStatus,
                },
              },
              completed_steps: nextCompleted,
            });
            setServerCompletedSteps(nextCompleted);
          }
        }
        if (replaceUrlAfterSave) {
          router.replace(`/projects/new?projectId=${replaceUrlAfterSave}`);
        }
        if (exitAfterEditSaveIfApplicable(pid, 0)) return;
        setActiveStep(1);
        return;
      }

      const pid = projectId;
      if (!pid) throw new Error("Falta el proyecto. Vuelve al paso 1.");

      if (activeStep === 1) {
        if (!challengeType) {
          throw new Error("Elige qué estás comunicando mejor.");
        }
        const explanation = challengeExplanation.trim();
        if (!explanation) {
          throw new Error("Explica tu reto de comunicación.");
        }
        if (explanation.length < 20) {
          throw new Error(
            "La explicación debe tener al menos 20 caracteres.",
          );
        }
        await patchProject(pid, { challenge_type: challengeType });
        {
          const nextCompleted = completedStepsForSave(1, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              challenge_type: challengeType,
              challenge_context: {
                challenge_type: challengeType,
                challenge_explanation: explanation,
              },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 1)) return;
        setActiveStep(2);
        return;
      }

      if (activeStep === 2) {
        if (!mainChallenge) {
          throw new Error("Elige el problema de comunicación principal.");
        }
        await patchProject(pid, { main_challenge: mainChallenge });
        {
          const nextCompleted = completedStepsForSave(2, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: { main_challenge: mainChallenge },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 2)) return;
        setActiveStep(3);
        return;
      }

      if (activeStep === 3) {
        if (!simpleDescription.trim()) {
          throw new Error("Describe brevemente qué es este proyecto.");
        }
        if (!offeringType) {
          throw new Error("Elige en qué se parece más lo que ofreces.");
        }
        {
          const nextCompleted = completedStepsForSave(3, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              strategic_base: {
                simple_description: simpleDescription.trim(),
                offering_type: offeringType,
              },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 3)) return;
        setActiveStep(4);
        return;
      }

      if (activeStep === 4) {
        if (!problemCategory) {
          throw new Error(
            "Elige qué problema o necesidad resuelve principalmente.",
          );
        }
        const optional = problemDescriptionOptional.trim();
        {
          const nextCompleted = completedStepsForSave(4, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              strategic_base: {
                problem_category: problemCategory,
                ...(optional
                  ? { problem_description_optional: optional }
                  : { problem_description_optional: null }),
              },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 4)) return;
        setActiveStep(5);
        return;
      }

      if (activeStep === 5) {
        if (!transformationType) {
          throw new Error("Elige la transformación que prometes.");
        }
        const from = transformationFrom.trim();
        const to = transformationTo.trim();
        {
          const nextCompleted = completedStepsForSave(5, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              strategic_base: {
                transformation_type: transformationType,
                ...(from
                  ? { transformation_from: from }
                  : { transformation_from: null }),
                ...(to ? { transformation_to: to } : { transformation_to: null }),
              },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 5)) return;
        setActiveStep(6);
        return;
      }

      if (activeStep === 6) {
        if (!audienceType) {
          throw new Error("Elige tu audiencia principal.");
        }
        const audOpt = audienceDescriptionOptional.trim();
        {
          const nextCompleted = completedStepsForSave(6, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              audience_base: {
                audience_type: audienceType,
                ...(audOpt
                  ? { audience_description_optional: audOpt }
                  : { audience_description_optional: null }),
              },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 6)) return;
        setActiveStep(7);
        return;
      }

      if (activeStep === 7) {
        if (!currentEmotion) {
          throw new Error("Elige cómo se siente hoy tu audiencia.");
        }
        {
          const nextCompleted = completedStepsForSave(7, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              audience_base: { current_emotion: currentEmotion },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 7)) return;
        setActiveStep(8);
        return;
      }

      if (activeStep === 8) {
        if (!desiredEmotion) {
          throw new Error("Elige cómo quieres que se sienta después.");
        }
        {
          const nextCompleted = completedStepsForSave(8, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              audience_base: { desired_emotion: desiredEmotion },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 8)) return;
        setActiveStep(9);
        return;
      }

      if (activeStep === 9) {
        if (!desiredAction) {
          throw new Error("Elige la acción que esperas.");
        }
        {
          const nextCompleted = completedStepsForSave(9, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              audience_base: { desired_action: desiredAction },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 9)) return;
        setActiveStep(10);
        return;
      }

      if (activeStep === 10) {
        if (!whyNow) {
          throw new Error("Elige por qué importa comunicar esto ahora.");
        }
        const wnNote = whyNowNoteOptional.trim();
        {
          const nextCompleted = completedStepsForSave(10, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              strategic_base: {
                why_now: whyNow,
                ...(wnNote
                  ? { why_now_note_optional: wnNote }
                  : { why_now_note_optional: null }),
              },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 10)) return;
        setActiveStep(11);
        return;
      }

      if (activeStep === 11) {
        if (!selectedTension) {
          throw new Error("Elige la tensión principal.");
        }
        const tn = tensionNoteOptional.trim();
        {
          const nextCompleted = completedStepsForSave(11, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              strategic_base: {
                selected_tension: selectedTension,
                ...(tn
                  ? { tension_note_optional: tn }
                  : { tension_note_optional: null }),
              },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 11)) return;
        setActiveStep(12);
        return;
      }

      if (activeStep === 12) {
        if (evidenceTypes.length === 0) {
          throw new Error("Selecciona al menos un tipo de evidencia.");
        }
        if (
          evidenceTypes.includes(NO_CLEAR_EVIDENCE) &&
          evidenceTypes.length > 1
        ) {
          throw new Error(
            'Si eliges "Todavía no tengo evidencia clara", no combines con otros tipos.',
          );
        }
        {
          const nextCompleted = completedStepsForSave(12, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          if (evidenceTypes.includes(NO_CLEAR_EVIDENCE)) {
            await patchResponses(pid, {
              responses: {
                evidence_base: {
                  evidence_types: [NO_CLEAR_EVIDENCE],
                  evidence_details: {},
                },
              },
              completed_steps: nextCompleted,
            });
          } else {
            const detailsOut: Record<string, string> = {};
            for (const t of evidenceTypes) {
              const label =
                EVIDENCE_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
              const detail = (evidenceDetails[t] ?? "").trim();
              if (!detail) {
                throw new Error(`Agrega un detalle breve para: ${label}`);
              }
              detailsOut[t] = detail;
            }
            await patchResponses(pid, {
              responses: {
                evidence_base: {
                  evidence_types: [...evidenceTypes],
                  evidence_details: detailsOut,
                },
              },
              completed_steps: nextCompleted,
            });
          }
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 12)) return;
        setActiveStep(13);
        return;
      }

      if (activeStep === 13) {
        if (!hasRestrictedClaims) {
          throw new Error("Indica si hay promesas o afirmaciones restringidas.");
        }
        if (hasRestrictedClaims === "yes" && !restrictedClaimsText.trim()) {
          throw new Error(
            "Describe brevemente qué afirmaciones o promesas están restringidas.",
          );
        }
        const hrc =
          hasRestrictedClaims === "yes"
            ? true
            : hasRestrictedClaims === "no"
              ? false
              : null;
        const rc =
          hasRestrictedClaims === "yes"
            ? restrictedClaimsText.trim()
            : null;
        {
          const nextCompleted = completedStepsForSave(13, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              evidence_base: {
                has_restricted_claims: hrc,
                restricted_claims: rc,
              },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 13)) return;
        setActiveStep(14);
        return;
      }

      if (activeStep === 14) {
        {
          const nextCompleted = completedStepsForSave(14, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              limbic_base: { limbic_intro_seen: true },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 14)) return;
        setActiveStep(15);
        return;
      }

      if (activeStep === 15) {
        if (selectedImages.length !== 3) {
          throw new Error("Elige exactamente 3 imágenes de atmósfera.");
        }
        {
          const nextCompleted = completedStepsForSave(15, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              limbic_base: { selected_images: [...selectedImages] },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 15)) return;
        setActiveStep(16);
        return;
      }

      if (activeStep === 16) {
        if (!selectedColor) throw new Error("Elige un color emocional.");
        if (!colorFeeling) throw new Error("Elige cómo se siente ese color.");
        {
          const nextCompleted = completedStepsForSave(16, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              limbic_base: {
                selected_color: selectedColor,
                color_feeling: colorFeeling,
              },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 16)) return;
        setActiveStep(17);
        return;
      }

      if (activeStep === 17) {
        if (!sensorySmell) throw new Error("Elige una opción de olor.");
        if (!sensoryMovement) throw new Error("Elige un movimiento o transporte.");
        if (!sensoryEmotionalAge) {
          throw new Error("Elige una edad emocional.");
        }
        if (!sensoryClothing) throw new Error("Elige una opción de vestuario.");
        {
          const nextCompleted = completedStepsForSave(17, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              limbic_base: {
                sensory_choices: {
                  smell: sensorySmell,
                  movement: sensoryMovement,
                  emotional_age: sensoryEmotionalAge,
                  symbolic_clothing: sensoryClothing,
                },
              },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 17)) return;
        setActiveStep(18);
        return;
      }

      if (activeStep === 18) {
        if (emotionalIntensity === null) {
          throw new Error("Elige la intensidad emocional de la comunicación.");
        }
        {
          const nextCompleted = completedStepsForSave(18, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              limbic_base: { emotional_intensity: emotionalIntensity },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 18)) return;
        setActiveStep(19);
        return;
      }

      if (activeStep === 19) {
        if (desiredVoiceTraits.length === 0) {
          throw new Error("Elige al menos un rasgo de voz (máximo 3).");
        }
        if (desiredVoiceTraits.length > 3) {
          throw new Error("Como máximo 3 rasgos de voz.");
        }
        {
          const nextCompleted = completedStepsForSave(19, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              voice_base: { desired_voice_traits: [...desiredVoiceTraits] },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 19)) return;
        setActiveStep(20);
        return;
      }

      if (activeStep === 20) {
        if (avoidedVoiceTraits.length === 0) {
          throw new Error("Elige al menos un tono a evitar (máximo 3).");
        }
        if (avoidedVoiceTraits.length > 3) {
          throw new Error("Como máximo 3 tonos a evitar.");
        }
        {
          const nextCompleted = completedStepsForSave(20, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              voice_base: { avoided_voice_traits: [...avoidedVoiceTraits] },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 20)) return;
        setActiveStep(21);
        return;
      }

      if (activeStep === 21) {
        const d = voiceComparisonDesired.trim();
        const a = voiceComparisonAvoided.trim();
        const sent = voiceSentenceOptional.trim();
        {
          const nextCompleted = completedStepsForSave(21, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              voice_base: {
                voice_comparison: {
                  desired: d ? d : null,
                  avoided: a ? a : null,
                },
                voice_sentence_optional: sent ? sent : null,
              },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }
        if (exitAfterEditSaveIfApplicable(pid, 21)) return;
        setActiveStep(22);
        return;
      }

      if (activeStep === 22) {
        {
          const nextCompleted = completedStepsForSave(22, {
            returnTo: returnToParam,
            serverCompletedSteps,
          });
          await patchResponses(pid, {
            responses: {
              review: { user_confirmed_inputs: true },
            },
            completed_steps: nextCompleted,
          });
          setServerCompletedSteps(nextCompleted);
        }

        setStrategicExitLoading(true);
        setError(null);
        try {
          const statusRes = await fetch(`/api/projects/${pid}/status`, {
            credentials: "include",
          });
          const statusJson = (await statusRes.json().catch(() => ({}))) as {
            active_master_document?: unknown;
            responses_have_changed_since_master?: boolean;
            error?: unknown;
          };
          if (!statusRes.ok) {
            throw new Error(
              typeof statusJson.error === "string"
                ? statusJson.error
                : "No se pudo comprobar el estado del proyecto.",
            );
          }

          const hasActiveMaster = Boolean(statusJson.active_master_document);
          const unchangedSinceMaster =
            statusJson.responses_have_changed_since_master === false;

          let mustCallGenerateMaster = !hasActiveMaster;
          if (hasActiveMaster && unchangedSinceMaster) {
            mustCallGenerateMaster = false;
          } else if (hasActiveMaster && !unchangedSinceMaster) {
            mustCallGenerateMaster = window.confirm(
              "Tus respuestas cambiaron respecto a la Lectura Límbica actual. ¿Actualizar el Sistema Límbico con los datos nuevos?",
            );
          }

          if (mustCallGenerateMaster) {
            const evalRes = await fetch(
              `/api/projects/${pid}/evaluate-questionnaire`,
              {
                method: "POST",
                credentials: "include",
              },
            );
            const evalJson = (await evalRes.json().catch(() => ({}))) as {
              requires_clarification?: unknown;
              error?: unknown;
            };
            if (!evalRes.ok) {
              throw new Error(
                typeof evalJson.error === "string"
                  ? evalJson.error
                  : "No se pudo evaluar el cuestionario antes del Sistema Límbico.",
              );
            }
            if (evalJson.requires_clarification === true) {
              router.refresh();
              router.push(
                `/projects/${encodeURIComponent(pid)}/questionnaire-clarify`,
              );
              return;
            }

            const genRes = await fetch(
              `/api/projects/${pid}/generate-master`,
              {
                method: "POST",
                credentials: "include",
              },
            );
            const genJson = (await genRes.json().catch(() => ({}))) as {
              error?: unknown;
            };
            if (!genRes.ok) {
              throw new Error(
                typeof genJson.error === "string"
                  ? genJson.error
                  : "No se pudo generar la Lectura Límbica.",
              );
            }
          }

          router.refresh();
          router.push(`/projects/${pid}`);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Error al construir la Lectura Límbica.",
          );
        } finally {
          setStrategicExitLoading(false);
        }
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const optionBtnClass =
    "h-auto min-h-[3.25rem] w-full justify-start whitespace-normal px-4 py-3 text-left text-sm font-normal leading-snug shadow-sm";

  const lastStepIndex = WIZARD_STEP_COUNT - 1;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <Card className="rounded-[22px] border border-limbi-border bg-limbi-surface shadow-limbi">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div
              className="size-8 animate-pulse rounded-full border-2 border-limbi-border border-t-limbi-green"
              aria-hidden
            />
            <p className="text-sm text-limbi-muted">
              {limbiLoadingMessage(`wizard-load-${projectId ?? "new"}`)}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {strategicExitLoading ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm"
          role="alertdialog"
          aria-busy="true"
          aria-label="Actualizando Sistema Límbico"
        >
          <Card className="max-w-md rounded-[22px] border border-limbi-border bg-limbi-surface shadow-limbi">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <Loader2
                className="size-10 animate-spin text-limbi-green"
                aria-hidden
              />
              <p className="text-base font-medium text-limbi-text">
                {limbiLoadingMessage(`wizard-strategic-${projectId ?? "new"}`)}
              </p>
              <p className="text-sm text-limbi-muted">
                Esto puede tardar un minuto. No cierres la ventana.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-4 sm:px-6 sm:pb-16 sm:pt-6">
      <div
        className="mb-6 flex gap-2 sm:mb-8"
        role="status"
        aria-label={`Paso ${activeStep + 1} de ${WIZARD_STEP_COUNT}`}
      >
        {Array.from({ length: WIZARD_STEP_COUNT }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col gap-1">
            <div
              className={cn(
                "h-2.5 w-full rounded-full transition-all duration-300",
                i < activeStep
                  ? "bg-limbi-green"
                  : i === activeStep
                    ? "bg-gradient-to-r from-limbi-green to-limbi-aqua ring-2 ring-limbi-green/35 ring-offset-2 ring-offset-background"
                    : "bg-limbi-border",
              )}
              aria-hidden
            />
            <span className="sr-only">
              Paso {i + 1}
              {i <= activeStep ? " completado o activo" : " pendiente"}
            </span>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/80 px-4 py-3 text-sm leading-relaxed text-limbi-text shadow-limbi">
        Tus respuestas alimentan la memoria narrativa del sistema. Limbi las
        interpreta como señales estratégicas, emocionales y simbólicas; no como
        instrucciones literales.
      </div>

      <Card className="overflow-hidden rounded-[22px] border border-limbi-border bg-limbi-surface shadow-limbi">
        <CardHeader className="space-y-1 border-b border-limbi-border/80 bg-limbi-surface-soft/90 pb-4">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-limbi-muted">
            Paso {activeStep + 1} de {WIZARD_STEP_COUNT}
          </p>
          <CardTitle className="font-heading text-xl sm:text-2xl">
            {stepHeading}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {error ? (
            <p
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {activeStep === 0 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Cómo llamaremos este sistema por ahora?
              </CardDescription>
              <Input
                value={nameOrDescriptor}
                onChange={(e) => setNameOrDescriptor(e.target.value)}
                placeholder="Nombre o descriptor"
                autoComplete="off"
                className="h-11 text-base"
              />
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Estado del nombre
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {NAME_STATUS_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={
                        nameStatus === opt.value ? "default" : "outline"
                      }
                      className={optionBtnClass}
                      onClick={() => setNameStatus(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === 1 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Qué estás tratando de comunicar mejor?
              </CardDescription>
              <div className="grid gap-2 sm:grid-cols-2">
                {CHALLENGE_TYPE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      challengeType === opt.value ? "default" : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => setChallengeType(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Explica tu reto de comunicación
                </p>
                <Textarea
                  value={challengeExplanation}
                  onChange={(e) => setChallengeExplanation(e.target.value)}
                  placeholder="¿Para qué necesitas esta estrategia? Cuéntanos qué quieres resolver, ordenar, explicar, vender, cambiar o mejorar con esta comunicación."
                  rows={5}
                  className="min-h-[120px] resize-y text-base"
                  aria-label="Explica tu reto de comunicación"
                />
              </div>
            </div>
          ) : null}

          {activeStep === 2 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Cuál es el problema de comunicación que quieres resolver?
              </CardDescription>
              <div className="grid gap-2">
                {MAIN_CHALLENGE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      mainChallenge === opt.value ? "default" : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => setMainChallenge(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {activeStep === 3 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                A diferencia del paso anterior, aquí no necesitamos toda la
                explicación del reto. Resume en 1 o 2 líneas la esencia de lo que
                estás comunicando.
              </CardDescription>
              <Textarea
                value={simpleDescription}
                onChange={(e) => setSimpleDescription(e.target.value)}
                placeholder="Descripción corta"
                rows={4}
                className="min-h-[120px] resize-y text-base"
              />
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Lo que ofrezco se parece más a:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {OFFERING_TYPE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={
                        offeringType === opt.value ? "default" : "outline"
                      }
                      className={optionBtnClass}
                      onClick={() => setOfferingType(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === 4 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                Este proyecto ayuda principalmente a resolver:
              </CardDescription>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROBLEM_CATEGORY_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      problemCategory === opt.value ? "default" : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => setProblemCategory(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Detalle opcional
                </p>
                <Textarea
                  value={problemDescriptionOptional}
                  onChange={(e) => setProblemDescriptionOptional(e.target.value)}
                  placeholder="Opcional: amplía el contexto"
                  rows={3}
                  className="min-h-[88px] resize-y"
                />
              </div>
            </div>
          ) : null}

          {activeStep === 5 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Qué transformación prometes a tu audiencia?
              </CardDescription>
              <div className="grid gap-2 sm:grid-cols-2">
                {TRANSFORMATION_TYPE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      transformationType === opt.value ? "default" : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => setTransformationType(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Desde (opcional)
                  </p>
                  <Input
                    value={transformationFrom}
                    onChange={(e) => setTransformationFrom(e.target.value)}
                    placeholder="Estado inicial"
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Hacia (opcional)
                  </p>
                  <Input
                    value={transformationTo}
                    onChange={(e) => setTransformationTo(e.target.value)}
                    placeholder="Estado deseado"
                    className="text-base"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === 6 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Quién es tu audiencia principal?
              </CardDescription>
              <div className="grid gap-2 sm:grid-cols-2">
                {AUDIENCE_TYPE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      audienceType === opt.value ? "default" : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => setAudienceType(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Detalle opcional
                </p>
                <Textarea
                  value={audienceDescriptionOptional}
                  onChange={(e) =>
                    setAudienceDescriptionOptional(e.target.value)
                  }
                  placeholder="Opcional: perfil o contexto"
                  rows={3}
                  className="min-h-[88px] resize-y"
                />
              </div>
            </div>
          ) : null}

          {activeStep === 7 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Cómo se siente hoy tu audiencia respecto a este tema?
              </CardDescription>
              <div className="grid gap-2 sm:grid-cols-2">
                {CURRENT_EMOTION_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      currentEmotion === opt.value ? "default" : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => setCurrentEmotion(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {activeStep === 8 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Cómo quieres que se sienta después de interactuar contigo?
              </CardDescription>
              <div className="grid gap-2 sm:grid-cols-2">
                {DESIRED_EMOTION_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      desiredEmotion === opt.value ? "default" : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => setDesiredEmotion(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {activeStep === 9 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Qué acción esperas que tome tu audiencia?
              </CardDescription>
              <div className="grid gap-2 sm:grid-cols-2">
                {DESIRED_ACTION_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      desiredAction === opt.value ? "default" : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => setDesiredAction(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {activeStep === 10 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Por qué importa comunicar esto ahora?
              </CardDescription>
              <div className="grid gap-2">
                {WHY_NOW_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={whyNow === opt.value ? "default" : "outline"}
                    className={optionBtnClass}
                    onClick={() => setWhyNow(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Nota opcional
                </p>
                <Textarea
                  value={whyNowNoteOptional}
                  onChange={(e) => setWhyNowNoteOptional(e.target.value)}
                  placeholder="Opcional"
                  rows={2}
                  className="resize-y"
                />
              </div>
            </div>
          ) : null}

          {activeStep === 11 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Cuál es la tensión principal que sientes?
              </CardDescription>
              <div className="grid gap-2">
                {CENTRAL_TENSION_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      selectedTension === opt.value ? "default" : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => setSelectedTension(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Nota opcional
                </p>
                <Textarea
                  value={tensionNoteOptional}
                  onChange={(e) => setTensionNoteOptional(e.target.value)}
                  placeholder="Opcional"
                  rows={2}
                  className="resize-y"
                />
              </div>
            </div>
          ) : null}

          {activeStep === 12 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                Marca los tipos de evidencia que tienes. Para cada uno, añade un
                detalle breve.
              </CardDescription>
              <div className="grid gap-2 sm:grid-cols-2">
                {EVIDENCE_TYPE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      evidenceTypes.includes(opt.value)
                        ? "default"
                        : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => toggleEvidenceType(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              {evidenceTypes.filter((t) => t !== NO_CLEAR_EVIDENCE).length >
              0 ? (
                <div className="space-y-4 border-t border-border/60 pt-4">
                  {evidenceTypes
                    .filter((t) => t !== NO_CLEAR_EVIDENCE)
                    .map((slug) => {
                      const label =
                        EVIDENCE_TYPE_OPTIONS.find((o) => o.value === slug)
                          ?.label ?? slug;
                      return (
                        <div key={slug} className="space-y-2">
                          <p className="text-sm font-medium text-foreground">
                            {label}
                          </p>
                          <Input
                            value={evidenceDetails[slug] ?? ""}
                            onChange={(e) =>
                              setEvidenceDetailFor(slug, e.target.value)
                            }
                            placeholder="Detalle breve"
                            className="text-base"
                          />
                        </div>
                      );
                    })}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeStep === 13 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Hay promesas o afirmaciones que no puedes o no quieres hacer
                por regulación, política o veracidad?
              </CardDescription>
              <div className="grid gap-2 sm:grid-cols-3">
                {RESTRICTED_CLAIMS_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      hasRestrictedClaims === opt.value
                        ? "default"
                        : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => setHasRestrictedClaims(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              {hasRestrictedClaims === "yes" ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Describe las restricciones
                  </p>
                  <Textarea
                    value={restrictedClaimsText}
                    onChange={(e) => setRestrictedClaimsText(e.target.value)}
                    placeholder="Ej.: no podemos prometer resultados médicos…"
                    rows={4}
                    className="min-h-[100px] resize-y"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {activeStep === 14 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                No todo se entiende solo con datos. También necesitamos descubrir
                la atmósfera, la energía y la personalidad emocional de tu
                comunicación.
              </CardDescription>
              <p className="rounded-xl border border-limbi-green/25 bg-limbi-green/8 px-3 py-2 text-sm text-limbi-text">
                No vamos a usar tus elecciones de forma literal. Las vamos a
                interpretar por lo que significan.
              </p>
            </div>
          ) : null}

          {activeStep === 15 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Qué 3 imágenes se parecen más a la atmósfera que quieres
                construir?
              </CardDescription>
              <p className="text-sm text-muted-foreground">
                Seleccionadas: {selectedImages.length} / 3
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {VISUAL_ATMOSPHERE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      selectedImages.includes(opt.value)
                        ? "default"
                        : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => toggleVisualImage(opt.value)}
                  >
                    <span className="mr-2 text-lg" aria-hidden>
                      {VISUAL_EMOJI[opt.value] ?? "·"}
                    </span>
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {activeStep === 16 ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <CardDescription className="text-base text-muted-foreground">
                  Si este reto tuviera un color emocional, sería:
                </CardDescription>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EMOTIONAL_COLOR_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={
                        selectedColor === opt.value ? "default" : "outline"
                      }
                      className={optionBtnClass}
                      onClick={() => setSelectedColor(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 border-t border-border/60 pt-4">
                <p className="text-sm font-medium text-foreground">
                  Ese color se siente más:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {COLOR_FEELING_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={
                        colorFeeling === opt.value ? "default" : "outline"
                      }
                      className={optionBtnClass}
                      onClick={() => setColorFeeling(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === 17 ? (
            <div className="space-y-6">
              <CardDescription className="text-base text-muted-foreground">
                Imagina este reto con los sentidos
              </CardDescription>
              <div className="space-y-3">
                <p className="text-sm font-medium">Si tuviera olor, olería a:</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SENSORY_SMELL_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={
                        sensorySmell === opt.value ? "default" : "outline"
                      }
                      className={optionBtnClass}
                      onClick={() => setSensorySmell(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 border-t border-border/60 pt-4">
                <p className="text-sm font-medium">
                  Si se moviera como un transporte, sería:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SENSORY_MOVEMENT_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={
                        sensoryMovement === opt.value ? "default" : "outline"
                      }
                      className={optionBtnClass}
                      onClick={() => setSensoryMovement(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 border-t border-border/60 pt-4">
                <p className="text-sm font-medium">
                  Si tuviera una edad emocional, sería:
                </p>
                <div className="grid gap-2">
                  {SENSORY_EMOTIONAL_AGE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={
                        sensoryEmotionalAge === opt.value
                          ? "default"
                          : "outline"
                      }
                      className={optionBtnClass}
                      onClick={() => setSensoryEmotionalAge(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 border-t border-border/60 pt-4">
                <p className="text-sm font-medium">Si se vistiera, usaría:</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SENSORY_CLOTHING_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={
                        sensoryClothing === opt.value ? "default" : "outline"
                      }
                      className={optionBtnClass}
                      onClick={() => setSensoryClothing(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === 18 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                ¿Qué tan emocional debe sentirse la comunicación?
              </CardDescription>
              <div className="grid gap-2 sm:grid-cols-1">
                {EMOTIONAL_INTENSITY_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      emotionalIntensity === opt.value ? "default" : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() => setEmotionalIntensity(opt.value)}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {opt.value}
                    </span>
                    <span className="ml-2">{opt.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {activeStep === 19 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                Quiero que esta comunicación suene (elige hasta 3):
              </CardDescription>
              <p className="text-sm text-muted-foreground">
                Seleccionados: {desiredVoiceTraits.length} / 3
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {DESIRED_VOICE_TRAIT_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      desiredVoiceTraits.includes(opt.value)
                        ? "default"
                        : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() =>
                      toggleVoiceTrait(
                        opt.value,
                        setDesiredVoiceTraits,
                        DESIRED_VOICE_SLUGS,
                        3,
                      )
                    }
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {activeStep === 20 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                Esta comunicación nunca debería sonar (elige hasta 3):
              </CardDescription>
              <p className="text-sm text-muted-foreground">
                Seleccionados: {avoidedVoiceTraits.length} / 3
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {AVOIDED_VOICE_TRAIT_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      avoidedVoiceTraits.includes(opt.value)
                        ? "default"
                        : "outline"
                    }
                    className={optionBtnClass}
                    onClick={() =>
                      toggleVoiceTrait(
                        opt.value,
                        setAvoidedVoiceTraits,
                        AVOIDED_VOICE_SLUGS,
                        3,
                      )
                    }
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {activeStep === 21 ? (
            <div className="space-y-5">
              <CardDescription className="text-base text-muted-foreground">
                Opcional: completa la frase. Puedes continuar aunque la dejes en
                blanco.
              </CardDescription>
              <p className="text-sm font-medium text-foreground">
                Quiero que se sienta como ________, pero nunca como ________.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">
                    Como deseas que se sienta
                  </label>
                  <Input
                    value={voiceComparisonDesired}
                    onChange={(e) =>
                      setVoiceComparisonDesired(e.target.value)
                    }
                    placeholder="Ej.: un café tranquilo"
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">
                    Como nunca debería sentirse
                  </label>
                  <Input
                    value={voiceComparisonAvoided}
                    onChange={(e) =>
                      setVoiceComparisonAvoided(e.target.value)
                    }
                    placeholder="Ej.: un anuncio gritón"
                    className="text-base"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Nota libre (opcional)
                </label>
                <Textarea
                  value={voiceSentenceOptional}
                  onChange={(e) => setVoiceSentenceOptional(e.target.value)}
                  placeholder="Una frase adicional sobre la voz…"
                  rows={3}
                  className="resize-y"
                />
              </div>
            </div>
          ) : null}

          {activeStep === 22 ? (
            <div className="space-y-4">
              <CardDescription className="text-base text-muted-foreground">
                Resumen de lo que guardaremos para cuando generes el Documento
                Maestro (en una etapa posterior). Puedes corregir cualquier parte
                con Editar sin tener que ir paso a paso hacia atrás.
              </CardDescription>
              {projectId ? (
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Proyecto
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={wizardReviewEditHref(
                            projectId,
                            "project_identity",
                            "review",
                          )}
                        >
                          Editar
                        </Link>
                      </Button>
                    </div>
                    <p className="mt-1 text-sm font-medium">{nameOrDescriptor}</p>
                    <p className="text-xs text-muted-foreground">
                      {optionLabel(NAME_STATUS_OPTIONS, nameStatus)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Tipo y explicación del reto
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={wizardReviewEditHref(
                            projectId,
                            "challenge_type",
                            "review",
                          )}
                        >
                          Editar
                        </Link>
                      </Button>
                    </div>
                    <p className="mt-1 text-sm">
                      {optionLabel(CHALLENGE_TYPE_OPTIONS, challengeType)}
                    </p>
                    {challengeExplanation.trim() ? (
                      <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                        {challengeExplanation.trim()}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Reto principal
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={wizardReviewEditHref(
                            projectId,
                            "main_challenge",
                            "review",
                          )}
                        >
                          Editar
                        </Link>
                      </Button>
                    </div>
                    <p className="mt-1 text-sm">
                      {optionLabel(MAIN_CHALLENGE_OPTIONS, mainChallenge)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Qué es y oferta
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={wizardReviewEditHref(
                            projectId,
                            "strategic_what",
                            "review",
                          )}
                        >
                          Editar
                        </Link>
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                      {simpleDescription || "—"}
                    </p>
                    <p className="mt-1 text-xs">
                      Oferta:{" "}
                      {optionLabel(OFFERING_TYPE_OPTIONS, offeringType)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Problema o necesidad
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={wizardReviewEditHref(
                            projectId,
                            "strategic_problem",
                            "review",
                          )}
                        >
                          Editar
                        </Link>
                      </Button>
                    </div>
                    <p className="mt-1 text-sm">
                      {optionLabel(PROBLEM_CATEGORY_OPTIONS, problemCategory)}
                    </p>
                    {problemDescriptionOptional.trim() ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {problemDescriptionOptional.trim()}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Transformación prometida
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={wizardReviewEditHref(
                            projectId,
                            "strategic_transformation",
                            "review",
                          )}
                        >
                          Editar
                        </Link>
                      </Button>
                    </div>
                    <p className="mt-1 text-sm">
                      {optionLabel(
                        TRANSFORMATION_TYPE_OPTIONS,
                        transformationType,
                      )}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Audiencia y emociones
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={wizardReviewEditHref(
                              projectId,
                              "audience_type",
                              "review",
                            )}
                          >
                            Editar audiencia
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={wizardReviewEditHref(
                              projectId,
                              "current_emotion",
                              "review",
                            )}
                          >
                            Editar emociones y acción
                          </Link>
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1 text-sm">
                      {optionLabel(AUDIENCE_TYPE_OPTIONS, audienceType)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Emoción actual:{" "}
                      {optionLabel(CURRENT_EMOTION_OPTIONS, currentEmotion)} →
                      deseada:{" "}
                      {optionLabel(DESIRED_EMOTION_OPTIONS, desiredEmotion)} ·
                      acción:{" "}
                      {optionLabel(DESIRED_ACTION_OPTIONS, desiredAction)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Momento y tensión
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={wizardReviewEditHref(projectId, "why_now", "review")}
                          >
                            Editar momento
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={wizardReviewEditHref(
                              projectId,
                              "central_tension",
                              "review",
                            )}
                          >
                            Editar tensión
                          </Link>
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1 text-sm">
                      {optionLabel(WHY_NOW_OPTIONS, whyNow)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {optionLabel(CENTRAL_TENSION_OPTIONS, selectedTension)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Evidencia y límites
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={wizardReviewEditHref(
                              projectId,
                              "evidence_available",
                              "review",
                            )}
                          >
                            Editar evidencia
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={wizardReviewEditHref(
                              projectId,
                              "restricted_claims",
                              "review",
                            )}
                          >
                            Editar restricciones
                          </Link>
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tipos: {evidenceTypes.join(", ") || "—"}
                    </p>
                    <p className="text-xs">
                      Restricciones: {hasRestrictedClaims ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Pulso sensible
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={wizardReviewEditHref(
                            projectId,
                            "visual_atmosphere",
                            "review",
                          )}
                        >
                          Editar
                        </Link>
                      </Button>
                    </div>
                    <p className="mt-1 text-xs">
                      Imágenes:{" "}
                      {selectedImages
                        .map((s) => optionLabel(VISUAL_ATMOSPHERE_OPTIONS, s))
                        .join(", ") || "—"}
                    </p>
                    <p className="text-xs">
                      Color: {optionLabel(EMOTIONAL_COLOR_OPTIONS, selectedColor)}{" "}
                      · matiz:{" "}
                      {optionLabel(COLOR_FEELING_OPTIONS, colorFeeling)}
                    </p>
                    <p className="text-xs">
                      Intensidad:{" "}
                      {emotionalIntensity ?? "—"}{" "}
                      {emotionalIntensity
                        ? EMOTIONAL_INTENSITY_OPTIONS.find(
                            (o) => o.value === emotionalIntensity,
                          )?.label
                        : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sensorial: olor{" "}
                      {optionLabel(SENSORY_SMELL_OPTIONS, sensorySmell)} ·
                      movimiento{" "}
                      {optionLabel(SENSORY_MOVEMENT_OPTIONS, sensoryMovement)} ·
                      edad{" "}
                      {optionLabel(
                        SENSORY_EMOTIONAL_AGE_OPTIONS,
                        sensoryEmotionalAge,
                      )}{" "}
                      · vestuario{" "}
                      {optionLabel(SENSORY_CLOTHING_OPTIONS, sensoryClothing)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Voz
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={wizardReviewEditHref(
                            projectId,
                            "desired_voice",
                            "review",
                          )}
                        >
                          Editar
                        </Link>
                      </Button>
                    </div>
                    <p className="mt-1 text-xs">
                      Rasgos:{" "}
                      {desiredVoiceTraits
                        .map((s) =>
                          optionLabel(DESIRED_VOICE_TRAIT_OPTIONS, s),
                        )
                        .join(", ") || "—"}
                    </p>
                    <p className="text-xs">
                      Evitar:{" "}
                      {avoidedVoiceTraits
                        .map((s) =>
                          optionLabel(AVOIDED_VOICE_TRAIT_OPTIONS, s),
                        )
                        .join(", ") || "—"}
                    </p>
                    {(voiceComparisonDesired || voiceComparisonAvoided) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Comparación: como {voiceComparisonDesired || "…"}, nunca
                        como {voiceComparisonAvoided || "…"}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="gap-3 border-t border-limbi-border/80 bg-limbi-bg-soft/60 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={activeStep === 0 || saving || strategicExitLoading}
            className={cn("w-full sm:w-auto", limbiOutlineButtonClass)}
          >
            Atrás
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleContinue();
            }}
            disabled={saving || strategicExitLoading}
            className={cn(
              "w-full sm:w-auto",
              limbiPrimaryButtonClass,
            )}
          >
            {saving
              ? "Guardando…"
              : activeStep === lastStepIndex
                ? "Finalizar y continuar"
                : activeStep === 14
                  ? "Construir mi pulso sensible"
                  : "Continuar"}
          </Button>
        </CardFooter>
      </Card>

      <div className="mt-8 text-center">
        <Button variant="ghost" size="sm" asChild>
          <Link
            href="/projects"
            className="text-limbi-muted no-underline hover:text-limbi-text"
          >
            Mis Sistemas
          </Link>
        </Button>
      </div>
    </div>
    </>
  );
}
