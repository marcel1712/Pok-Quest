import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHistorySummary, HISTORY_FETCH_LIMIT, listHistoryEntries } from './history-repository'

type QueryResult = { data: unknown; error: unknown }

function createQueryBuilderMock(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
  }
  return builder
}

const fromMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('@/shared/lib/supabase-client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

beforeEach(() => {
  fromMock.mockReset()
  rpcMock.mockReset()
})

describe('listHistoryEntries', () => {
  it('reads one window from the unified view, newest first', async () => {
    const builder = createQueryBuilderMock({
      data: [
        {
          owner_id: 'o',
          kind: 'task',
          occurred_at: '2026-10-14T12:00:00Z',
          entry_id: 'e1',
          title: 'Entregar relatório',
          detail: null,
          amount: 3,
        },
      ],
      error: null,
    })
    fromMock.mockReturnValue(builder)

    const entries = await listHistoryEntries('2026-09-14T00:00:00Z')

    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledWith('history_entries')
    expect(builder.gte).toHaveBeenCalledWith('occurred_at', '2026-09-14T00:00:00Z')
    expect(builder.order).toHaveBeenCalledWith('occurred_at', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(HISTORY_FETCH_LIMIT)
    expect(entries).toEqual([
      {
        id: 'task:e1',
        kind: 'task',
        occurredAt: '2026-10-14T12:00:00Z',
        title: 'Entregar relatório',
        detail: null,
        amount: 3,
      },
    ])
  })

  it('drops rows it cannot place on the timeline (unknown kind, no date, no id)', async () => {
    fromMock.mockReturnValue(
      createQueryBuilderMock({
        data: [
          { kind: 'mystery', occurred_at: '2026-10-14T12:00:00Z', entry_id: 'x', title: 't' },
          { kind: 'task', occurred_at: null, entry_id: 'y', title: 't' },
          { kind: 'task', occurred_at: '2026-10-14T12:00:00Z', entry_id: null, title: 't' },
          { kind: 'focus', occurred_at: '2026-10-14T12:00:00Z', entry_id: 'ok', title: null },
        ],
        error: null,
      }),
    )

    const entries = await listHistoryEntries('2026-09-14T00:00:00Z')
    expect(entries.map((entry) => entry.id)).toEqual(['focus:ok'])
    expect(entries[0]?.title).toBe('')
  })

  it('keeps ids unique across kinds that could share a source id', async () => {
    fromMock.mockReturnValue(
      createQueryBuilderMock({
        data: [
          { kind: 'battle', occurred_at: '2026-10-14T12:00:00Z', entry_id: 'same', title: 'a' },
          { kind: 'capture', occurred_at: '2026-10-14T12:00:00Z', entry_id: 'same', title: 'b' },
        ],
        error: null,
      }),
    )

    const ids = (await listHistoryEntries('2026-09-14T00:00:00Z')).map((entry) => entry.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('throws on error', async () => {
    fromMock.mockReturnValue(createQueryBuilderMock({ data: null, error: { message: 'boom' } }))
    await expect(listHistoryEntries('2026-09-14T00:00:00Z')).rejects.toEqual({ message: 'boom' })
  })
})

describe('getHistorySummary', () => {
  it('maps each period and fills the ones the database did not return with zeros', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          period: 'allTime',
          tasks_completed: 12,
          focus_sessions: 30,
          focus_minutes: 750,
          victories: 20,
          xp_earned: 900,
          captures: 4,
        },
      ],
      error: null,
    })

    const summary = await getHistorySummary()

    expect(rpcMock).toHaveBeenCalledWith('get_history_summary')
    expect(summary.allTime).toEqual({
      tasksCompleted: 12,
      focusSessions: 30,
      focusMinutes: 750,
      victories: 20,
      xpEarned: 900,
      captures: 4,
    })
    expect(summary.today).toEqual({
      tasksCompleted: 0,
      focusSessions: 0,
      focusMinutes: 0,
      victories: 0,
      xpEarned: 0,
      captures: 0,
    })
    expect(Object.keys(summary).sort()).toEqual(['allTime', 'last30Days', 'last7Days', 'today'])
  })

  it('throws on error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(getHistorySummary()).rejects.toEqual({ message: 'boom' })
  })
})
