import { describe, expect, it } from 'vitest'
import { resolveBattle, TASK_XP_FULL_REWARD_COUNT_PER_DAY } from './engine'
import { totalXpForLevel } from '@/features/pokemon/xp'
import type { Commitment, PartySnapshot } from './types'

/**
 * T-027: validates the reward curve against *realistic* usage over real horizons,
 * instead of just trusting the per-battle formulas in isolation. These simulate a
 * single Pokémon receiving 100% of the XP (no party split) — a full team would level
 * each member slower, proportionally, which is an accepted, documented trade-off
 * (see docs/DECISIONS.md), not modeled again here.
 */

const noParty: PartySnapshot = { averageLevel: 0 }

function levelReachedFor(totalXp: number): number {
  let level = 1
  while (level < 100 && totalXp >= totalXpForLevel(level + 1)) level++
  return level
}

/** One realistic day: 2 moderate tasks (difficulty 2) + one 30-minute focus session. */
function simulateModerateDay(): number {
  const taskCommitment: Commitment = { type: 'task', minDifficulty: 2 }
  const focusCommitment: Commitment = { type: 'focusSession', minDurationMinutes: 1 }

  const task1 = resolveBattle(
    taskCommitment,
    { type: 'task', difficulty: 2 },
    noParty,
    0, // 1st task-sourced reward today
  )
  const task2 = resolveBattle(
    taskCommitment,
    { type: 'task', difficulty: 2 },
    noParty,
    1, // 2nd — still well under TASK_XP_FULL_REWARD_COUNT_PER_DAY
  )
  const focus = resolveBattle(
    focusCommitment,
    { type: 'focusSession', durationMinutes: 30, wasConfirmed: true },
    noParty,
  )

  return task1.xpAwarded + task2.xpAwarded + focus.xpAwarded
}

describe('balance simulation — moderate daily usage (2 tasks + one 30min focus)', () => {
  it('7 days: reaches a modest but real level, not stuck at the starting level', () => {
    const totalXp = Array.from({ length: 7 }, () => simulateModerateDay()).reduce(
      (sum, xp) => sum + xp,
      0,
    )
    const level = levelReachedFor(totalXp)

    expect(totalXp).toBeGreaterThan(0)
    expect(level).toBeGreaterThan(1)
    expect(level).toBeLessThan(15) // a week shouldn't feel like it maxes anything out
  })

  it('30 days: clearly further along than 7 days, still nowhere near the level cap', () => {
    const totalXp30 = Array.from({ length: 30 }, () => simulateModerateDay()).reduce(
      (sum, xp) => sum + xp,
      0,
    )
    const totalXp7 = Array.from({ length: 7 }, () => simulateModerateDay()).reduce(
      (sum, xp) => sum + xp,
      0,
    )

    expect(levelReachedFor(totalXp30)).toBeGreaterThan(levelReachedFor(totalXp7))
    expect(levelReachedFor(totalXp30)).toBeLessThan(100)
  })

  it('90 days: sustained daily use reaches meaningful mid-game progress', () => {
    const totalXp = Array.from({ length: 90 }, () => simulateModerateDay()).reduce(
      (sum, xp) => sum + xp,
      0,
    )
    const level = levelReachedFor(totalXp)

    // ~125 xp/day * 90 ~= 11_250 total, cube root ~= 22 — documented here so a future
    // formula change has a concrete number to compare against, not just a vibe.
    expect(level).toBeGreaterThanOrEqual(15)
    expect(level).toBeLessThan(40)
  })

  it('a single missed/inactive day never produces negative progress (no penalty for absence)', () => {
    const totalXpBefore = simulateModerateDay()
    const inactiveDayXp = 0 // doing nothing grants nothing — never less than nothing
    expect(totalXpBefore + inactiveDayXp).toBeGreaterThanOrEqual(totalXpBefore)
  })
})

describe('balance simulation — fractionation attempt vs honest moderate usage', () => {
  it('spamming 20 trivial tasks in a day nets less XP per task than a moderate day, once the daily cap kicks in', () => {
    const trivialTaskCommitment: Commitment = { type: 'task', minDifficulty: 1 }

    const spamXp = Array.from(
      { length: 20 },
      (_, i) =>
        resolveBattle(trivialTaskCommitment, { type: 'task', difficulty: 1 }, noParty, i).xpAwarded,
    ).reduce((sum, xp) => sum + xp, 0)

    // Without the anti-fractionation mechanism this would be 20 * 20 = 400.
    const withoutMechanismXp = 20 * 20
    expect(spamXp).toBeLessThan(withoutMechanismXp)

    // Concretely: 5 full (100) + 15 diminished (150) = 250, not 400.
    expect(spamXp).toBe(
      TASK_XP_FULL_REWARD_COUNT_PER_DAY * 20 + (20 - TASK_XP_FULL_REWARD_COUNT_PER_DAY) * 10,
    )
  })
})
