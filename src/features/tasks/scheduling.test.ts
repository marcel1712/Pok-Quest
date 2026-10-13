import { describe, expect, it } from 'vitest'
import { scheduleTasks } from './scheduling'
import type { Task } from './types'

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'id',
    owner_id: 'owner',
    title: 'task',
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

describe('scheduleTasks', () => {
  const today = '2026-10-13'

  it('puts tasks due today in "today"', () => {
    const task = makeTask({ id: '1', due_date: today })
    expect(scheduleTasks([task], today).today).toEqual([task])
  })

  it('puts tasks with no due date in "overdueOrUnscheduled"', () => {
    const task = makeTask({ id: '1', due_date: null })
    expect(scheduleTasks([task], today).overdueOrUnscheduled).toEqual([task])
  })

  it('puts overdue tasks in "overdueOrUnscheduled"', () => {
    const task = makeTask({ id: '1', due_date: '2026-10-01' })
    expect(scheduleTasks([task], today).overdueOrUnscheduled).toEqual([task])
  })

  it('puts future tasks in "upcoming"', () => {
    const task = makeTask({ id: '1', due_date: '2026-11-01' })
    expect(scheduleTasks([task], today).upcoming).toEqual([task])
  })

  it('excludes completed and archived tasks entirely', () => {
    const completed = makeTask({ id: '1', status: 'completed', due_date: today })
    const archived = makeTask({ id: '2', status: 'archived', due_date: today })
    const result = scheduleTasks([completed, archived], today)
    expect(result.today).toEqual([])
    expect(result.overdueOrUnscheduled).toEqual([])
    expect(result.upcoming).toEqual([])
  })
})
