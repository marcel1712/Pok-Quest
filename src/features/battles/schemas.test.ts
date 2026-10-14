import { describe, expect, it } from 'vitest'
import { createBattleInputSchema } from './schemas'

const taskId = '123e4567-e89b-12d3-a456-426614174000'
const focusSessionId = '223e4567-e89b-12d3-a456-426614174000'

describe('createBattleInputSchema', () => {
  it('accepts a valid task commitment', () => {
    const result = createBattleInputSchema.parse({
      commitmentType: 'task',
      encounterKind: 'wild',
      encounterDifficulty: 1,
      minDifficulty: 1,
      taskId,
      encounterId: '323e4567-e89b-12d3-a456-426614174000',
    })
    expect(result.commitmentType).toBe('task')
  })

  it('accepts a valid focus session commitment', () => {
    const result = createBattleInputSchema.parse({
      commitmentType: 'focusSession',
      encounterKind: 'gymLeader',
      encounterDifficulty: 5,
      minDurationMinutes: 75,
      focusSessionId,
      encounterId: '323e4567-e89b-12d3-a456-426614174000',
    })
    expect(result.commitmentType).toBe('focusSession')
  })

  it('rejects a task commitment missing taskId', () => {
    expect(() =>
      createBattleInputSchema.parse({
        commitmentType: 'task',
        encounterKind: 'wild',
        encounterDifficulty: 1,
        minDifficulty: 1,
      }),
    ).toThrow()
  })

  it('rejects a commitment without an encounter', () => {
    expect(() =>
      createBattleInputSchema.parse({
        commitmentType: 'task',
        encounterKind: 'wild',
        encounterDifficulty: 1,
        minDifficulty: 1,
        taskId,
      }),
    ).toThrow()
  })

  it('rejects an out-of-range difficulty', () => {
    expect(() =>
      createBattleInputSchema.parse({
        commitmentType: 'task',
        encounterKind: 'wild',
        encounterDifficulty: 6,
        minDifficulty: 1,
        taskId,
        encounterId: '323e4567-e89b-12d3-a456-426614174000',
      }),
    ).toThrow()
  })

  it('rejects an unknown encounter kind', () => {
    expect(() =>
      createBattleInputSchema.parse({
        commitmentType: 'task',
        encounterKind: 'boss',
        encounterDifficulty: 1,
        minDifficulty: 1,
        taskId,
        encounterId: '323e4567-e89b-12d3-a456-426614174000',
      }),
    ).toThrow()
  })

  it('rejects a focus session commitment over the 120-minute cap', () => {
    expect(() =>
      createBattleInputSchema.parse({
        commitmentType: 'focusSession',
        encounterKind: 'wild',
        encounterDifficulty: 1,
        minDurationMinutes: 121,
        focusSessionId,
        encounterId: '323e4567-e89b-12d3-a456-426614174000',
      }),
    ).toThrow()
  })
})
