import { useEffect, useState } from 'react'
import { computeElapsedSeconds, computeRemainingSeconds, getSessionPhase } from '../domain'
import type { SessionTiming } from '../domain'
import type { FocusSessionPhase } from '../types'

export type SessionClock = {
  elapsedSeconds: number
  remainingSeconds: number
  phase: FocusSessionPhase
}

/**
 * Ticks once a second purely to re-render — every value is recomputed from the
 * session's persisted timestamps against `Date.now()` (RF-015), never accumulated
 * client-side. That's what keeps the timer correct after the tab sat backgrounded or
 * the page reloaded: there's no counter to have drifted, only a fresh recomputation.
 */
export function useSessionClock(session: SessionTiming | null): SessionClock | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!session || session.status === 'completed' || session.status === 'cancelled') return

    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [session])

  if (!session) return null

  return {
    elapsedSeconds: computeElapsedSeconds(session, now),
    remainingSeconds: computeRemainingSeconds(session, now),
    phase: getSessionPhase(session, now),
  }
}
