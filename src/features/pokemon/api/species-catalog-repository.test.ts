import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSpeciesByPokedexNumber, listSpeciesCatalog } from './species-catalog-repository'

type QueryResult = { data: unknown; error: unknown }

function createQueryBuilderMock(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
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

describe('listSpeciesCatalog', () => {
  it('queries the catalog ordered by pokedex number', async () => {
    const builder = createQueryBuilderMock({ data: [{ pokedex_number: 387 }], error: null })
    fromMock.mockReturnValue(builder)

    const result = await listSpeciesCatalog()

    expect(fromMock).toHaveBeenCalledWith('species_catalog')
    expect(builder.order).toHaveBeenCalledWith('pokedex_number', { ascending: true })
    expect(result).toEqual([{ pokedex_number: 387 }])
  })

  it('throws when the query returns an error', async () => {
    const builder = createQueryBuilderMock({ data: null, error: new Error('boom') })
    fromMock.mockReturnValue(builder)

    await expect(listSpeciesCatalog()).rejects.toThrow('boom')
  })
})

describe('getSpeciesByPokedexNumber', () => {
  it('fetches a single species by pokedex number', async () => {
    const builder = createQueryBuilderMock({ data: { pokedex_number: 387 }, error: null })
    fromMock.mockReturnValue(builder)

    expect(await getSpeciesByPokedexNumber(387)).toEqual({ pokedex_number: 387 })
    expect(builder.eq).toHaveBeenCalledWith('pokedex_number', 387)
  })

  it('returns null when the species does not exist', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    fromMock.mockReturnValue(builder)

    expect(await getSpeciesByPokedexNumber(9999)).toBeNull()
  })
})
