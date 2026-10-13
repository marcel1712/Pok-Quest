import type { FocusSession } from './types'

/** `YYYY-MM-DD` of `iso` as seen in `timeZone` (RNF-013: convert by the profile's
 * configured timezone, not the machine's local one). */
export function toZonedDateString(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

export type FocusHistoryBucket = { sessionCount: number; focusedMinutes: number }

export type FocusHistorySummary = {
  today: FocusHistoryBucket
  /** Rolling 7-day window ending today, not a calendar week — see docs/DECISIONS.md. */
  last7Days: FocusHistoryBucket
}

/**
 * Only `completed` sessions count (CA: "métricas usam apenas sessões válidas") —
 * cancelled or still-active sessions never reach the caller since the repository only
 * fetches completed ones, but this stays defensive in case that ever changes.
 */
export function summarizeFocusHistory(
  sessions: FocusSession[],
  timeZone: string,
  nowIso: string,
): FocusHistorySummary {
  const todayKey = toZonedDateString(nowIso, timeZone)
  const sevenDaysAgoMs = new Date(nowIso).getTime() - 7 * 24 * 60 * 60 * 1000

  const today: FocusHistoryBucket = { sessionCount: 0, focusedMinutes: 0 }
  const last7Days: FocusHistoryBucket = { sessionCount: 0, focusedMinutes: 0 }

  for (const session of sessions) {
    if (session.status !== 'completed' || !session.ended_at) continue

    const focusedSeconds = session.planned_duration_seconds
    const focusedMinutes = Math.round(focusedSeconds / 60)
    const endedMs = new Date(session.ended_at).getTime()

    if (endedMs >= sevenDaysAgoMs) {
      last7Days.sessionCount += 1
      last7Days.focusedMinutes += focusedMinutes
    }

    if (toZonedDateString(session.ended_at, timeZone) === todayKey) {
      today.sessionCount += 1
      today.focusedMinutes += focusedMinutes
    }
  }

  return { today, last7Days }
}
