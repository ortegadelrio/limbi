import type { TurnDecision } from "@/lib/intake/conversational-engine/types";

/**
 * Wizard `completed_steps` must not advance when the route already held the turn
 * or the engine marked active doubt / no-advance (guidance, validation hold, etc.).
 */
export function shouldFreezeCompletedStepsForTurn(
  engineTurn: TurnDecision,
  routeShouldNotAdvance: boolean,
): boolean {
  return (
    routeShouldNotAdvance ||
    engineTurn.should_not_advance ||
    engineTurn.active_doubt_detected
  );
}
