import { describe, expect, it } from 'vitest'
import { taskInputSchema, taskUpdateSchema } from './schemas'

describe('taskInputSchema', () => {
  it('accepts a minimal valid task with just a title', () => {
    const result = taskInputSchema.parse({ title: 'Lavar a louça' })
    expect(result.title).toBe('Lavar a louça')
    expect(result.difficulty).toBe(2)
  })

  it('rejects an empty title', () => {
    expect(() => taskInputSchema.parse({ title: '' })).toThrow()
  })

  it('rejects a title made only of whitespace', () => {
    expect(() => taskInputSchema.parse({ title: '   ' })).toThrow()
  })

  it('rejects a title over 200 characters', () => {
    expect(() => taskInputSchema.parse({ title: 'a'.repeat(201) })).toThrow()
  })

  it('rejects a description over 5000 characters', () => {
    expect(() => taskInputSchema.parse({ title: 'ok', description: 'a'.repeat(5001) })).toThrow()
  })

  it('rejects difficulty outside 1-5', () => {
    expect(() => taskInputSchema.parse({ title: 'ok', difficulty: 0 })).toThrow()
    expect(() => taskInputSchema.parse({ title: 'ok', difficulty: 6 })).toThrow()
  })

  it('rejects a malformed due date', () => {
    expect(() => taskInputSchema.parse({ title: 'ok', dueDate: 'not-a-date' })).toThrow()
  })

  it('accepts a well-formed due date', () => {
    const result = taskInputSchema.parse({ title: 'ok', dueDate: '2026-12-01' })
    expect(result.dueDate).toBe('2026-12-01')
  })
})

describe('taskUpdateSchema', () => {
  it('accepts a partial patch with no fields', () => {
    expect(taskUpdateSchema.parse({})).toEqual({})
  })

  it('still enforces field-level constraints when present', () => {
    expect(() => taskUpdateSchema.parse({ title: '' })).toThrow()
  })
})
