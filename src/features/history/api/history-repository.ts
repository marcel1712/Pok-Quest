import { supabase } from '@/shared/lib/supabase-client'
import { HISTORY_KINDS } from '../types'
import type {
  HistoryEntry,
  HistoryKind,
  HistoryPeriod,
  HistorySummary,
  HistoryTotals,
} from '../types'

/** A safety net, not pagination: the page loads by date window and widens it on demand. */
export const HISTORY_FETCH_LIMIT = 1000

const EMPTY_TOTALS: HistoryTotals = {
  tasksCompleted: 0,
  focusSessions: 0,
  focusMinutes: 0,
  victories: 0,
  xpEarned: 0,
  captures: 0,
}

const PERIODS: HistoryPeriod[] = ['today', 'last7Days', 'last30Days', 'allTime']

/**
 * Everything that happened since `sinceIso`, newest first, from the single
 * `history_entries` view — one request for tasks, focus, battles, captures, evolutions
 * and badges alike. Filtering by kind happens on the client, over this one response.
 */
export async function listHistoryEntries(sinceIso: string): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from('history_entries')
    .select('*')
    .gte('occurred_at', sinceIso)
    .order('occurred_at', { ascending: false })
    .limit(HISTORY_FETCH_LIMIT)

  if (error) throw error

  return data.flatMap((row) => {
    const kind = row.kind as HistoryKind
    if (!row.entry_id || !row.occurred_at || !HISTORY_KINDS.includes(kind)) return []
    return [
      {
        id: `${kind}:${row.entry_id}`,
        kind,
        occurredAt: row.occurred_at,
        title: row.title ?? '',
        detail: row.detail,
        amount: row.amount,
      },
    ]
  })
}

/** Totals for today / 7 days / 30 days / all time, computed by the database from the
 * same view the timeline reads. A period with no activity comes back as zeros. */
export async function getHistorySummary(): Promise<HistorySummary> {
  const { data, error } = await supabase.rpc('get_history_summary')
  if (error) throw error

  const summary = Object.fromEntries(
    PERIODS.map((period) => [period, { ...EMPTY_TOTALS }]),
  ) as HistorySummary

  for (const row of data) {
    if (!PERIODS.includes(row.period as HistoryPeriod)) continue
    summary[row.period as HistoryPeriod] = {
      tasksCompleted: row.tasks_completed,
      focusSessions: row.focus_sessions,
      focusMinutes: row.focus_minutes,
      victories: row.victories,
      xpEarned: row.xp_earned,
      captures: row.captures,
    }
  }
  return summary
}
