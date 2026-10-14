import { ENCOUNTER_LABELS } from '@/features/battles/labels'
import type { EncounterKind } from '@/features/battles/types'
import { toZonedDateString } from '@/features/focus/stats'
import type { HistoryDay, HistoryEntry, HistoryKind } from './types'

export const KIND_LABELS: Record<HistoryKind, { label: string; glyph: string }> = {
  task: { label: 'Tarefas', glyph: '✅' },
  focus: { label: 'Foco', glyph: '⏱️' },
  battle: { label: 'Batalhas', glyph: '⚔️' },
  capture: { label: 'Capturas', glyph: '🔴' },
  evolution: { label: 'Evoluções', glyph: '✨' },
  badge: { label: 'Insígnias', glyph: '🏅' },
  starter: { label: 'Inicial', glyph: '🌱' },
}

/**
 * Groups entries (already newest first) by calendar day in the profile's timezone — a
 * session finished at 23:50 and a task done at 00:10 land on different days, whatever
 * the browser's or the server's clock says. Days with nothing in them simply do not
 * appear: the history never shows a gap as something missed.
 */
export function groupByDay(entries: HistoryEntry[], timeZone: string): HistoryDay[] {
  const days: HistoryDay[] = []
  for (const entry of entries) {
    const day = toZonedDateString(entry.occurredAt, timeZone)
    const last = days[days.length - 1]
    if (last?.day === day) last.entries.push(entry)
    else days.push({ day, entries: [entry] })
  }
  return days
}

/** "Hoje", "Ontem" or a full date, for a `YYYY-MM-DD` day key. */
export function formatDayLabel(day: string, nowIso: string, timeZone: string): string {
  const today = toZonedDateString(nowIso, timeZone)
  if (day === today) return 'Hoje'

  const yesterday = toZonedDateString(
    new Date(new Date(nowIso).getTime() - 24 * 60 * 60 * 1000).toISOString(),
    timeZone,
  )
  if (day === yesterday) return 'Ontem'

  // The key is already a local date: format it as such, at noon UTC so no timezone
  // conversion can push it onto a neighbouring day.
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${day}T12:00:00Z`))
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** The sentence and the small print for one entry. */
export function describeEntry(entry: HistoryEntry): { text: string; meta: string | null } {
  const { title, detail, amount } = entry

  switch (entry.kind) {
    case 'task':
      return { text: `Concluiu: ${title}`, meta: amount ? `dificuldade ${amount}/5` : null }
    case 'focus':
      return { text: 'Sessão de foco concluída', meta: amount !== null ? `${amount} min` : null }
    case 'battle': {
      // detail is "<encounter kind>" or "<encounter kind> · <place>".
      const [kind, place] = (detail ?? '').split(' · ')
      const kindLabel = ENCOUNTER_LABELS[kind as EncounterKind]?.label
      const parts = [kindLabel, place, amount ? `+${amount} XP` : null].filter(Boolean)
      return { text: `Venceu ${title}`, meta: parts.length > 0 ? parts.join(' · ') : null }
    }
    case 'capture': {
      const parts = [amount ? `Nv. ${amount}` : null, detail].filter(Boolean)
      return { text: `Capturou ${title}`, meta: parts.length > 0 ? parts.join(' · ') : null }
    }
    case 'evolution':
      return { text: `${detail ?? 'Pokémon'} evoluiu para ${title}`, meta: null }
    case 'badge':
      return { text: `Conquistou a ${title}`, meta: detail }
    case 'starter':
      return { text: `Escolheu ${title} como Pokémon inicial`, meta: null }
  }
}
