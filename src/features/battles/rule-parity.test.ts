import { describe, expect, it } from 'vitest'
import { totalXpForLevel } from '@/features/pokemon/xp'
import fixture from '../../../tests/fixtures/rule-parity.json'
import { getViableCommitments, resolveBattle, TASK_XP_FULL_REWARD_COUNT_PER_DAY } from './engine'

// The reward rules exist twice: here in TypeScript (what the player is shown) and in
// SQL (what is actually credited). tests/fixtures/rule-parity.json pins the expected
// outputs for both: this file checks the engine against it, and `npm run db:verify`
// checks the database against the very same numbers. Changing a rule on one side only
// breaks one of the two before any wrong reward is written.

const noParty = { averageLevel: 0 }

describe('rule parity fixture — TypeScript engine', () => {
  it.each(fixture.commitments)(
    'encounter difficulty $encounterDifficulty with party levels $partyLevels asks for difficulty >= $minTaskDifficulty / $minFocusMinutes min',
    ({ encounterDifficulty, partyLevels, minTaskDifficulty, minFocusMinutes }) => {
      const averageLevel =
        partyLevels.length === 0
          ? 0
          : partyLevels.reduce((sum, level) => sum + level, 0) / partyLevels.length

      const commitments = getViableCommitments(
        { kind: 'wild', difficulty: encounterDifficulty },
        { averageLevel },
      )

      expect(commitments).toContainEqual({ type: 'task', minDifficulty: minTaskDifficulty })
      expect(commitments).toContainEqual({
        type: 'focusSession',
        minDurationMinutes: minFocusMinutes,
      })
    },
  )

  it.each(fixture.xpCurve)('level $level needs $totalXp total XP', ({ level, totalXp }) => {
    expect(totalXpForLevel(level)).toBe(totalXp)
  })

  it.each(fixture.taskXp)(
    'a difficulty-$difficulty task pays $full XP, or $diminished past the daily count',
    ({ difficulty, full, diminished }) => {
      const commitment = { type: 'task', minDifficulty: 1 } as const
      const fulfillment = { type: 'task', difficulty } as const

      expect(resolveBattle(commitment, fulfillment, noParty, 0).xpAwarded).toBe(full)
      expect(
        resolveBattle(commitment, fulfillment, noParty, fixture.taskFullRewardsPerDay).xpAwarded,
      ).toBe(diminished)
    },
  )

  it.each(fixture.focusXp)('a $minutes-minute session pays $xp XP', ({ minutes, xp }) => {
    expect(
      resolveBattle(
        { type: 'focusSession', minDurationMinutes: 1 },
        { type: 'focusSession', durationMinutes: minutes, wasConfirmed: true },
        noParty,
      ).xpAwarded,
    ).toBe(xp)
  })

  it('agrees with the engine on how many task rewards a day are paid in full', () => {
    expect(fixture.taskFullRewardsPerDay).toBe(TASK_XP_FULL_REWARD_COUNT_PER_DAY)
  })
})
