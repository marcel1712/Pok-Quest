import type {
  BattleOutcome,
  Commitment,
  CommitmentFulfillment,
  Encounter,
  PartySnapshot,
} from './types'

// Parametrized constants — see docs/GAME_RULES.md for the full derivation and the
// worked examples these are checked against in engine.test.ts. Keep both in sync.
// Bumping REWARD_RULES_VERSION is a reminder, not an enforcement mechanism: past
// `reward_events` rows already store their credited `amount` directly, so changing any
// constant below never retroactively alters XP already granted (T-027: "não corromper
// recompensas anteriores").
export const REWARD_RULES_VERSION = 1
export const TASK_XP_PER_DIFFICULTY = 20
export const FOCUS_XP_PER_MINUTE = 1.5
export const TEAM_BONUS_PER_LEVEL = 0.01
export const MAX_TEAM_BONUS = 0.5
export const TEAM_REDUCTION_PER_LEVELS = 10

// Anti-fractionation (T-027, RNF/5.1.6: "evitar exploração por tarefas artificiais ou
// microtarefas repetidas"). Only task-sourced XP diminishes — a focus session's reward
// is already linear in actual minutes spent, so splitting one long session into many
// short ones yields the same total XP either way; there's nothing to exploit there.
// Tasks, by contrast, pay a flat amount per completion regardless of real effort, so
// spamming trivial tasks is the one place fractionation actually pays off without this.
export const TASK_XP_FULL_REWARD_COUNT_PER_DAY = 5
export const TASK_XP_DIMINISHED_MULTIPLIER = 0.5

/**
 * `priorTaskRewardsToday` is the count of task-sourced reward_events already credited
 * today, BEFORE this one — the caller (the SQL trigger) queries that count; this pure
 * function only applies the resulting multiplier, so it stays testable without a DB.
 */
export function applyDailyTaskDiminishingReturns(
  baseXp: number,
  priorTaskRewardsToday: number,
): number {
  return priorTaskRewardsToday >= TASK_XP_FULL_REWARD_COUNT_PER_DAY
    ? baseXp * TASK_XP_DIMINISHED_MULTIPLIER
    : baseXp
}
// Was 15 — lowered 2026-10-13 at the user's request: a 15-minute minimum made even
// the easiest wild encounter too slow to test (or just use) day-to-day. A normal
// 25-60 min Pomodoro still earns the same XP as before (reward scales with actual
// minutes spent, not this minimum); this only lowers the bar to *qualify* for the
// easiest encounters. See docs/DECISIONS.md.
export const BASE_FOCUS_MINUTES_PER_DIFFICULTY = 1

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
 *
 * `priorTaskRewardsToday` (default 0, i.e. "first of the day") only affects
 * task-sourced fulfillments — see `applyDailyTaskDiminishingReturns`. The real count
 * is stateful (today's reward_events for this owner), so only the SQL trigger that
 * actually resolves a battle can supply a non-zero value; this function stays pure.
 */
export function resolveBattle(
  commitment: Commitment,
  fulfillment: CommitmentFulfillment,
  party: PartySnapshot,
  priorTaskRewardsToday = 0,
): BattleOutcome {
  if (!isCommitmentSatisfied(commitment, fulfillment)) {
    return { result: 'withdrawal', xpAwarded: 0, teamMultiplierApplied: 1 }
  }

  const teamMultiplier = computeTeamMultiplier(party)
  const baseXp =
    fulfillment.type === 'task'
      ? applyDailyTaskDiminishingReturns(computeBaseXp(fulfillment), priorTaskRewardsToday)
      : computeBaseXp(fulfillment)
  const xpAwarded = Math.round(baseXp * teamMultiplier)

  return { result: 'victory', xpAwarded, teamMultiplierApplied: teamMultiplier }
}
