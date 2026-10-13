import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listProductivityEvents } from './productivity-events-repository'

type QueryResult = { data: unknown; error: unknown }

function createQueryBuilderMock(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then: (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  return builder
}

const fromMock = vi.fn()

vi.mock('@/shared/lib/supabase-client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

beforeEach(() => {
  fromMock.mockReset()
})

describe('listProductivityEvents', () => {
  it('queries the productivity_events table without filters by default', async () => {
    const builder = createQueryBuilderMock({ data: [{ id: '1' }], error: null })
    fromMock.mockReturnValue(builder)

    const result = await listProductivityEvents()

    expect(fromMock).toHaveBeenCalledWith('productivity_events')
    expect(builder.eq).not.toHaveBeenCalled()
    expect(result).toEqual([{ id: '1' }])
  })

  it('filters by source type and source id when provided', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null })
    fromMock.mockReturnValue(builder)

    await listProductivityEvents({ sourceType: 'task', sourceId: 'task-1' })

    expect(builder.eq).toHaveBeenCalledWith('source_type', 'task')
    expect(builder.eq).toHaveBeenCalledWith('source_id', 'task-1')
  })

  it('throws when the query returns an error', async () => {
    const builder = createQueryBuilderMock({ data: null, error: new Error('boom') })
    fromMock.mockReturnValue(builder)

    await expect(listProductivityEvents()).rejects.toThrow('boom')
  })
})
