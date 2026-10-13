import type {
  BattleOutcome,
  Commitment,
  CommitmentFulfillment,
  Encounter,
  PartySnapshot,
} from './types'

// Parametrized constants — see docs/GAME_RULES.md for the full derivation and the
// worked examples these are checked against in engine.test.ts. Keep both in sync.
export const TASK_XP_PER_DIFFICULTY = 20
export const FOCUS_XP_PER_MINUTE = 1.5
export const TEAM_BONUS_PER_LEVEL = 0.01
export const MAX_TEAM_BONUS = 0.5
export const TEAM_REDUCTION_PER_LEVELS = 10
export const BASE_FOCUS_MINUTES_PER_DIFFICULTY = 15

/** Never below 1 (there's always a viable way to win) and never increased by a
 * stronger team — only reduced (RF-027: team helps, never creates a surprise block). */
export function computeEffectiveDifficulty(encounter: Encounter, party: PartySnapshot): number {
  const maxReduction = encounter.difficulty - 1
  const reduction = Math.min(
    maxReduction,
    Math.floor(Math.max(0, party.averageLevel) / TEAM_REDUCTION_PER_LEVELS),
  )
  return encounter.difficulty - reduction
}

/** The commitments shown to the player *before* they start — RF-020/RF-022: the win
 * condition must be visible upfront, not discovered after the fact. */
export function getViableCommitments(encounter: Encounter, party: PartySnapshot): Commitment[] {
  const effectiveDifficulty = computeEffectiveDifficulty(encounter, party)
  return [
    { type: 'task', minDifficulty: effectiveDifficulty },
    {
      type: 'focusSession',
      minDurationMinutes: effectiveDifficulty * BASE_FOCUS_MINUTES_PER_DIFFICULTY,
    },
  ]
}

export function isCommitmentSatisfied(
  commitment: Commitment,
  fulfillment: CommitmentFulfillment,
): boolean {
  if (commitment.type === 'task' && fulfillment.type === 'task') {
    return fulfillment.difficulty >= commitment.minDifficulty
  }
  if (commitment.type === 'focusSession' && fulfillment.type === 'focusSession') {
    return fulfillment.wasConfirmed && fulfillment.durationMinutes >= commitment.minDurationMinutes
  }
  return false
}

/** Bonus XP only — never the productivity reward itself (T-013/T-019 already recorded
 * that independently of any battle). See docs/GAME_RULES.md "Princípio central". */
export function computeBaseXp(fulfillment: CommitmentFulfillment): number {
  if (fulfillment.type === 'task') {
    return fulfillment.difficulty * TASK_XP_PER_DIFFICULTY
  }
  return fulfillment.durationMinutes * FOCUS_XP_PER_MINUTE
}

/** Multiplier is always >= 1 — a weak or nonexistent party never penalizes, only fails
 * to bonus (RF-027: "sem surpresa negativa"). */
export function computeTeamMultiplier(party: PartySnapshot): number {
  return 1 + Math.min(MAX_TEAM_BONUS, Math.max(0, party.averageLevel) * TEAM_BONUS_PER_LEVEL)
}

/**
 * Deterministic, side-effect-free: meeting the exact commitment shown beforehand
 * always wins (RF-022, no randomness in whether you win). Not meeting it — session
 * cancelled, task never completed, fulfillment short of the promise — resolves to
 * `withdrawal` with zero bonus XP and no further penalty; it does not touch or revert
 * the underlying task/session, which already recorded its own productivity event.
 */
export function resolveBattle(
  commitment: Commitment,
  fulfillment: CommitmentFulfillment,
  party: PartySnapshot,
): BattleOutcome {
  if (!isCommitmentSatisfied(commitment, fulfillment)) {
    return { result: 'withdrawal', xpAwarded: 0, teamMultiplierApplied: 1 }
  }

  const teamMultiplier = computeTeamMultiplier(party)
  const xpAwarded = Math.round(computeBaseXp(fulfillment) * teamMultiplier)

  return { result: 'victory', xpAwarded, teamMultiplierApplied: teamMultiplier }
}
