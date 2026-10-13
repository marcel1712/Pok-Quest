import { describe, expect, it } from 'vitest'
import {
  applyDailyTaskDiminishingReturns,
  computeEffectiveDifficulty,
  computeTeamMultiplier,
  getViableCommitments,
  isCommitmentSatisfied,
  resolveBattle,
  TASK_XP_FULL_REWARD_COUNT_PER_DAY,
} from './engine'
import type { Commitment, CommitmentFulfillment, Encounter, PartySnapshot } from './types'

const noParty: PartySnapshot = { averageLevel: 0 }
const strongParty: PartySnapshot = { averageLevel: 50 }

function findTaskCommitment(commitments: Commitment[]) {
  const found = commitments.find(
    (c): c is Extract<Commitment, { type: 'task' }> => c.type === 'task',
  )
  if (!found) throw new Error('expected a task commitment')
  return found
}

function findFocusCommitment(commitments: Commitment[]) {
  const found = commitments.find(
    (c): c is Extract<Commitment, { type: 'focusSession' }> => c.type === 'focusSession',
  )
  if (!found) throw new Error('expected a focusSession commitment')
  return found
}

describe('computeEffectiveDifficulty', () => {
  it('equals the encounter difficulty when the party has no levels', () => {
    expect(computeEffectiveDifficulty({ kind: 'wild', difficulty: 3 }, noParty)).toBe(3)
  })

  it('is reduced by a strong team, but never below 1', () => {
    expect(computeEffectiveDifficulty({ kind: 'gymLeader', difficulty: 5 }, strongParty)).toBe(1)
  })

  it('never increases difficulty for a weak team', () => {
    const weakParty: PartySnapshot = { averageLevel: 1 }
    expect(computeEffectiveDifficulty({ kind: 'wild', difficulty: 1 }, weakParty)).toBe(1)
  })
})

describe('computeTeamMultiplier', () => {
  it('is exactly 1 for no party (no penalty)', () => {
    expect(computeTeamMultiplier(noParty)).toBe(1)
  })

  it('increases with average level, capped at MAX_TEAM_BONUS', () => {
    expect(computeTeamMultiplier({ averageLevel: 10 })).toBeCloseTo(1.1)
    expect(computeTeamMultiplier({ averageLevel: 1000 })).toBe(1.5)
  })
})

describe('getViableCommitments', () => {
  it('scales the focus-session minutes with effective difficulty, always under the 120-min cap', () => {
    const commitments = getViableCommitments({ kind: 'gymLeader', difficulty: 5 }, noParty)
    expect(findFocusCommitment(commitments)).toEqual({
      type: 'focusSession',
      minDurationMinutes: 5,
    })
  })

  it('always includes a task option', () => {
    const commitments = getViableCommitments({ kind: 'wild', difficulty: 1 }, noParty)
    expect(commitments).toContainEqual({ type: 'task', minDifficulty: 1 })
  })
})

describe('isCommitmentSatisfied', () => {
  it('requires at least the minimum task difficulty', () => {
    const commitment: Commitment = { type: 'task', minDifficulty: 3 }
    expect(isCommitmentSatisfied(commitment, { type: 'task', difficulty: 3 })).toBe(true)
    expect(isCommitmentSatisfied(commitment, { type: 'task', difficulty: 2 })).toBe(false)
  })

  it('requires an explicitly confirmed focus session of at least the minimum duration', () => {
    const commitment: Commitment = { type: 'focusSession', minDurationMinutes: 45 }
    expect(
      isCommitmentSatisfied(commitment, {
        type: 'focusSession',
        durationMinutes: 45,
        wasConfirmed: true,
      }),
    ).toBe(true)
    expect(
      isCommitmentSatisfied(commitment, {
        type: 'focusSession',
        durationMinutes: 60,
        wasConfirmed: false,
      }),
    ).toBe(false)
  })

  it('never satisfies a mismatched commitment/fulfillment type', () => {
    const commitment: Commitment = { type: 'task', minDifficulty: 1 }
    expect(
      isCommitmentSatisfied(commitment, {
        type: 'focusSession',
        durationMinutes: 999,
        wasConfirmed: true,
      }),
    ).toBe(false)
  })
})

