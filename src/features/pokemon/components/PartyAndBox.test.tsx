import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listOwnedPokemon,
  setPartyPosition,
  swapPartyPositions,
} from '@/features/pokemon/api/owned-pokemon-repository'
import { getSpeciesByPokedexNumber } from '@/features/pokemon/api/species-catalog-repository'
import type { OwnedPokemon } from '@/features/pokemon/types'
import { PartyAndBox } from './PartyAndBox'

vi.mock('@/features/pokemon/api/owned-pokemon-repository', () => ({
  listOwnedPokemon: vi.fn(),
  setPartyPosition: vi.fn(),
  swapPartyPositions: vi.fn(),
  captureFromBattle: vi.fn(),
  getCaptureForBattle: vi.fn(),
}))

vi.mock('@/features/pokemon/api/species-catalog-repository', () => ({
  getSpeciesByPokedexNumber: vi.fn(),
  listSpeciesCatalog: vi.fn(),
}))

const listOwnedPokemonMock = vi.mocked(listOwnedPokemon)
const setPartyPositionMock = vi.mocked(setPartyPosition)
const swapPartyPositionsMock = vi.mocked(swapPartyPositions)
const getSpeciesByPokedexNumberMock = vi.mocked(getSpeciesByPokedexNumber)

function makePokemon(overrides: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    id: 'p1',
    owner_id: 'owner-1',
    pokedex_number: 387,
    nickname: null,
    level: 5,
    xp: 0,
    pending_evolution_to_pokedex_number: null,
    party_position: null,
    captured_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PartyAndBox />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  listOwnedPokemonMock.mockReset()
  setPartyPositionMock.mockReset()
  swapPartyPositionsMock.mockReset()
  getSpeciesByPokedexNumberMock.mockReset().mockResolvedValue({
    pokedex_number: 387,
    name: 'Turtwig',
    types: ['grass'],
    sprite_url: null,
    official_artwork_url: null,
    is_starter: true,
    evolves_to_pokedex_number: 388,
    evolution_min_level: 18,
    catalog_version: 1,
    imported_at: new Date().toISOString(),
  } as never)
})

describe('PartyAndBox', () => {
  it('shows an empty state when nothing has been captured', async () => {
    listOwnedPokemonMock.mockResolvedValue([])
    renderComponent()

    expect(await screen.findByText('Você ainda não capturou nenhum Pokémon.')).toBeInTheDocument()
  })

  it('renders a captured pokemon in the box when it has no party position', async () => {
    listOwnedPokemonMock.mockResolvedValue([makePokemon()])
    renderComponent()

    expect(await screen.findByText('Turtwig')).toBeInTheDocument()
    expect(screen.getAllByText('Vazio')).toHaveLength(6)
  })

  it('moves a box pokemon into an empty party slot on selection', async () => {
    listOwnedPokemonMock.mockResolvedValue([makePokemon()])
    setPartyPositionMock.mockResolvedValue(makePokemon({ party_position: 1 }))
    renderComponent()

    await userEvent.click(await screen.findByText('Turtwig'))
    await userEvent.click(screen.getAllByText('Vazio')[0]!)

    await waitFor(() => expect(setPartyPositionMock).toHaveBeenCalledWith('p1', 1))
  })

  it('swaps two pokemon when both are selected in sequence', async () => {
    const partyMember = makePokemon({ id: 'p1', party_position: 1 })
    const boxMember = makePokemon({ id: 'p2', party_position: null, pokedex_number: 390 })
    listOwnedPokemonMock.mockResolvedValue([partyMember, boxMember])
    swapPartyPositionsMock.mockResolvedValue(undefined)
    renderComponent()

    const cards = await screen.findAllByRole('button', { name: /Nv\. 5/ })
    await userEvent.click(cards[0]!)
    await userEvent.click(cards[1]!)

    await waitFor(() => expect(swapPartyPositionsMock).toHaveBeenCalledWith('p1', 'p2'))
  })
})
