import { describe, expect, it } from 'vitest'
import { describeEntry, formatDayLabel, groupByDay } from './domain'
import type { HistoryEntry } from './types'

function entry(
  overrides: Partial<HistoryEntry> & { id: string; occurredAt: string },
): HistoryEntry {
  return { kind: 'task', title: 'Tarefa', detail: null, amount: null, ...overrides }
}

describe('groupByDay', () => {
  // 02:30 UTC on the 14th is still 23:30 on the 13th in São Paulo (UTC-3).
  const lateNight = entry({ id: 'a', occurredAt: '2026-10-14T02:30:00Z' })
  const afterMidnight = entry({ id: 'b', occurredAt: '2026-10-14T03:10:00Z' })

  it('splits around midnight in the given timezone, not in UTC', () => {
    const days = groupByDay([afterMidnight, lateNight], 'America/Sao_Paulo')

    expect(days.map((day) => [day.day, day.entries.map((e) => e.id)])).toEqual([
      ['2026-10-14', ['b']],
      ['2026-10-13', ['a']],
    ])
  })

  it('puts the same two entries on one day for a UTC profile', () => {
    const days = groupByDay([afterMidnight, lateNight], 'UTC')

    expect(days).toHaveLength(1)
    expect(days[0]?.day).toBe('2026-10-14')
    expect(days[0]?.entries.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('skips days with no activity instead of emitting empty ones', () => {
    const days = groupByDay(
      [
        entry({ id: 'new', occurredAt: '2026-10-14T12:00:00Z' }),
        entry({ id: 'old', occurredAt: '2026-10-01T12:00:00Z' }),
      ],
      'UTC',
    )
    expect(days.map((day) => day.day)).toEqual(['2026-10-14', '2026-10-01'])
  })

  it('returns nothing for no entries', () => {
    expect(groupByDay([], 'UTC')).toEqual([])
  })
})

describe('formatDayLabel', () => {
  const now = '2026-10-14T03:10:00Z' // 00:10 on the 14th in São Paulo

  it('names today and yesterday relative to the profile timezone', () => {
    expect(formatDayLabel('2026-10-14', now, 'America/Sao_Paulo')).toBe('Hoje')
    expect(formatDayLabel('2026-10-13', now, 'America/Sao_Paulo')).toBe('Ontem')
  })

  it('treats the same instant as the previous day further west', () => {
    // 03:10 UTC is still the 13th in Los Angeles.
    expect(formatDayLabel('2026-10-13', now, 'America/Los_Angeles')).toBe('Hoje')
  })

  it('writes older days out in full, without shifting the date', () => {
    expect(formatDayLabel('2026-10-01', now, 'America/Sao_Paulo')).toBe(
      'quinta-feira, 1 de outubro de 2026',
    )
  })
})

describe('describeEntry', () => {
  it('describes a completed task with its difficulty', () => {
    expect(
      describeEntry(entry({ id: '1', occurredAt: '', title: 'Entregar relatório', amount: 4 })),
    ).toEqual({ text: 'Concluiu: Entregar relatório', meta: 'dificuldade 4/5' })
  })

  it('describes a focus session by its minutes', () => {
    expect(describeEntry(entry({ id: '1', occurredAt: '', kind: 'focus', amount: 25 }))).toEqual({
      text: 'Sessão de foco concluída',
      meta: '25 min',
    })
  })

  it('describes a battle with its kind, place and XP', () => {
    expect(
      describeEntry(
        entry({
          id: '1',
          occurredAt: '',
          kind: 'battle',
          title: 'Roark',
          detail: 'gymLeader · Ginásio de Oreburgh',
          amount: 45,
        }),
      ),
    ).toEqual({ text: 'Venceu Roark', meta: 'Líder de Ginásio · Ginásio de Oreburgh · +45 XP' })
  })

  it('describes a battle outside the campaign, or with no XP, without inventing details', () => {
    expect(
      describeEntry(
        entry({
          id: '1',
          occurredAt: '',
          kind: 'battle',
          title: 'Encontro',
          detail: 'wild',
          amount: 0,
        }),
      ),
    ).toEqual({ text: 'Venceu Encontro', meta: 'Pokémon selvagem' })
  })

  it('describes captures, evolutions, badges and the starter', () => {
    const at = { id: '1', occurredAt: '' }
    expect(
      describeEntry(
        entry({ ...at, kind: 'capture', title: 'Starly', detail: 'Rota 201', amount: 3 }),
      ),
    ).toEqual({ text: 'Capturou Starly', meta: 'Nv. 3 · Rota 201' })
    expect(
      describeEntry(entry({ ...at, kind: 'evolution', title: 'Monferno', detail: 'Chimchar' })),
    ).toEqual({ text: 'Chimchar evoluiu para Monferno', meta: null })
    expect(
      describeEntry(
        entry({ ...at, kind: 'badge', title: 'Insígnia do Carvão', detail: 'Ginásio de Oreburgh' }),
      ),
    ).toEqual({ text: 'Conquistou a Insígnia do Carvão', meta: 'Ginásio de Oreburgh' })
    expect(describeEntry(entry({ ...at, kind: 'starter', title: 'Chimchar' }))).toEqual({
      text: 'Escolheu Chimchar como Pokémon inicial',
      meta: null,
    })
  })
})
