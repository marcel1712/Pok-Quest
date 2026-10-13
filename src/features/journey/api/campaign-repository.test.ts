import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCampaignContent, listCampaignProgress } from './campaign-repository'

type QueryResult = { data: unknown; error: unknown }

function createQueryBuilderMock(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
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

describe('getCampaignContent', () => {
  it('returns nodes in story order together with their prerequisites', async () => {
    const nodes = createQueryBuilderMock({ data: [{ id: 'sinnoh.a' }], error: null })
    const prerequisites = createQueryBuilderMock({
      data: [{ node_id: 'sinnoh.b', requires_node_id: 'sinnoh.a' }],
      error: null,
    })
    fromMock.mockImplementation((table: string) =>
      table === 'campaign_nodes' ? nodes : prerequisites,
    )

    expect(await getCampaignContent()).toEqual({
      nodes: [{ id: 'sinnoh.a' }],
      prerequisites: [{ node_id: 'sinnoh.b', requires_node_id: 'sinnoh.a' }],
    })
    expect(nodes.order).toHaveBeenCalledWith('sort_order', { ascending: true })
  })

  it('throws when either query fails', async () => {
    fromMock.mockImplementation((table: string) =>
      createQueryBuilderMock(
        table === 'campaign_nodes'
          ? { data: [], error: null }
          : { data: null, error: { code: '42501', message: 'denied' } },
      ),
    )

    await expect(getCampaignContent()).rejects.toEqual({ code: '42501', message: 'denied' })
  })
})

describe('listCampaignProgress', () => {
  it('returns the progress rows', async () => {
    fromMock.mockReturnValue(
      createQueryBuilderMock({ data: [{ node_id: 'sinnoh.a', victories: 1 }], error: null }),
    )

    expect(await listCampaignProgress()).toEqual([{ node_id: 'sinnoh.a', victories: 1 }])
    expect(fromMock).toHaveBeenCalledWith('campaign_node_progress')
  })

  it('throws on error', async () => {
    fromMock.mockReturnValue(createQueryBuilderMock({ data: null, error: { message: 'boom' } }))
    await expect(listCampaignProgress()).rejects.toEqual({ message: 'boom' })
  })
})
