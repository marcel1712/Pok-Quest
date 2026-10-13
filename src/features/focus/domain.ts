import type { FocusSessionPhase, FocusSessionUpdate } from './types'

export class FocusSessionTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FocusSessionTransitionError'
  }
}

// `status` is plain `string` here (not FocusSessionStatus) because the generated DB row
// type widens the `text` column that way too — see the same tradeoff in tasks/domain.ts.
export type SessionTiming = {
  status: string
  started_at: string
  paused_at: string | null
  accumulated_pause_seconds: number
  planned_duration_seconds: number
}

/**
 * Active time elapsed so far, in seconds, derived purely from persisted timestamps
 * (RF-015) — never from a client-side tick count. The clock freezes while paused: time
 * since `paused_at` doesn't count, and once resumed it's folded into
 * `accumulated_pause_seconds` by `resumeSession`.
 */
export function computeElapsedSeconds(session: SessionTiming, nowMs: number): number {
  const startedMs = new Date(session.started_at).getTime()
  const clockMs =
    session.status === 'paused' && session.paused_at ? new Date(session.paused_at).getTime() : nowMs
  const rawSeconds = Math.floor((clockMs - startedMs) / 1000)
  return Math.max(0, rawSeconds - session.accumulated_pause_seconds)
}

export function computeRemainingSeconds(session: SessionTiming, nowMs: number): number {
  return Math.max(0, session.planned_duration_seconds - computeElapsedSeconds(session, nowMs))
}

/**
 * The UI-facing phase, including `awaiting_confirmation` — a derived state (RF-016):
 * the planned duration elapsed, but nothing auto-completes the session. Only reachable
 * while actively `running`; a paused session stays `paused` even past its target, since
 * pausing was itself an explicit user action.
 */
export function getSessionPhase(session: SessionTiming, nowMs: number): FocusSessionPhase {
  if (session.status === 'completed') return 'completed'
  if (session.status === 'cancelled') return 'cancelled'
  if (session.status === 'running' && computeRemainingSeconds(session, nowMs) <= 0) {
    return 'awaiting_confirmation'
  }
  return session.status === 'paused' ? 'paused' : 'running'
}

type StatusHolder = { status: string; paused_at?: string | null }

export function pauseSession(session: StatusHolder, nowIso: string): FocusSessionUpdate {
  if (session.status !== 'running') {
    throw new FocusSessionTransitionError('Só é possível pausar uma sessão em andamento.')
  }
  return { status: 'paused', paused_at: nowIso }
}

export function resumeSession(
  session: StatusHolder & { accumulated_pause_seconds: number },
  nowIso: string,
): FocusSessionUpdate {
  if (session.status !== 'paused' || !session.paused_at) {
    throw new FocusSessionTransitionError('Só é possível retomar uma sessão pausada.')
  }
  const pausedMs = new Date(session.paused_at).getTime()
  const nowMs = new Date(nowIso).getTime()
  const pauseDurationSeconds = Math.max(0, Math.floor((nowMs - pausedMs) / 1000))
  return {
    status: 'running',
    paused_at: null,
    accumulated_pause_seconds: session.accumulated_pause_seconds + pauseDurationSeconds,
  }
}

/** Only valid once the derived phase is `awaiting_confirmation` — guards RF-016 even if
 * the UI's own disabled-button check is bypassed. */
export function confirmSession(session: SessionTiming, nowMs: number): FocusSessionUpdate {
  if (getSessionPhase(session, nowMs) !== 'awaiting_confirmation') {
    throw new FocusSessionTransitionError(
      'A sessão só pode ser confirmada depois que o tempo planejado se esgota.',
    )
  }
  return { status: 'completed', ended_at: new Date(nowMs).toISOString() }
}

export function cancelSession(session: StatusHolder, nowIso: string): FocusSessionUpdate {
  if (session.status !== 'running' && session.status !== 'paused') {
    throw new FocusSessionTransitionError('Só é possível cancelar uma sessão ativa.')
  }
  return { status: 'cancelled', ended_at: nowIso }
}

/** Edge-detector for the completion chime (T-018): fires only the instant the phase
 * newly becomes `awaiting_confirmation`, not on every render while it stays there. */
export function didJustReachAwaitingConfirmation(
  previousPhase: FocusSessionPhase | undefined,
  currentPhase: FocusSessionPhase,
): boolean {
  return currentPhase === 'awaiting_confirmation' && previousPhase !== 'awaiting_confirmation'
}
