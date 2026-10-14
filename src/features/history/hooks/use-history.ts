import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { getHistorySummary, listHistoryEntries } from '../api/history-repository'

const DAY_MS = 24 * 60 * 60 * 1000

// History is fed by half a dozen kinds of mutation spread over the app. Rather than
// teach each of them to invalidate it, it is simply never served stale: opening the
// page always refetches (two requests), while the previous data stays on screen.
const ALWAYS_FRESH = { staleTime: 0 } as const

export function useHistoryEntries(days: number) {
  return useQuery({
    queryKey: queryKeys.history.entries(days),
    // Rounded to the hour so re-renders within a visit reuse the same request.
    queryFn: () =>
      listHistoryEntries(
        new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000 - days * DAY_MS).toISOString(),
      ),
    placeholderData: keepPreviousData,
    ...ALWAYS_FRESH,
  })
}

export function useHistorySummary() {
  return useQuery({
    queryKey: queryKeys.history.summary(),
    queryFn: getHistorySummary,
    ...ALWAYS_FRESH,
  })
}
