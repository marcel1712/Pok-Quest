import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSpeciesByPokedexNumber, listSpeciesCatalog } from './species-catalog-repository'

type QueryResult = { data: unknown; error: unknown }

function createQueryBuilderMock(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    in: vi.fn(() => builder),
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
  it('fetches a species by pokedex number', async () => {
    const builder = createQueryBuilderMock({ data: [{ pokedex_number: 387 }], error: null })
    fromMock.mockReturnValue(builder)

    expect(await getSpeciesByPokedexNumber(387)).toEqual({ pokedex_number: 387 })
    expect(builder.in).toHaveBeenCalledWith('pokedex_number', [387])
  })

  it('coalesces lookups made in the same tick into one request', async () => {
    const builder = createQueryBuilderMock({
      data: [{ pokedex_number: 390 }, { pokedex_number: 396 }],
      error: null,
    })
    fromMock.mockReturnValue(builder)

    const results = await Promise.all([
      getSpeciesByPokedexNumber(390),
      getSpeciesByPokedexNumber(396),
      getSpeciesByPokedexNumber(390),
      getSpeciesByPokedexNumber(999),
    ])

    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(builder.in).toHaveBeenCalledWith('pokedex_number', [390, 396, 999])
    expect(results).toEqual([
      { pokedex_number: 390 },
      { pokedex_number: 396 },
      { pokedex_number: 390 },
      null,
    ])
  })

  it('makes a new request for a lookup that comes after the batch was sent', async () => {
    fromMock.mockReturnValue(
      createQueryBuilderMock({ data: [{ pokedex_number: 390 }], error: null }),
    )

    await getSpeciesByPokedexNumber(390)
    await getSpeciesByPokedexNumber(390)

    expect(fromMock).toHaveBeenCalledTimes(2)
  })

  it('returns null when the species does not exist', async () => {
    fromMock.mockReturnValue(createQueryBuilderMock({ data: [], error: null }))
    expect(await getSpeciesByPokedexNumber(9999)).toBeNull()
  })

  it('rejects every waiting lookup when the request fails', async () => {
    fromMock.mockReturnValue(createQueryBuilderMock({ data: null, error: new Error('boom') }))

    const results = await Promise.allSettled([
      getSpeciesByPokedexNumber(387),
      getSpeciesByPokedexNumber(390),
    ])
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected'])
  })
})
