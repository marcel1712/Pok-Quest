import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionClock } from './use-session-clock'
import type { SessionTiming } from '../domain'

const T0 = new Date('2026-10-13T10:00:00.000Z')

function session(overrides: Partial<SessionTiming> = {}): SessionTiming {
  return {
    status: 'running',
    started_at: T0.toISOString(),
    paused_at: null,
    accumulated_pause_seconds: 0,
    planned_duration_seconds: 1500,
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSessionClock', () => {
  it('returns null when there is no session', () => {
    const { result } = renderHook(() => useSessionClock(null))
    expect(result.current).toBeNull()
  })

  it('ticks once a second without any network call, recomputing from timestamps', () => {
    const { result } = renderHook(() => useSessionClock(session()))

    expect(result.current?.elapsedSeconds).toBe(0)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current?.elapsedSeconds).toBe(5)
    expect(result.current?.phase).toBe('running')
  })

  it('stays correct after a large jump, as if the tab were backgrounded and reopened', () => {
    const { result } = renderHook(() => useSessionClock(session({ planned_duration_seconds: 60 })))

    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000) // 10 minutes, way past the 60s plan
    })

    expect(result.current?.phase).toBe('awaiting_confirmation')
    expect(result.current?.remainingSeconds).toBe(0)
  })

  it('stops ticking for a terminal session', () => {
    const { result, rerender } = renderHook(({ s }: { s: SessionTiming }) => useSessionClock(s), {
      initialProps: { s: session() },
    })

    rerender({ s: session({ status: 'completed' }) })

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current?.phase).toBe('completed')
  })
})
