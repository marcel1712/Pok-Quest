import type { HistoryPeriod, HistorySummary } from '../types'

const PERIOD_LABELS: Record<HistoryPeriod, string> = {
  today: 'Hoje',
  last7Days: '7 dias',
  last30Days: '30 dias',
  allTime: 'Total',
}

const PERIODS: HistoryPeriod[] = ['today', 'last7Days', 'last30Days', 'allTime']

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  // Compact on purpose: four of these have to fit side by side on a phone.
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`
}

/**
 * Totals only — deliberately no streaks, no "days missed", no comparison with a
 * previous period: a quiet week shows as smaller numbers, never as a failure.
 */
export function HistorySummaryPanel({ summary }: { summary: HistorySummary }) {
  const rows: { label: string; value: (period: HistoryPeriod) => string }[] = [
    { label: 'Tempo focado', value: (period) => formatMinutes(summary[period].focusMinutes) },
    { label: 'Sessões de foco', value: (period) => String(summary[period].focusSessions) },
    { label: 'Tarefas concluídas', value: (period) => String(summary[period].tasksCompleted) },
    { label: 'Batalhas vencidas', value: (period) => String(summary[period].victories) },
    { label: 'XP ganho', value: (period) => String(summary[period].xpEarned) },
    { label: 'Capturas', value: (period) => String(summary[period].captures) },
  ]

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <caption className="sr-only">Resumo de atividade por período</caption>
        <thead>
          <tr className="text-ink-muted">
            <td />
            {PERIODS.map((period) => (
              <th key={period} scope="col" className="px-1 pb-2 text-right font-medium sm:px-2">
                {PERIOD_LABELS[period]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-line">
              <th scope="row" className="py-2 pr-2 text-left font-normal text-ink-soft">
                {row.label}
              </th>
              {PERIODS.map((period) => (
                <td
                  key={period}
                  className="px-1 py-2 text-right font-semibold whitespace-nowrap text-ink sm:px-2"
                >
                  {row.value(period)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