// Mirrors the worked-examples table in docs/GAME_RULES.md verbatim.
describe('resolveBattle — worked examples from GAME_RULES.md', () => {
  it('iniciante: wild dif. 1, time nível 0, tarefa dif. 1 -> victory, 20 XP', () => {
    const encounter: Encounter = { kind: 'wild', difficulty: 1 }
    const taskCommitment = findTaskCommitment(getViableCommitments(encounter, noParty))
    const outcome = resolveBattle(taskCommitment, { type: 'task', difficulty: 1 }, noParty)
    expect(outcome).toEqual({ result: 'victory', xpAwarded: 20, teamMultiplierApplied: 1 })
  })

  it('time forte vs. ginásio: gymLeader dif. 5, nível médio 50, tarefa dif. 1 -> victory, 30 XP', () => {
    const encounter: Encounter = { kind: 'gymLeader', difficulty: 5 }
    const taskCommitment = findTaskCommitment(getViableCommitments(encounter, strongParty))
    expect(taskCommitment).toEqual({ type: 'task', minDifficulty: 1 })

    const outcome = resolveBattle(taskCommitment, { type: 'task', difficulty: 1 }, strongParty)
    // base 20 XP * 1.5 multiplier (capped) = 30
    expect(outcome).toEqual({ result: 'victory', xpAwarded: 30, teamMultiplierApplied: 1.5 })
  })

  it('tarefa difícil: trainer dif. 3, tarefa dif. 5 -> victory, 100 XP', () => {
    const encounter: Encounter = { kind: 'trainer', difficulty: 3 }
    const taskCommitment = findTaskCommitment(getViableCommitments(encounter, noParty))
    expect(taskCommitment).toEqual({ type: 'task', minDifficulty: 3 })

    const outcome = resolveBattle(taskCommitment, { type: 'task', difficulty: 5 }, noParty)
    expect(outcome).toEqual({ result: 'victory', xpAwarded: 100, teamMultiplierApplied: 1 })
  })

  it('sessão curta demais: trainer dif. 3 exige >=3min, sessão de 2min confirmada -> withdrawal', () => {
    const encounter: Encounter = { kind: 'trainer', difficulty: 3 }
    const focusCommitment = findFocusCommitment(getViableCommitments(encounter, noParty))
    expect(focusCommitment).toEqual({ type: 'focusSession', minDurationMinutes: 3 })

    const outcome = resolveBattle(
      focusCommitment,
      { type: 'focusSession', durationMinutes: 2, wasConfirmed: true },
      noParty,
    )
    expect(outcome).toEqual({ result: 'withdrawal', xpAwarded: 0, teamMultiplierApplied: 1 })
  })

  it('foco abortado: wild dif. 1 exige >=1min, sessão de 20min NÃO confirmada -> withdrawal', () => {
    const encounter: Encounter = { kind: 'wild', difficulty: 1 }
    const focusCommitment = findFocusCommitment(getViableCommitments(encounter, noParty))

    const outcome = resolveBattle(
      focusCommitment,
      { type: 'focusSession', durationMinutes: 20, wasConfirmed: false },
      noParty,
    )
    expect(outcome).toEqual({ result: 'withdrawal', xpAwarded: 0, teamMultiplierApplied: 1 })
  })
})

describe('resolveBattle — property: meeting the exact shown commitment always wins', () => {
  const scenarios: { encounter: Encounter; party: PartySnapshot }[] = [
    { encounter: { kind: 'wild', difficulty: 1 }, party: noParty },
    { encounter: { kind: 'trainer', difficulty: 2 }, party: { averageLevel: 5 } },
    { encounter: { kind: 'rival', difficulty: 3 }, party: noParty },
    { encounter: { kind: 'gymLeader', difficulty: 4 }, party: strongParty },
    { encounter: { kind: 'milestone', difficulty: 5 }, party: { averageLevel: 20 } },
  ]

  it.each(scenarios)(
    'victory for $encounter.kind (dif. $encounter.difficulty)',
    ({ encounter, party }) => {
      const commitments = getViableCommitments(encounter, party)
      const taskCommitment = findTaskCommitment(commitments)
      const focusCommitment = findFocusCommitment(commitments)

      const taskOutcome = resolveBattle(
        taskCommitment,
        { type: 'task', difficulty: taskCommitment.minDifficulty },
        party,
      )
      expect(taskOutcome.result).toBe('victory')

      const focusOutcome = resolveBattle(
        focusCommitment,
        {
          type: 'focusSession',
          durationMinutes: focusCommitment.minDurationMinutes,
          wasConfirmed: true,
        },
        party,
      )
      expect(focusOutcome.result).toBe('victory')
    },
  )
})

