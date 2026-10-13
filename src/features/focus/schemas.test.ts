import { describe, expect, it } from 'vitest'
import { startSessionInputSchema } from './schemas'

describe('startSessionInputSchema', () => {
  it('accepts a typical 25-minute session with no task', () => {
    const result = startSessionInputSchema.parse({ plannedDurationSeconds: 1500 })
    expect(result.plannedDurationSeconds).toBe(1500)
  })

  it('accepts an optional taskId', () => {
    const taskId = '123e4567-e89b-12d3-a456-426614174000'
    const result = startSessionInputSchema.parse({ plannedDurationSeconds: 1500, taskId })
    expect(result.taskId).toBe(taskId)
  })

  it('rejects a duration below the 1-minute floor', () => {
    expect(() => startSessionInputSchema.parse({ plannedDurationSeconds: 59 })).toThrow()
  })

  it('rejects a duration above the 2-hour ceiling', () => {
    expect(() => startSessionInputSchema.parse({ plannedDurationSeconds: 7201 })).toThrow()
  })

  it('rejects a malformed taskId', () => {
    expect(() =>
      startSessionInputSchema.parse({ plannedDurationSeconds: 1500, taskId: 'not-a-uuid' }),
    ).toThrow()
  })
})
