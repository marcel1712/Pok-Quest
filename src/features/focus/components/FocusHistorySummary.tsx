import { useFocusHistory } from '../hooks/use-focus-history'

export function FocusHistorySummary() {
  const { isLoading, isError, summary } = useFocusHistory()

  if (isLoading || isError || !summary) return null

  return (
    <div className="flex gap-6 rounded border border-slate-800 p-4 text-sm">
      <div>
        <p className="text-slate-400">Hoje</p>
        <p className="text-lg font-semibold text-slate-100">
          {summary.today.sessionCount} {summary.today.sessionCount === 1 ? 'sessão' : 'sessões'} ·{' '}
          {summary.today.focusedMinutes} min
        </p>
      </div>
      <div>
        <p className="text-slate-400">Últimos 7 dias</p>
        <p className="text-lg font-semibold text-slate-100">
          {summary.last7Days.sessionCount}{' '}
          {summary.last7Days.sessionCount === 1 ? 'sessão' : 'sessões'} ·{' '}
          {summary.last7Days.focusedMinutes} min
        </p>
      </div>
    </div>
  )
}
