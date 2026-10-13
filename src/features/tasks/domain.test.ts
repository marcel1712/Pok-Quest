import { describe, expect, it } from 'vitest'
import { archiveTask, completeTask, reopenTask, TaskTransitionError } from './domain'

describe('completeTask', () => {
  it('completes a pending task, stamping completed_at', () => {
    const patch = completeTask({ status: 'pending' })
    expect(patch.status).toBe('completed')
    expect(typeof patch.completed_at).toBe('string')
  })

  it('is a no-op for an already-completed task (no duplicate reward trigger)', () => {
    expect(completeTask({ status: 'completed' })).toEqual({})
  })

  it('rejects completing an archived task', () => {
    expect(() => completeTask({ status: 'archived' })).toThrow(TaskTransitionError)
  })
})

describe('reopenTask', () => {
  it('reopens a completed task, clearing completed_at', () => {
    expect(reopenTask({ status: 'completed' })).toEqual({ status: 'pending', completed_at: null })
  })

  it('is a no-op for an already-pending task', () => {
    expect(reopenTask({ status: 'pending' })).toEqual({})
  })

  it('rejects reopening an archived task', () => {
    expect(() => reopenTask({ status: 'archived' })).toThrow(TaskTransitionError)
  })
})

describe('archiveTask', () => {
  it('archives a pending or completed task', () => {
    expect(archiveTask({ status: 'pending' })).toEqual({ status: 'archived' })
    expect(archiveTask({ status: 'completed' })).toEqual({ status: 'archived' })
  })

  it('is a no-op for an already-archived task', () => {
    expect(archiveTask({ status: 'archived' })).toEqual({})
  })
})
