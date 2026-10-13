import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureFromBattle,
  confirmEvolution,
  getCaptureForBattle,
  listOwnedPokemon,
  setPartyPosition,
  swapPartyPositions,
} from './owned-pokemon-repository'

type QueryResult = { data: unknown; error: unknown }

function createQueryBuilderMock(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
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

describe('listOwnedPokemon', () => {
  it('queries owned_pokemon ordered by capture date', async () => {
    const builder = createQueryBuilderMock({ data: [{ id: '1' }], error: null })
    fromMock.mockReturnValue(builder)

    const result = await listOwnedPokemon()

    expect(fromMock).toHaveBeenCalledWith('owned_pokemon')
    expect(builder.order).toHaveBeenCalledWith('captured_at', { ascending: true })
    expect(result).toEqual([{ id: '1' }])
  })
})

describe('getCaptureForBattle', () => {
  it('fetches a capture by battle id', async () => {
    const builder = createQueryBuilderMock({ data: { id: 'c1' }, error: null })
    fromMock.mockReturnValue(builder)

    expect(await getCaptureForBattle('battle-1')).toEqual({ id: 'c1' })
    expect(builder.eq).toHaveBeenCalledWith('battle_id', 'battle-1')
  })

  it('returns null when nothing has captured that battle yet', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    fromMock.mockReturnValue(builder)

    expect(await getCaptureForBattle('battle-1')).toBeNull()
  })
})

describe('setPartyPosition', () => {
  it('updates the party_position column', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1', party_position: 3 }, error: null })
    fromMock.mockReturnValue(builder)

    const result = await setPartyPosition('1', 3)

    expect(builder.update).toHaveBeenCalledWith({ party_position: 3 })
    expect(builder.eq).toHaveBeenCalledWith('id', '1')
    expect(result).toEqual({ id: '1', party_position: 3 })
  })

  it('throws when the position is already taken by another pokemon', async () => {
    const builder = createQueryBuilderMock({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    fromMock.mockReturnValue(builder)

    await expect(setPartyPosition('1', 3)).rejects.toBeTruthy()
  })
})

describe('swapPartyPositions', () => {
  it('calls the swap RPC with both ids', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })

    await swapPartyPositions('a', 'b')

    expect(rpcMock).toHaveBeenCalledWith('swap_party_positions', {
      p_pokemon_a: 'a',
      p_pokemon_b: 'b',
    })
  })

  it('throws when the RPC errors', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(swapPartyPositions('a', 'b')).rejects.toThrow('boom')
  })
})

describe('captureFromBattle', () => {
  it('calls the capture RPC with the battle id and returns the pokemon', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'p1' }, error: null })

    const result = await captureFromBattle('battle-1')

    expect(rpcMock).toHaveBeenCalledWith('capture_from_battle', { p_battle_id: 'battle-1' })
    expect(result).toEqual({ id: 'p1' })
  })

  it('throws when the battle is not eligible for capture', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error('Só é possível capturar depois de uma vitória confirmada.'),
    })

    await expect(captureFromBattle('battle-1')).rejects.toThrow(
      'Só é possível capturar depois de uma vitória confirmada.',
    )
  })
})

describe('confirmEvolution', () => {
  it('calls the evolution RPC with the pokemon id and returns the evolved pokemon', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'p1', pokedex_number: 389 }, error: null })

    const result = await confirmEvolution('p1')

    expect(rpcMock).toHaveBeenCalledWith('confirm_evolution', { p_owned_pokemon_id: 'p1' })
    expect(result).toEqual({ id: 'p1', pokedex_number: 389 })
  })

  it('throws when nothing is pending', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error('Esse Pokémon não tem nenhuma evolução pendente.'),
    })

    await expect(confirmEvolution('p1')).rejects.toThrow(
      'Esse Pokémon não tem nenhuma evolução pendente.',
    )
  })
})
