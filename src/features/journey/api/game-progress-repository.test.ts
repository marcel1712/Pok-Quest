import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chooseStarter, getGameProgress } from './game-progress-repository'

const maybeSingleMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('@/shared/lib/supabase-client', () => ({
  supabase: {
    from: () => ({ select: () => ({ maybeSingle: () => maybeSingleMock() }) }),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

beforeEach(() => {
  maybeSingleMock.mockReset()
  rpcMock.mockReset()
})

describe('getGameProgress', () => {
  it('returns null when no starter was chosen yet', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    expect(await getGameProgress()).toBeNull()
  })

  it('returns the recorded choice', async () => {
    maybeSingleMock.mockResolvedValue({ data: { starter_pokedex_number: 390 }, error: null })
    expect(await getGameProgress()).toEqual({ starter_pokedex_number: 390 })
  })

  it('throws on error', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(getGameProgress()).rejects.toEqual({ message: 'boom' })
  })
})

describe('chooseStarter', () => {
  it('calls the RPC with only the species number', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'p1', pokedex_number: 393 }, error: null })

    expect(await chooseStarter(393)).toEqual({ id: 'p1', pokedex_number: 393 })
    expect(rpcMock).toHaveBeenCalledWith('choose_starter', { p_pokedex_number: 393 })
  })

  it('throws when the starter was already chosen', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } })
    await expect(chooseStarter(387)).rejects.toEqual({ code: '23505', message: 'duplicate' })
  })
})
