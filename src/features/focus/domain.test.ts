import { describe, expect, it } from 'vitest'
import {
  cancelSession,
  computeElapsedSeconds,
  computeRemainingSeconds,
  confirmSession,
  didJustReachAwaitingConfirmation,
  FocusSessionTransitionError,
  getSessionPhase,
  pauseSession,
  resumeSession,
} from './domain'
import type { SessionTiming } from './domain'

const T0 = new Date('2026-10-13T10:00:00.000Z').getTime()

function session(overrides: Partial<SessionTiming> = {}): SessionTiming {
  return {
    status: 'running',
    started_at: new Date(T0).toISOString(),
    paused_at: null,
    accumulated_pause_seconds: 0,
    planned_duration_seconds: 1500, // 25 min
    ...overrides,
  }
}

describe('computeElapsedSeconds', () => {
  it('computes elapsed time purely from timestamps, not ticks', () => {
    const s = session()
    expect(computeElapsedSeconds(s, T0 + 10 * 1000)).toBe(10)
  })

  it('excludes time already folded into accumulated_pause_seconds', () => {
    const s = session({ accumulated_pause_seconds: 30 })
    expect(computeElapsedSeconds(s, T0 + 100 * 1000)).toBe(70)
  })

  it('freezes at the moment of pausing — time after paused_at does not count', () => {
    const s = session({ status: 'paused', paused_at: new Date(T0 + 20_000).toISOString() })
    // "now" is an hour later (e.g. the tab was closed and reopened), but elapsed must
    // still read as of the pause instant, not the wall-clock gap.
    expect(computeElapsedSeconds(s, T0 + 3_600_000)).toBe(20)
  })

  it('is unaffected by the local clock jumping backwards after the session started', () => {
    // A system clock change after started_at must not make elapsed negative or throw;
    // the floor is 0.
    const s = session({ started_at: new Date(T0).toISOString() })
    expect(computeElapsedSeconds(s, T0 - 50_000)).toBe(0)
  })
})

describe('computeRemainingSeconds', () => {
  it('never goes negative once elapsed exceeds the plan', () => {
    const s = session({ planned_duration_seconds: 60 })
    expect(computeRemainingSeconds(s, T0 + 600_000)).toBe(0)
  })
})

describe('getSessionPhase', () => {
  it('reports awaiting_confirmation once a running session reaches its planned duration', () => {
    const s = session({ planned_duration_seconds: 60 })
    expect(getSessionPhase(s, T0 + 60_000)).toBe('awaiting_confirmation')
  })

  it('a paused session past its target stays "paused", not awaiting_confirmation', () => {
    const s = session({
      status: 'paused',
      paused_at: new Date(T0 + 120_000).toISOString(),
      planned_duration_seconds: 60,
    })
    expect(getSessionPhase(s, T0 + 10_000_000)).toBe('paused')
  })

  it('passes through terminal states unchanged', () => {
    expect(getSessionPhase(session({ status: 'completed' }), T0)).toBe('completed')
    expect(getSessionPhase(session({ status: 'cancelled' }), T0)).toBe('cancelled')
  })
})

describe('pauseSession', () => {
  it('pauses a running session, stamping paused_at', () => {
    const patch = pauseSession({ status: 'running' }, new Date(T0).toISOString())
    expect(patch).toEqual({ status: 'paused', paused_at: new Date(T0).toISOString() })
  })

  it('rejects pausing a session that is not running', () => {
    expect(() => pauseSession({ status: 'paused' }, new Date(T0).toISOString())).toThrow(
      FocusSessionTransitionError,
    )
    expect(() => pauseSession({ status: 'completed' }, new Date(T0).toISOString())).toThrow(
      FocusSessionTransitionError,
    )
  })
})

describe('resumeSession', () => {
  it('resumes a paused session, folding the pause duration into accumulated_pause_seconds', () => {
    const patch = resumeSession(
      {
        status: 'paused',
        paused_at: new Date(T0).toISOString(),
        accumulated_pause_seconds: 5,
      },
      new Date(T0 + 15_000).toISOString(),
    )
    expect(patch).toEqual({ status: 'running', paused_at: null, accumulated_pause_seconds: 20 })
  })

  it('rejects resuming a session that is not paused', () => {
    expect(() =>
      resumeSession(
        { status: 'running', paused_at: null, accumulated_pause_seconds: 0 },
        new Date(T0).toISOString(),
      ),
    ).toThrow(FocusSessionTransitionError)
  })
})

describe('confirmSession', () => {
  it('completes a session once the planned duration has elapsed', () => {
    const s = session({ planned_duration_seconds: 60 })
    const patch = confirmSession(s, T0 + 60_000)
    expect(patch.status).toBe('completed')
    expect(patch.ended_at).toBe(new Date(T0 + 60_000).toISOString())
  })

  it('rejects confirming before the planned duration elapses (no implicit win on a wall-clock fluke)', () => {
    const s = session({ planned_duration_seconds: 1500 })
    expect(() => confirmSession(s, T0 + 10_000)).toThrow(FocusSessionTransitionError)
  })

  it('rejects confirming a paused session even if it is past its target', () => {
    const s = session({
      status: 'paused',
      paused_at: new Date(T0 + 120_000).toISOString(),
      planned_duration_seconds: 60,
    })
    expect(() => confirmSession(s, T0 + 10_000_000)).toThrow(FocusSessionTransitionError)
  })
})

describe('cancelSession', () => {
  it('cancels a running or paused session', () => {
    expect(cancelSession({ status: 'running' }, new Date(T0).toISOString())).toEqual({
      status: 'cancelled',
      ended_at: new Date(T0).toISOString(),
    })
    expect(cancelSession({ status: 'paused' }, new Date(T0).toISOString())).toEqual({
      status: 'cancelled',
      ended_at: new Date(T0).toISOString(),
    })
  })

  it('rejects cancelling an already-terminal session', () => {
    expect(() => cancelSession({ status: 'completed' }, new Date(T0).toISOString())).toThrow(
      FocusSessionTransitionError,
    )
  })
})

describe('didJustReachAwaitingConfirmation', () => {
  it('fires on the transition into awaiting_confirmation', () => {
    expect(didJustReachAwaitingConfirmation('running', 'awaiting_confirmation')).toBe(true)
  })

  it('does not fire again while it stays awaiting_confirmation', () => {
    expect(didJustReachAwaitingConfirmation('awaiting_confirmation', 'awaiting_confirmation')).toBe(
      false,
    )
  })

  it('does not fire for unrelated phases', () => {
    expect(didJustReachAwaitingConfirmation('running', 'paused')).toBe(false)
    expect(didJustReachAwaitingConfirmation(undefined, 'running')).toBe(false)
  })
})
