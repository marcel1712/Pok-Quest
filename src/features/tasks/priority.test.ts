import { describe, expect, it } from 'vitest'
import { pickPriorityTasks } from './priority'
import type { Task } from './types'

const TODAY = '2026-10-14'

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    owner_id: 'owner-1',
    title: id,
    description: null,
    category_id: null,
    difficulty: 2,
    due_date: null,
    status: 'pending',
    completed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('pickPriorityTasks', () => {
  it('orders today first, then overdue (oldest first), then undated', () => {
    const result = pickPriorityTasks(
      [
        task('undated'),
        task('overdue-recent', { due_date: '2026-10-13' }),
        task('today', { due_date: TODAY }),
        task('overdue-old', { due_date: '2026-10-01' }),
      ],
      TODAY,
      10,
    )

    expect(result.tasks.map((entry) => entry.id)).toEqual([
      'today',
      'overdue-old',
      'overdue-recent',
      'undated',
    ])
    expect(result.todayCount).toBe(1)
    expect(result.pendingCount).toBe(3)
    expect(result.hiddenCount).toBe(0)
  })

  it('puts harder tasks first within the same group', () => {
    const result = pickPriorityTasks(
      [
        task('easy', { due_date: TODAY, difficulty: 1 }),
        task('hard', { due_date: TODAY, difficulty: 5 }),
      ],
      TODAY,
      10,
    )
    expect(result.tasks.map((entry) => entry.id)).toEqual(['hard', 'easy'])
  })

  it('leaves out future, completed and archived tasks', () => {
    const result = pickPriorityTasks(
      [
        task('future', { due_date: '2026-11-01' }),
        task('done', { status: 'completed', due_date: TODAY }),
        task('archived', { status: 'archived' }),
      ],
      TODAY,
      10,
    )
    expect(result.tasks).toEqual([])
    expect(result.todayCount).toBe(0)
    expect(result.pendingCount).toBe(0)
  })

  it('caps the list and reports how many were left out, keeping the counts whole', () => {
    const many = Array.from({ length: 30 }, (_, index) => task(`t${index}`))
    const result = pickPriorityTasks(many, TODAY, 5)

    expect(result.tasks).toHaveLength(5)
    expect(result.hiddenCount).toBe(25)
    expect(result.pendingCount).toBe(30)
  })
})
