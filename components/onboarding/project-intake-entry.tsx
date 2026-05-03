"use client";

import { useSearchParams } from "next/navigation";
import { GuidedIntakePilot } from "@/components/onboarding/guided-intake-pilot";
import { NewProjectWizard } from "@/components/onboarding/new-project-wizard";
import { shouldShowGuidedIntakePilotFromSearchParams } from "@/lib/intake/guided-intake-flag";

/**
 * Routes between the classic wizard and the Phase 1 guided pilot (`?guided=1`
 * when `NEXT_PUBLIC_LIMBI_GUIDED_INTAKE_ENABLED=true`).
 */
export function ProjectIntakeEntry() {
  const searchParams = useSearchParams();
  const guided = shouldShowGuidedIntakePilotFromSearchParams(
    searchParams.get("guided"),
  );
  if (guided) {
    return <GuidedIntakePilot />;
  }
  return <NewProjectWizard />;
}