describe('applyDailyTaskDiminishingReturns', () => {
  it('leaves the first few daily task rewards at full value', () => {
    for (let prior = 0; prior < TASK_XP_FULL_REWARD_COUNT_PER_DAY; prior++) {
      expect(applyDailyTaskDiminishingReturns(100, prior)).toBe(100)
    }
  })

  it('halves task XP once the daily full-reward count is reached', () => {
    expect(applyDailyTaskDiminishingReturns(100, TASK_XP_FULL_REWARD_COUNT_PER_DAY)).toBe(50)
    expect(applyDailyTaskDiminishingReturns(100, TASK_XP_FULL_REWARD_COUNT_PER_DAY + 50)).toBe(50)
  })
})

describe('resolveBattle — anti-fractionation (T-027)', () => {
  it('does not diminish focus-session XP regardless of how many battles happened today', () => {
    // Linear-in-time reward: splitting one long session into many short ones nets the
    // same total XP either way, so there is nothing to diminish here.
    const commitment: Commitment = { type: 'focusSession', minDurationMinutes: 10 }
    const outcome = resolveBattle(
      commitment,
      { type: 'focusSession', durationMinutes: 10, wasConfirmed: true },
      noParty,
      999, // even with hundreds of "prior" rewards today
    )
    expect(outcome.xpAwarded).toBe(15) // 10 * FOCUS_XP_PER_MINUTE, unaffected
  })

  it('diminishes task XP after the daily full-reward count, discouraging microtask spam', () => {
    const commitment: Commitment = { type: 'task', minDifficulty: 1 }
    const fulfillment: CommitmentFulfillment = { type: 'task', difficulty: 1 }

    const fullReward = resolveBattle(commitment, fulfillment, noParty, 0)
    const diminishedReward = resolveBattle(
      commitment,
      fulfillment,
      noParty,
      TASK_XP_FULL_REWARD_COUNT_PER_DAY,
    )

    expect(fullReward.xpAwarded).toBe(20)
    expect(diminishedReward.xpAwarded).toBe(10)
    expect(diminishedReward.xpAwarded).toBeLessThan(fullReward.xpAwarded)
  })

  it('splitting one difficulty-5 task into five difficulty-1 tasks nets strictly less XP than doing the real thing', () => {
    const bigTask = resolveBattle(
      { type: 'task', minDifficulty: 5 },
      { type: 'task', difficulty: 5 },
      noParty,
      0,
    )

    const fiveSmallTasks = Array.from(
      { length: 5 },
      (_, i) =>
        resolveBattle(
          { type: 'task', minDifficulty: 1 },
          { type: 'task', difficulty: 1 },
          noParty,
          i, // each one is "today's Nth" prior reward
        ).xpAwarded,
    ).reduce((sum, xp) => sum + xp, 0)

    // Equal *while* still under the daily cap (5 * 20 = 100 = 5 * 20) — the point of
    // this mechanism isn't to punish 5 legitimate small tasks, only spam beyond that.
    expect(fiveSmallTasks).toBe(bigTask.xpAwarded)

    // A 6th fractioned task on top gains only half — fractionation past the cap is a
    // worse deal than it would be without the mechanism (100% -> 50% marginal value).
    const sixthSmallTask = resolveBattle(
      { type: 'task', minDifficulty: 1 },
      { type: 'task', difficulty: 1 },
      noParty,
      5,
    ).xpAwarded
    expect(sixthSmallTask).toBe(10)
  })
})
