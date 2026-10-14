import { describeEntry, formatDayLabel, formatTime, KIND_LABELS } from '../domain'
import type { HistoryDay } from '../types'

export function HistoryTimeline({
  days,
  timeZone,
  nowIso,
}: {
  days: HistoryDay[]
  timeZone: string
  nowIso: string
}) {
  return (
    <div className="flex flex-col gap-6">
      {days.map(({ day, entries }) => (
        <section key={day} aria-labelledby={`history-day-${day}`} className="flex flex-col gap-2">
          <h2
            id={`history-day-${day}`}
            className="text-sm font-semibold text-ink-muted first-letter:uppercase"
          >
            {formatDayLabel(day, nowIso, timeZone)}
          </h2>
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => {
              const { text, meta } = describeEntry(entry)
              return (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 rounded-control border border-line p-3"
                >
                  <span aria-hidden="true">{KIND_LABELS[entry.kind].glyph}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink">{text}</p>
                    {meta && <p className="text-xs text-ink-muted">{meta}</p>}
                  </div>
                  <time dateTime={entry.occurredAt} className="shrink-0 text-xs text-ink-muted">
                    {formatTime(entry.occurredAt, timeZone)}
                  </time>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
