import { describe, expect, it } from 'vitest'
import { summarizeFocusHistory, toZonedDateString } from './stats'
import type { FocusSession } from './types'

function session(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: 'id',
    owner_id: 'owner',
    task_id: null,
    planned_duration_seconds: 1500,
    status: 'completed',
    started_at: '2026-10-13T10:00:00.000Z',
    paused_at: null,
    accumulated_pause_seconds: 0,
    ended_at: '2026-10-13T10:25:00.000Z',
    created_at: '2026-10-13T10:00:00.000Z',
    updated_at: '2026-10-13T10:25:00.000Z',
    ...overrides,
  }
}

describe('toZonedDateString', () => {
  it('shifts the calendar date according to the given timezone', () => {
    // 02:30 UTC is still "the day before" at UTC-5 (21:30).
    expect(toZonedDateString('2026-10-13T02:30:00.000Z', 'UTC')).toBe('2026-10-13')
    expect(toZonedDateString('2026-10-13T02:30:00.000Z', 'America/New_York')).toBe('2026-10-12')
  })
})

describe('summarizeFocusHistory', () => {
  const now = '2026-10-13T12:00:00.000Z'

  it('only counts completed sessions', () => {
    const sessions = [
      session({ status: 'cancelled', ended_at: now }),
      session({ status: 'completed', ended_at: now }),
    ]
    expect(summarizeFocusHistory(sessions, 'UTC', now).today.sessionCount).toBe(1)
  })

  it('buckets a session ended today into "today"', () => {
    const sessions = [session({ ended_at: '2026-10-13T08:00:00.000Z' })]
    const result = summarizeFocusHistory(sessions, 'UTC', now)
    expect(result.today.sessionCount).toBe(1)
    expect(result.today.focusedMinutes).toBe(25)
  })

  it('excludes a session from "today" if it ended on a different calendar day', () => {
    const sessions = [session({ ended_at: '2026-10-12T23:00:00.000Z' })]
    expect(summarizeFocusHistory(sessions, 'UTC', now).today.sessionCount).toBe(0)
  })

  it('includes sessions within the rolling 7-day window', () => {
    const sixDaysAgo = new Date(new Date(now).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
    const sessions = [session({ ended_at: sixDaysAgo })]
    expect(summarizeFocusHistory(sessions, 'UTC', now).last7Days.sessionCount).toBe(1)
  })

  it('excludes sessions older than 7 days', () => {
    const eightDaysAgo = new Date(new Date(now).getTime() - 8 * 24 * 60 * 60 * 1000).toISOString()
    const sessions = [session({ ended_at: eightDaysAgo })]
    expect(summarizeFocusHistory(sessions, 'UTC', now).last7Days.sessionCount).toBe(0)
  })

  it('sums focused minutes across multiple sessions', () => {
    const sessions = [
      session({ ended_at: now, planned_duration_seconds: 1500 }),
      session({ ended_at: now, planned_duration_seconds: 900 }),
    ]
    const result = summarizeFocusHistory(sessions, 'UTC', now)
    expect(result.today.focusedMinutes).toBe(40)
  })
})
