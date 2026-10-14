export const HISTORY_KINDS = [
  'task',
  'focus',
  'battle',
  'capture',
  'evolution',
  'badge',
  'starter',
] as const

export type HistoryKind = (typeof HISTORY_KINDS)[number]

/** One row of the `history_entries` view, with the nullability a view loses restored. */
export type HistoryEntry = {
  id: string
  kind: HistoryKind
  occurredAt: string
  /** What it was: task title, opponent or species, badge name. */
  title: string
  /** A qualifier: encounter kind and place, where it was caught, what it evolved from. */
  detail: string | null
  /** Difficulty (task), minutes (focus), XP (battle) or level (capture). */
  amount: number | null
}

export type HistoryPeriod = 'today' | 'last7Days' | 'last30Days' | 'allTime'

export type HistoryTotals = {
  tasksCompleted: number
  focusSessions: number
  focusMinutes: number
  victories: number
  xpEarned: number
  captures: number
}

export type HistorySummary = Record<HistoryPeriod, HistoryTotals>

export type HistoryDay = {
  /** `YYYY-MM-DD` in the profile's timezone. */
  day: string
  entries: HistoryEntry[]
}
